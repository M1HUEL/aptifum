import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';

import { DocumentSeriesKind, MovementType, PurchaseOrderStatus, round2 } from '@aptifum/core';
import {
  ACCOUNT_CODES,
  applyStockMovement,
  ChartAccountNotFoundError,
  DocumentSeriesNotFoundError,
  GoodsReceipt,
  GoodsReceiptItem,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  nextDocumentNumber as dbNextDocumentNumber,
  postJournalEntry,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  Warehouse,
} from '@aptifum/database';
import type { JournalLineInput } from '@aptifum/database';

import { searchDocumentIds } from '../../common/query/document-search';
import { OutboxService } from '../outbox/outbox.service';

import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly ordersRepo: Repository<PurchaseOrder>,
    @InjectRepository(Supplier)
    private readonly suppliersRepo: Repository<Supplier>,
    @InjectRepository(Warehouse)
    private readonly warehousesRepo: Repository<Warehouse>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(GoodsReceipt)
    private readonly receiptsRepo: Repository<GoodsReceipt>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<PurchaseOrder> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, opts: { q?: string; status?: string } = {}) {
    if (opts.status && !(Object.values(PurchaseOrderStatus) as string[]).includes(opts.status)) {
      throw new BadRequestException(`Invalid status: ${opts.status}`);
    }
    const where: FindOptionsWhere<PurchaseOrder> = this.scoped(tenantId);
    if (opts.status) where.status = opts.status as PurchaseOrderStatus;
    if (opts.q) {
      const ids = await searchDocumentIds(this.ordersRepo, tenantId, opts.q, {
        partyColumn: 'supplier_id',
        partyTable: 'suppliers',
        itemTable: 'purchase_order_items',
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
      relations: { supplier: true, warehouse: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const order = await this.ordersRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { items: true, supplier: true, warehouse: true },
    });
    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }
    return order;
  }

  async create(tenantId: string | null, dto: CreatePurchaseOrderDto) {
    this.assertTenant(tenantId);
    const supplier = await this.suppliersRepo.findOneBy({
      id: dto.supplierId,
      tenantId,
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    const warehouse = await this.warehousesRepo.findOneBy({
      id: dto.warehouseId,
      tenantId,
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    const products = await this.loadProducts(
      tenantId,
      dto.items.map((i) => i.productId),
    );

    return this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(PurchaseOrder);
      const { number } = await this.nextNumber(manager, tenantId, DocumentSeriesKind.PURCHASE_ORDER);
      const items = dto.items.map((item) => {
        const product = products.get(item.productId);
        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }
        const unitCost = item.unitCost ?? product.purchasePrice ?? 0;
        const quantity = item.quantity;
        const discount = item.discount ?? 0;
        return manager.getRepository(PurchaseOrderItem).create({
          tenantId,
          productId: item.productId,
          description: item.description ?? product.name,
          quantity,
          unitCost,
          discount,
          taxRate: item.taxRate ?? 0,
          taxAmount: round2(quantity * unitCost * (item.taxRate ?? 0)),
          lineTotal: round2(quantity * unitCost - discount),
          receivedQuantity: 0,
        });
      });
      const totals = this.computeTotals(items);
      const order = ordersRepo.create({
        tenantId,
        number,
        status: PurchaseOrderStatus.DRAFT,
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        issueDate: dto.issueDate ?? this.today(),
        expectedAt: dto.expectedAt ?? null,
        currency: supplier.currency,
        ...totals,
        notes: dto.notes ?? null,
        items,
      });
      const saved = await ordersRepo.save(order);
      return saved;
    });
  }

  async approve(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft purchase orders can be approved');
    }
    order.status = PurchaseOrderStatus.APPROVED;
    return this.ordersRepo.save(order);
  }

  async cancel(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.status !== PurchaseOrderStatus.DRAFT && order.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException('Only draft or approved purchase orders can be cancelled');
    }
    order.status = PurchaseOrderStatus.CANCELLED;
    return this.ordersRepo.save(order);
  }

  async receive(tenantId: string | null, userId: string | null, id: string, dto: CreateGoodsReceiptDto) {
    this.assertTenant(tenantId);
    const order = await this.ordersRepo.findOne({
      where: { id, tenantId },
      relations: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }
    if (order.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException('Only approved purchase orders can be received');
    }
    const itemsById = new Map(order.items.map((item) => [item.id, item]));
    for (const line of dto.items) {
      const item = itemsById.get(line.orderItemId);
      if (!item) {
        throw new NotFoundException(`Order item ${line.orderItemId} not found`);
      }
      const remaining = round2(item.quantity - item.receivedQuantity);
      if (line.quantity > remaining) {
        throw new BadRequestException(
          `Receiving ${line.quantity} exceeds remaining ${remaining} for item ${line.orderItemId}`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const receiptsRepo = manager.getRepository(GoodsReceipt);
      const { number } = await this.nextNumber(manager, tenantId, DocumentSeriesKind.GOODS_RECEIPT);
      const receiptItems = dto.items.map((line) => {
        const orderItem = itemsById.get(line.orderItemId)!;
        return manager.getRepository(GoodsReceiptItem).create({
          tenantId,
          productId: orderItem.productId,
          orderItemId: orderItem.id,
          quantity: line.quantity,
          unitCost: orderItem.unitCost,
        });
      });
      const receipt = receiptsRepo.create({
        tenantId,
        number,
        orderId: order.id,
        supplierId: order.supplierId,
        warehouseId: order.warehouseId,
        receivedAt: new Date(),
        notes: dto.notes ?? null,
        items: receiptItems,
      });
      const saved = await receiptsRepo.save(receipt);

      let receivedAmount = 0;
      for (const line of dto.items) {
        const orderItem = itemsById.get(line.orderItemId)!;
        orderItem.receivedQuantity = round2(orderItem.receivedQuantity + line.quantity);
        await manager.getRepository(PurchaseOrderItem).save(orderItem);
        await applyStockMovement(manager, {
          tenantId,
          movementType: MovementType.INBOUND,
          productId: orderItem.productId,
          warehouseId: order.warehouseId,
          quantity: line.quantity,
          unitCost: orderItem.unitCost,
          referenceType: 'purchase_receipt',
          referenceId: saved.id,
          userId,
          lotNumber: line.lotNumber,
          expiryDate: line.expiryDate,
        });
        receivedAmount = round2(receivedAmount + orderItem.unitCost * line.quantity);
      }

      const allReceived = order.items.every((item) => item.receivedQuantity + 1e-9 >= item.quantity);
      if (allReceived) {
        order.status = PurchaseOrderStatus.RECEIVED;
        await manager.getRepository(PurchaseOrder).save(order);
      }
      await this.postReceiptEntry(manager, tenantId, userId, order.currency, saved, receivedAmount);
      await this.outbox.emit(manager, tenantId, {
        eventType: 'purchase_receipt',
        aggregateType: 'goods_receipt',
        aggregateId: saved.id,
        payload: { number: saved.number, orderId: saved.orderId, supplierId: saved.supplierId },
        tenantId,
        userId,
      });
      return saved;
    });
  }

  async listReceipts(tenantId: string | null, page: number, limit: number) {
    const [rows, total] = await this.receiptsRepo.findAndCount({
      where: tenantId ? { tenantId } : {},
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findReceipt(tenantId: string | null, id: string) {
    const receipt = await this.receiptsRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: { items: true, order: true },
    });
    if (!receipt) {
      throw new NotFoundException('Goods receipt not found');
    }
    return receipt;
  }

  private async loadProducts(tenantId: string, ids: string[]): Promise<Map<string, Product>> {
    const uniqueIds = [...new Set(ids)];
    const products = await this.productsRepo.find({
      where: { id: In(uniqueIds), tenantId },
    });
    return new Map(products.map((p) => [p.id, p]));
  }

  private computeTotals(
    items: Pick<PurchaseOrderItem, 'quantity' | 'unitCost' | 'discount' | 'taxRate' | 'taxAmount' | 'lineTotal'>[],
  ) {
    const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
    const tax = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
    return { subtotal, discount: 0, tax, total: round2(subtotal + tax) };
  }

  private async postReceiptEntry(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    currency: string,
    receipt: GoodsReceipt,
    amount: number,
  ): Promise<void> {
    try {
      const lines: JournalLineInput[] = [
        { accountCode: ACCOUNT_CODES.INVENTORY, debit: amount },
        { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, credit: amount },
      ];
      const cleanLines = lines.filter((line) => (line.debit ?? 0) > 0 || (line.credit ?? 0) > 0);
      if (cleanLines.length === 0) {
        return;
      }
      await postJournalEntry(manager, tenantId, {
        entryDate: receipt.receivedAt.toISOString().slice(0, 10),
        description: `Goods receipt ${receipt.number}`,
        referenceType: 'purchase_receipt',
        referenceId: receipt.id,
        currency,
        userId,
        lines: cleanLines,
      });
    } catch (error) {
      this.mapPostError(error);
    }
  }

  private mapPostError(error: unknown): never {
    if (error instanceof ChartAccountNotFoundError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryPeriodClosedError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof JournalEntryUnbalancedError) {
      throw new ConflictException(error.message);
    }
    throw error;
  }

  private async nextNumber(
    manager: EntityManager,
    tenantId: string,
    kind: DocumentSeriesKind,
  ): Promise<{ number: string; seriesId: string }> {
    try {
      return await dbNextDocumentNumber(manager, tenantId, kind);
    } catch (error) {
      if (error instanceof DocumentSeriesNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
