import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';

import { DocumentSeriesKind, SalesOrderKind, SalesOrderStatus } from '@aptifum/core';
import {
  Customer,
  InsufficientStockError,
  Product,
  ProductVariant,
  SalesOrder,
  Warehouse,
  releaseStock,
  reserveStock,
} from '@aptifum/database';

import { searchDocumentIds } from '../../common/query/document-search';
import { UsSalesTaxService } from '../tax/us-sales-tax.service';

import { CreateOrderDto } from './dto/create-order.dto';
import { computeTotals, nextDocumentNumber, round2, today } from './helpers';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(SalesOrder) private readonly ordersRepo: Repository<SalesOrder>,
    @InjectRepository(Warehouse) private readonly warehousesRepo: Repository<Warehouse>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepo: Repository<ProductVariant>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly usSalesTax: UsSalesTaxService,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<SalesOrder> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(
    tenantId: string | null,
    page: number,
    limit: number,
    opts: { q?: string; kind?: string; status?: string } = {},
  ) {
    if (opts.kind && !(Object.values(SalesOrderKind) as string[]).includes(opts.kind)) {
      throw new BadRequestException(`Invalid kind: ${opts.kind}`);
    }
    if (opts.status && !(Object.values(SalesOrderStatus) as string[]).includes(opts.status)) {
      throw new BadRequestException(`Invalid status: ${opts.status}`);
    }
    const where: FindOptionsWhere<SalesOrder> = this.scoped(tenantId);
    if (opts.kind) where.kind = opts.kind as SalesOrderKind;
    if (opts.status) where.status = opts.status as SalesOrderStatus;
    if (opts.q) {
      const ids = await searchDocumentIds(this.ordersRepo, tenantId, opts.q, {
        partyColumn: 'customer_id',
        partyTable: 'customers',
        itemTable: 'sales_order_items',
        itemFkColumn: 'order_id',
      });
      if (ids.length === 0) {
        return { data: [], meta: { page, limit, total: 0 } };
      }
      where.id = In(ids);
    }
    const [rows, total] = await this.ordersRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { customer: true, warehouse: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const order = await this.ordersRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { customer: true, warehouse: true, items: { product: true } },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async create(tenantId: string | null, dto: CreateOrderDto) {
    this.assertTenant(tenantId);
    await this.ensureWarehouse(tenantId, dto.warehouseId);

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(Customer).findOneBy({
        id: dto.customerId,
        tenantId,
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      const usTaxRate = await this.usSalesTax.resolveRate(tenantId, customer.state, customer.taxExempt);
      const products = await this.loadProducts(
        tenantId,
        dto.items.map((item) => item.productId),
      );
      const variants = await this.loadVariants(
        tenantId,
        dto.items.filter((item) => item.variantId).map((item) => item.variantId as string),
      );
      const items = dto.items.map((item) => {
        const product = products.get(item.productId);
        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }
        const variant = item.variantId ? variants.get(item.variantId) : undefined;
        if (item.variantId && !variant) {
          throw new NotFoundException(`Variant ${item.variantId} not found`);
        }
        if (variant && variant.productId !== product.id) {
          throw new BadRequestException(`Variant ${item.variantId} does not belong to product ${product.id}`);
        }
        const unitPrice = item.unitPrice ?? variant?.salePrice ?? product.salePrice;
        const taxRate = item.taxRate ?? usTaxRate;
        const discount = item.discount ?? 0;
        const quantity = item.quantity;
        return {
          tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          description: item.description ?? product.name,
          quantity,
          unitPrice,
          discount,
          taxRate,
          taxAmount: round2(quantity * unitPrice * taxRate),
          lineTotal: round2(quantity * unitPrice - discount),
        };
      });
      const totals = computeTotals(items, dto.discount ?? 0);
      const { number } = await nextDocumentNumber(
        manager,
        tenantId,
        dto.kind === SalesOrderKind.QUOTE ? DocumentSeriesKind.QUOTE : DocumentSeriesKind.ORDER,
      );
      const order = await manager.getRepository(SalesOrder).save(
        manager.getRepository(SalesOrder).create({
          tenantId,
          number,
          kind: dto.kind ?? SalesOrderKind.ORDER,
          status: SalesOrderStatus.DRAFT,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          issueDate: dto.issueDate ?? today(),
          dueDate: dto.dueDate ?? null,
          currency: 'USD',
          ...totals,
          notes: dto.notes ?? null,
          items,
        }),
      );
      return order;
    });
  }

  async confirm(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new ConflictException('Only draft orders can be confirmed');
    }
    this.assertTenant(tenantId);
    if (order.kind !== SalesOrderKind.ORDER) {
      order.status = SalesOrderStatus.CONFIRMED;
      return this.ordersRepo.save(order);
    }
    return this.dataSource.transaction(async (manager) => {
      if (order.warehouseId) {
        for (const item of order.items ?? []) {
          try {
            await reserveStock(manager, {
              tenantId,
              productId: item.productId,
              variantId: item.variantId ?? null,
              warehouseId: order.warehouseId,
              quantity: item.quantity,
            });
          } catch (error) {
            if (error instanceof InsufficientStockError) {
              throw new BadRequestException(`Insufficient stock for product ${item.productId}`);
            }
            throw error;
          }
        }
      }
      order.status = SalesOrderStatus.CONFIRMED;
      await manager.getRepository(SalesOrder).save(order);
      return order;
    });
  }

  async cancel(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.status === SalesOrderStatus.INVOICED) {
      throw new ConflictException('Invoiced orders cannot be cancelled');
    }
    if (order.status === SalesOrderStatus.CANCELLED) {
      throw new ConflictException('Order is already cancelled');
    }
    this.assertTenant(tenantId);
    const releasesReserved = order.kind === SalesOrderKind.ORDER && order.status === SalesOrderStatus.CONFIRMED;
    if (!releasesReserved) {
      order.status = SalesOrderStatus.CANCELLED;
      return this.ordersRepo.save(order);
    }
    return this.dataSource.transaction(async (manager) => {
      if (order.warehouseId) {
        for (const item of order.items ?? []) {
          await releaseStock(manager, {
            tenantId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            warehouseId: order.warehouseId,
            quantity: item.quantity,
          });
        }
      }
      order.status = SalesOrderStatus.CANCELLED;
      await manager.getRepository(SalesOrder).save(order);
      return order;
    });
  }

  async convertToOrder(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.kind !== SalesOrderKind.QUOTE) {
      throw new BadRequestException('Only quotes can be converted to orders');
    }
    if (order.status === SalesOrderStatus.INVOICED) {
      throw new ConflictException('Order is already invoiced');
    }
    order.kind = SalesOrderKind.ORDER;
    return this.ordersRepo.save(order);
  }

  private async ensureWarehouse(tenantId: string, warehouseId: string) {
    const warehouse = await this.warehousesRepo.findOneBy({ id: warehouseId, tenantId });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
  }

  private async loadProducts(tenantId: string, ids: string[]): Promise<Map<string, Product>> {
    const products = await this.productsRepo.findBy({ tenantId, id: In(ids) });
    return new Map(products.map((product) => [product.id, product]));
  }

  private async loadVariants(tenantId: string, ids: string[]): Promise<Map<string, ProductVariant>> {
    if (ids.length === 0) {
      return new Map();
    }
    const variants = await this.variantsRepo.findBy({ tenantId, id: In(ids) });
    return new Map(variants.map((variant) => [variant.id, variant]));
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
