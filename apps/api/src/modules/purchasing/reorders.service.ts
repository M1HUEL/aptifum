import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Warehouse } from '@aptifum/database';

import { GeneratePurchaseOrdersDto } from './dto/generate-purchase-orders.dto.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

export interface ReorderSuggestion {
  productId: string;
  sku: string;
  name: string;
  unitOfMeasure: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number;
  targetQuantity: number;
  suggestedQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  estimatedUnitCost: number;
  leadTimeDays: number | null;
}

interface SuggestionRow {
  productId: string;
  sku: string;
  name: string;
  unitOfMeasure: string;
  total_quantity: string;
  reserved_quantity: string;
  reorder_point: string;
  target_quantity: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  estimated_unit_cost: string;
  lead_time_days: string | null;
}

@Injectable()
export class ReordersService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehousesRepo: Repository<Warehouse>,
    private readonly dataSource: DataSource,
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  private buildSuggestionsQuery(tenantId: string | null, warehouseId?: string) {
    const params: unknown[] = [];
    let index = 0;
    const tenantFilter = tenantId ? `p.tenant_id = $${index + 1}` : 'TRUE';
    if (tenantId) {
      index += 1;
      params.push(tenantId);
    }
    let stockJoin = `LEFT JOIN product_stock ps
        ON ps.product_id = p.id AND ps.tenant_id = p.tenant_id AND ps.deleted_at IS NULL`;
    if (warehouseId) {
      stockJoin += ` AND ps.warehouse_id = $${index + 1}`;
      params.push(warehouseId);
    }
    return {
      sql: `
        SELECT p.id AS "productId",
               p.sku,
               p.name,
               p.unit_of_measure AS "unitOfMeasure",
               COALESCE(SUM(ps.quantity), 0) AS total_quantity,
               COALESCE(SUM(ps.reserved_quantity), 0) AS reserved_quantity,
               p.reorder_point AS reorder_point,
               COALESCE(NULLIF(p.reorder_quantity, 0), p.reorder_point) AS target_quantity,
               pref.supplier_id AS supplier_id,
               s.trade_name AS supplier_name,
               COALESCE(pref.unit_cost, p.purchase_price, 0) AS estimated_unit_cost,
               pref.lead_time_days AS lead_time_days
        FROM products p
        ${stockJoin}
        LEFT JOIN LATERAL (
          SELECT link.supplier_id, link.unit_cost, link.lead_time_days
          FROM product_suppliers link
          WHERE link.product_id = p.id
            AND link.tenant_id = p.tenant_id
            AND link.deleted_at IS NULL
          ORDER BY link.is_preferred DESC, link.created_at ASC
          LIMIT 1
        ) pref ON TRUE
        LEFT JOIN suppliers s ON s.id = pref.supplier_id AND s.deleted_at IS NULL
        WHERE ${tenantFilter}
          AND p.deleted_at IS NULL
          AND p.enabled = TRUE
          AND p.reorder_point IS NOT NULL
        GROUP BY p.id, p.sku, p.name, p.unit_of_measure, p.reorder_point, target_quantity,
                 pref.supplier_id, s.trade_name, pref.unit_cost, p.purchase_price, pref.lead_time_days
        HAVING COALESCE(SUM(ps.quantity - ps.reserved_quantity), 0) <= p.reorder_point
        ORDER BY p.sku ASC`,
      params,
    };
  }

  private toSuggestion(row: SuggestionRow): ReorderSuggestion {
    const totalQuantity = Number(row.total_quantity);
    const reservedQuantity = Number(row.reserved_quantity);
    const reorderPoint = Number(row.reorder_point);
    const targetQuantity = Number(row.target_quantity ?? row.reorder_point);
    const availableQuantity = totalQuantity - reservedQuantity;
    return {
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      unitOfMeasure: row.unitOfMeasure,
      totalQuantity,
      reservedQuantity,
      availableQuantity,
      reorderPoint,
      targetQuantity,
      suggestedQuantity: Math.max(targetQuantity - availableQuantity, 0),
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      estimatedUnitCost: Number(row.estimated_unit_cost),
      leadTimeDays: row.lead_time_days === null ? null : Number(row.lead_time_days),
    };
  }

  async suggestions(tenantId: string | null): Promise<{ data: ReorderSuggestion[] }> {
    const { sql, params } = this.buildSuggestionsQuery(tenantId);
    const rows = await this.dataSource.query(sql, params);
    return { data: (rows as SuggestionRow[]).map((row) => this.toSuggestion(row)) };
  }

  async generate(tenantId: string | null, dto: GeneratePurchaseOrdersDto) {
    const warehouse = await this.warehousesRepo.findOne({
      where: tenantId ? { id: dto.warehouseId, tenantId } : { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    const { sql, params } = this.buildSuggestionsQuery(tenantId, warehouse.id);
    const rows = await this.dataSource.query(sql, params);
    const suggestions = (rows as SuggestionRow[])
      .map((row) => this.toSuggestion(row))
      .filter((s) => s.suggestedQuantity > 0);

    const wanted = dto.productIds?.length ? new Set(dto.productIds) : null;
    const selected = wanted ? suggestions.filter((s) => wanted.has(s.productId)) : suggestions;

    if (selected.length === 0) {
      throw new BadRequestException('No reorder suggestions to generate');
    }

    const bySupplier = new Map<string, ReorderSuggestion[]>();
    const unassigned: ReorderSuggestion[] = [];
    for (const suggestion of selected) {
      if (!suggestion.supplierId) {
        unassigned.push(suggestion);
        continue;
      }
      const bucket = bySupplier.get(suggestion.supplierId);
      if (bucket) {
        bucket.push(suggestion);
      } else {
        bySupplier.set(suggestion.supplierId, [suggestion]);
      }
    }

    const data: Array<{
      purchaseOrderId: string;
      number: string;
      supplierId: string;
      itemCount: number;
    }> = [];
    for (const [supplierId, items] of bySupplier) {
      const order = await this.purchaseOrdersService.create(tenantId, {
        supplierId,
        warehouseId: warehouse.id,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.suggestedQuantity,
          unitCost: item.estimatedUnitCost,
        })),
      });
      data.push({
        purchaseOrderId: order.id,
        number: order.number,
        supplierId,
        itemCount: items.length,
      });
    }

    return {
      data,
      warnings: unassigned.length
        ? unassigned.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            reason: 'no-supplier-linked' as const,
          }))
        : [],
    };
  }
}
