import { EntityManager } from 'typeorm';
import { MovementType } from '@aptifum/core';
import { ProductStock } from '../entities/product-stock.entity';
import { StockMovement } from '../entities/stock-movement.entity';

const MOVEMENT_SIGN: Record<MovementType, 1 | -1> = {
  [MovementType.INBOUND]: 1,
  [MovementType.OUTBOUND]: -1,
  [MovementType.ADJUSTMENT]: 1,
  [MovementType.TRANSFER]: 1,
  [MovementType.RETURN]: 1,
  [MovementType.DISPOSAL]: -1,
};

export class InsufficientStockError extends Error {
  constructor() {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

export interface ApplyStockMovementInput {
  tenantId: string;
  movementType: MovementType;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
  referenceType?: string | null;
  referenceId?: string | null;
  userId?: string | null;
}

export async function applyStockMovement(
  manager: EntityManager,
  input: ApplyStockMovementInput,
): Promise<StockMovement> {
  if (input.movementType === MovementType.TRANSFER) {
    throw new Error('Transfers are not implemented yet');
  }
  const sign = MOVEMENT_SIGN[input.movementType];
  const qty = input.quantity;
  const unitCost = input.unitCost ?? 0;

  const stockRepo = manager.getRepository(ProductStock);
  const movementsRepo = manager.getRepository(StockMovement);

  const stock = await stockRepo
    .createQueryBuilder('stock')
    .setLock('pessimistic_write')
    .where('stock.tenant_id = :tenantId', { tenantId: input.tenantId })
    .andWhere('stock.product_id = :productId', { productId: input.productId })
    .andWhere('stock.warehouse_id = :warehouseId', { warehouseId: input.warehouseId })
    .getOne();

  const newQty = (stock?.quantity ?? 0) + sign * qty;
  if (newQty < 0) {
    throw new InsufficientStockError();
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
        tenantId: input.tenantId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: newQty,
        reservedQuantity: 0,
        averageCost: sign > 0 ? unitCost : 0,
      }),
    );
  }

  return movementsRepo.save(
    movementsRepo.create({
      tenantId: input.tenantId,
      movementType: input.movementType,
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: sign * qty,
      unitCost,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      userId: input.userId ?? null,
    }),
  );
}
