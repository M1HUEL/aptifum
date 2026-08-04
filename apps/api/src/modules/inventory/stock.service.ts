import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MovementType } from '@aptifum/core';
import { ProductStock, StockMovement } from '@aptifum/database';
import { CreateMovementDto } from './dto/create-movement.dto';

const MOVEMENT_SIGN: Record<MovementType, 1 | -1> = {
  [MovementType.INBOUND]: 1,
  [MovementType.OUTBOUND]: -1,
  [MovementType.ADJUSTMENT]: 1,
  [MovementType.TRANSFER]: 1,
  [MovementType.RETURN]: 1,
  [MovementType.DISPOSAL]: -1,
};

@Injectable()
export class StockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ProductStock)
    private readonly stockRepo: Repository<ProductStock>,
    @InjectRepository(StockMovement)
    private readonly movementsRepo: Repository<StockMovement>,
  ) {}

  async listStock(tenantId: string | null, page: number, limit: number) {
    const where = tenantId ? { tenantId } : {};
    const [rows, total] = await this.stockRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { product: true, warehouse: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async stockByProduct(tenantId: string | null, productId: string) {
    const where = tenantId ? { tenantId, productId } : { productId };
    return this.stockRepo.find({
      where,
      order: { createdAt: 'ASC' },
      relations: { product: true, warehouse: true },
    });
  }

  async listMovements(
    tenantId: string | null,
    page: number,
    limit: number,
    productId?: string,
  ) {
    const where: { tenantId?: string; productId?: string } = tenantId
      ? { tenantId }
      : {};
    if (productId) {
      where.productId = productId;
    }
    const [rows, total] = await this.movementsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { occurredAt: 'DESC' },
      relations: { product: true, warehouse: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async createMovement(tenantId: string | null, userId: string | null, dto: CreateMovementDto) {
    this.assertTenant(tenantId);
    if (dto.movementType === MovementType.TRANSFER) {
      throw new BadRequestException('Transfers are not implemented yet');
    }
    const sign = MOVEMENT_SIGN[dto.movementType];
    const qty = dto.quantity;
    const unitCost = dto.unitCost ?? 0;

    return this.dataSource.transaction(async (manager) => {
      const stockRepo = manager.getRepository(ProductStock);
      const movementsRepo = manager.getRepository(StockMovement);

      const stock = await stockRepo
        .createQueryBuilder('stock')
        .setLock('pessimistic_write')
        .where('stock.tenant_id = :tenantId', { tenantId })
        .andWhere('stock.product_id = :productId', { productId: dto.productId })
        .andWhere('stock.warehouse_id = :warehouseId', { warehouseId: dto.warehouseId })
        .getOne();

      const newQty = (stock?.quantity ?? 0) + sign * qty;
      if (newQty < 0) {
        throw new BadRequestException('Insufficient stock');
      }

      if (stock) {
        let averageCost = stock.averageCost;
        if (sign > 0 && unitCost > 0) {
          averageCost =
            stock.quantity > 0
              ? (stock.quantity * stock.averageCost + qty * unitCost) / (stock.quantity + qty)
              : unitCost;
        }
        stock.quantity = newQty;
        stock.averageCost = averageCost;
        await stockRepo.save(stock);
      } else if (newQty > 0) {
        await stockRepo.save(
          stockRepo.create({
            tenantId: tenantId as string,
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            quantity: newQty,
            reservedQuantity: 0,
            averageCost: sign > 0 ? unitCost : 0,
          }),
        );
      }

      return movementsRepo.save(
        movementsRepo.create({
          tenantId: tenantId as string,
          movementType: dto.movementType,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId ?? null,
          quantity: sign * qty,
          unitCost,
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          userId,
          notes: dto.notes ?? null,
        }),
      );
    });
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
