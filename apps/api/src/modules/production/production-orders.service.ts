import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { DocumentSeriesKind, MovementType, ProductionOrderStatus, round2 } from '@aptifum/core';
import {
  ACCOUNT_CODES,
  applyStockMovement,
  ChartAccountNotFoundError,
  DocumentSeriesNotFoundError,
  InsufficientStockError,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  nextDocumentNumber as dbNextDocumentNumber,
  postJournalEntry,
  Product,
  ProductStock,
  ProductionBom,
  ProductionBomLine,
  ProductionOrder,
  ProductionOrderLine,
  Tenant,
  Warehouse,
} from '@aptifum/database';
import type { JournalLineInput } from '@aptifum/database';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

@Injectable()
export class ProductionOrdersService {
  constructor(
    @InjectRepository(ProductionOrder)
    private readonly ordersRepo: Repository<ProductionOrder>,
    @InjectRepository(ProductionBom)
    private readonly bomsRepo: Repository<ProductionBom>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehousesRepo: Repository<Warehouse>,
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<ProductionOrder> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number) {
    const [rows, total] = await this.ordersRepo.findAndCount({
      where: this.scoped(tenantId),
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { product: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const order = await this.ordersRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { product: true, bom: true, warehouse: true, lines: { product: true } },
    });
    if (!order) {
      throw new NotFoundException('Production order not found');
    }
    return order;
  }

  async create(tenantId: string | null, dto: CreateProductionOrderDto) {
    this.assertTenant(tenantId);
    const product = await this.productsRepo.findOneBy({ id: dto.productId, tenantId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const warehouse = await this.warehousesRepo.findOneBy({ id: dto.warehouseId, tenantId });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    if (dto.bomId) {
      const bom = await this.bomsRepo.findOneBy({ id: dto.bomId, tenantId });
      if (!bom) {
        throw new NotFoundException('BOM not found');
      }
      if (bom.productId !== dto.productId) {
        throw new BadRequestException('BOM does not produce the requested product');
      }
    }
    const tenantEntity = await this.tenantsRepo.findOneBy({ id: tenantId });
    const currency = tenantEntity?.defaultCurrency ?? 'USD';

    return this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(ProductionOrder);
      const { number } = await this.nextNumber(manager, tenantId, DocumentSeriesKind.PRODUCTION_ORDER);
      const order = ordersRepo.create({
        tenantId,
        number,
        productId: dto.productId,
        bomId: dto.bomId ?? null,
        quantity: dto.quantity,
        status: ProductionOrderStatus.PLANNED,
        warehouseId: dto.warehouseId,
        currency,
        laborCost: dto.laborCost ?? 0,
        overhead: dto.overhead ?? 0,
        notes: dto.notes ?? null,
      });
      return ordersRepo.save(order);
    });
  }

  async update(tenantId: string | null, id: string, dto: UpdateProductionOrderDto) {
    const order = await this.findOne(tenantId, id);
    if (order.status !== ProductionOrderStatus.PLANNED) {
      throw new BadRequestException('Only planned production orders can be edited');
    }
    Object.assign(order, {
      quantity: dto.quantity ?? order.quantity,
      laborCost: dto.laborCost ?? order.laborCost,
      overhead: dto.overhead ?? order.overhead,
      notes: dto.notes === undefined ? order.notes : dto.notes,
    });
    return this.ordersRepo.save(order);
  }

  async remove(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.status !== ProductionOrderStatus.PLANNED) {
      throw new BadRequestException('Only planned production orders can be deleted');
    }
    await this.ordersRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  async start(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.status !== ProductionOrderStatus.PLANNED) {
      throw new BadRequestException('Only planned production orders can be started');
    }
    order.status = ProductionOrderStatus.IN_PROGRESS;
    return this.ordersRepo.save(order);
  }

  async complete(tenantId: string | null, userId: string | null, id: string) {
    this.assertTenant(tenantId);
    const order = await this.findOne(tenantId, id);
    if (order.status !== ProductionOrderStatus.IN_PROGRESS) {
      throw new BadRequestException('Only in-progress production orders can be completed');
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        const ordersRepo = manager.getRepository(ProductionOrder);
        const current = await ordersRepo.findOneBy({ id: order.id, tenantId: tenantId as string });
        if (!current || current.status !== ProductionOrderStatus.IN_PROGRESS) {
          throw new BadRequestException('Only in-progress production orders can be completed');
        }

        const linesRepo = manager.getRepository(ProductionOrderLine);
        const stockRepo = manager.getRepository(ProductStock);
        const lines = [];
        let materialCost = 0;

        if (current.bomId) {
          const bomLines = await manager.getRepository(ProductionBomLine).findBy({
            bomId: current.bomId,
            tenantId: tenantId as string,
          });
          for (const bomLine of bomLines) {
            const required = round4(
              bomLine.quantity * current.quantity * (1 + (bomLine.wasteRate ?? 0) / 100),
            );
            const stock = await stockRepo.findOneBy({
              tenantId: tenantId as string,
              productId: bomLine.productId,
              warehouseId: current.warehouseId,
            });
            const unitCost = stock?.averageCost ?? 0;
            await applyStockMovement(manager, {
              tenantId,
              movementType: MovementType.OUTBOUND,
              productId: bomLine.productId,
              warehouseId: current.warehouseId,
              quantity: required,
              unitCost,
              referenceType: 'production_order',
              referenceId: current.id,
              userId,
            });
            const lineCost = round2(required * unitCost);
            materialCost = round2(materialCost + lineCost);
            lines.push(
              linesRepo.create({
                tenantId,
                orderId: current.id,
                productId: bomLine.productId,
                plannedQuantity: required,
                consumedQuantity: required,
                unitCost,
                lineCost,
              }),
            );
          }
        }

        await linesRepo.save(lines);

        const totalCost = round2(materialCost + current.laborCost + current.overhead);
        const finishedUnitCost =
          current.quantity > 0 ? round2(totalCost / current.quantity) : 0;
        await applyStockMovement(manager, {
          tenantId,
          movementType: MovementType.INBOUND,
          productId: current.productId,
          warehouseId: current.warehouseId,
          quantity: current.quantity,
          unitCost: finishedUnitCost,
          referenceType: 'production_order',
          referenceId: current.id,
          userId,
        });

        current.status = ProductionOrderStatus.COMPLETED;
        current.materialCost = materialCost;
        current.totalCost = totalCost;
        current.completedAt = new Date();
        await ordersRepo.save(current);

        if (totalCost > 0) {
          await this.postCompletionEntry(manager, tenantId as string, userId, current);
        }
        return current;
      });
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        throw new BadRequestException('Insufficient stock to complete production order');
      }
      this.mapPostError(error);
    }
  }

  async cancel(tenantId: string | null, id: string) {
    const order = await this.findOne(tenantId, id);
    if (
      order.status !== ProductionOrderStatus.PLANNED &&
      order.status !== ProductionOrderStatus.IN_PROGRESS
    ) {
      throw new BadRequestException('Only planned or in-progress production orders can be cancelled');
    }
    order.status = ProductionOrderStatus.CANCELLED;
    return this.ordersRepo.save(order);
  }

  private async postCompletionEntry(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    order: ProductionOrder,
  ): Promise<void> {
    const valueAdd = round2(order.totalCost - order.materialCost);
    const lines: JournalLineInput[] = [
      { accountCode: ACCOUNT_CODES.INVENTORY, debit: order.totalCost },
      { accountCode: ACCOUNT_CODES.INVENTORY, credit: order.materialCost },
    ];
    if (valueAdd > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.PAYROLL_EXPENSE, credit: valueAdd });
    }
    await postJournalEntry(manager, tenantId, {
      entryDate: order.completedAt ? order.completedAt.toISOString().slice(0, 10) : this.today(),
      description: `Production ${order.number}`,
      referenceType: 'production_order',
      referenceId: order.id,
      currency: order.currency,
      userId,
      lines,
    });
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
    if (error instanceof DocumentSeriesNotFoundError) {
      throw new NotFoundException(error.message);
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
