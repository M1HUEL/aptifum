import { EntityManager, IsNull } from 'typeorm';
import { MovementType } from '@aptifum/core';
import { ProductLot } from '../entities/product-lot.entity';
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
  variantId?: string | null;
  warehouseId: string;
  locationId?: string | null;
  quantity: number;
  unitCost?: number;
  referenceType?: string | null;
  referenceId?: string | null;
  userId?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | Date | null;
}

export interface ReserveStockInput {
  tenantId: string;
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  quantity: number;
}

interface LotContext {
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

async function findOrCreateLot(
  manager: EntityManager,
  input: LotContext & { lotNumber: string; expiryDate?: string | Date | null },
): Promise<ProductLot> {
  if (!input.expiryDate) {
    throw new Error('expiryDate is required when creating a lot');
  }
  const lotsRepo = manager.getRepository(ProductLot);
  let lot = await lotsRepo.findOneBy({
    tenantId: input.tenantId,
    productId: input.productId,
    variantId: input.variantId ?? IsNull(),
    warehouseId: input.warehouseId,
    lotNumber: input.lotNumber,
  });
  if (!lot) {
    lot = lotsRepo.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      lotNumber: input.lotNumber,
      expiryDate: toDate(input.expiryDate),
      quantity: 0,
    });
  } else if (input.expiryDate) {
    lot.expiryDate = toDate(input.expiryDate);
  }
  return lot;
}

async function assertLotMatches(
  manager: EntityManager,
  lotId: string,
  input: LotContext,
): Promise<ProductLot> {
  const lot = await manager.getRepository(ProductLot).findOneBy({ id: lotId });
  if (
    !lot ||
    lot.tenantId !== input.tenantId ||
    lot.productId !== input.productId ||
    lot.variantId !== input.variantId ||
    lot.warehouseId !== input.warehouseId
  ) {
    throw new Error('Lot does not match the product, variant and warehouse');
  }
  return lot;
}

async function consumeLotsFefo(
  manager: EntityManager,
  input: ApplyStockMovementInput & { quantity: number },
): Promise<StockMovement[]> {
  const lotsRepo = manager.getRepository(ProductLot);
  const movementsRepo = manager.getRepository(StockMovement);
  const lots = await lotsRepo
    .createQueryBuilder('lot')
    .setLock('pessimistic_write')
    .where('lot.tenant_id = :tenantId', { tenantId: input.tenantId })
    .andWhere('lot.product_id = :productId', { productId: input.productId })
    .andWhere('lot.warehouse_id = :warehouseId', { warehouseId: input.warehouseId })
    .andWhere(
      input.variantId ? 'lot.variant_id = :variantId' : 'lot.variant_id IS NULL',
      input.variantId ? { variantId: input.variantId } : {},
    )
    .andWhere('lot.quantity > 0')
    .orderBy('lot.expiry_date', 'ASC', 'NULLS LAST')
    .addOrderBy('lot.lot_number', 'ASC')
    .getMany();

  const movements: StockMovement[] = [];
  let remaining = input.quantity;
  for (const lot of lots) {
    if (remaining <= 0) {
      break;
    }
    const consumed = Math.min(lot.quantity, remaining);
    lot.quantity = lot.quantity - consumed;
    await lotsRepo.save(lot);
    movements.push(
      await movementsRepo.save(
        movementsRepo.create({
          tenantId: input.tenantId,
          movementType: input.movementType,
          productId: input.productId,
          variantId: input.variantId ?? null,
          warehouseId: input.warehouseId,
          locationId: input.locationId ?? null,
          quantity: -consumed,
          unitCost: input.unitCost ?? 0,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          userId: input.userId ?? null,
          lotId: lot.id,
        }),
      ),
    );
    remaining -= consumed;
  }

  if (remaining > 0) {
    movements.push(
      await movementsRepo.save(
        movementsRepo.create({
          tenantId: input.tenantId,
          movementType: input.movementType,
          productId: input.productId,
          variantId: input.variantId ?? null,
          warehouseId: input.warehouseId,
          locationId: input.locationId ?? null,
          quantity: -remaining,
          unitCost: input.unitCost ?? 0,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          userId: input.userId ?? null,
          lotId: null,
        }),
      ),
    );
  }

  return movements;
}

export async function applyStockMovement(
  manager: EntityManager,
  input: ApplyStockMovementInput,
): Promise<StockMovement> {
  if (input.movementType === MovementType.TRANSFER) {
    throw new Error('Transfers must be created via the transfer endpoint');
  }
  const sign = MOVEMENT_SIGN[input.movementType];
  const qty = input.quantity;
  const unitCost = input.unitCost ?? 0;

  const stockRepo = manager.getRepository(ProductStock);
  const movementsRepo = manager.getRepository(StockMovement);
  const lotsRepo = manager.getRepository(ProductLot);

  const stock = await stockRepo
    .createQueryBuilder('stock')
    .setLock('pessimistic_write')
    .where('stock.tenant_id = :tenantId', { tenantId: input.tenantId })
    .andWhere('stock.product_id = :productId', { productId: input.productId })
    .andWhere('stock.warehouse_id = :warehouseId', { warehouseId: input.warehouseId })
    .andWhere(
      input.variantId ? 'stock.variant_id = :variantId' : 'stock.variant_id IS NULL',
      input.variantId ? { variantId: input.variantId } : {},
    )
    .getOne();

  const currentQty = stock?.quantity ?? 0;
  const currentReserved = stock?.reservedQuantity ?? 0;

  if (sign < 0) {
    const available = currentQty - currentReserved;
    if (available + sign * qty < 0) {
      throw new InsufficientStockError();
    }
  } else {
    const newQty = currentQty + sign * qty;
    if (newQty < 0) {
      throw new InsufficientStockError();
    }
  }

  const newQty = currentQty + sign * qty;

  if (stock) {
    let averageCost = stock.averageCost;
    if (sign > 0 && unitCost > 0) {
      averageCost =
        stock.quantity > 0
          ? (stock.quantity * stock.averageCost + qty * unitCost) / (stock.quantity + qty)
          : unitCost;
    }
    stock.quantity = newQty;
    stock.reservedQuantity = Math.max(0, currentReserved + Math.min(0, sign * qty));
    stock.averageCost = averageCost;
    await stockRepo.save(stock);
  } else if (newQty > 0) {
    await stockRepo.save(
      stockRepo.create({
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId,
        quantity: newQty,
        reservedQuantity: 0,
        averageCost: sign > 0 ? unitCost : 0,
      }),
    );
  }

  const lotContext: LotContext = {
    tenantId: input.tenantId,
    productId: input.productId,
    variantId: input.variantId ?? null,
    warehouseId: input.warehouseId,
  };

  let lot: ProductLot | null = null;

  if (sign > 0) {
    if (input.lotNumber) {
      lot = await findOrCreateLot(manager, {
        ...lotContext,
        lotNumber: input.lotNumber,
        expiryDate: input.expiryDate,
      });
      lot.quantity = lot.quantity + qty;
      await lotsRepo.save(lot);
    } else if (input.lotId) {
      lot = await assertLotMatches(manager, input.lotId, lotContext);
      lot.quantity = lot.quantity + qty;
      await lotsRepo.save(lot);
    }
  } else if (input.lotId) {
    lot = await assertLotMatches(manager, input.lotId, lotContext);
    if (lot.quantity + sign * qty < -1e-9) {
      throw new InsufficientStockError();
    }
    lot.quantity = lot.quantity + sign * qty;
    await lotsRepo.save(lot);
  }

  if (sign < 0 && !input.lotId) {
    const movements = await consumeLotsFefo(manager, input);
    return movements[movements.length - 1];
  }

  return movementsRepo.save(
    movementsRepo.create({
      tenantId: input.tenantId,
      movementType: input.movementType,
      productId: input.productId,
      variantId: input.variantId ?? null,
      warehouseId: input.warehouseId,
      locationId: input.locationId ?? null,
      quantity: sign * qty,
      unitCost,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      userId: input.userId ?? null,
      lotId: lot?.id ?? null,
    }),
  );
}

export interface TransferStockInput {
  tenantId: string;
  productId: string;
  variantId?: string | null;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  userId?: string | null;
  notes?: string | null;
}

async function moveLotsFefo(
  manager: EntityManager,
  input: TransferStockInput,
): Promise<void> {
  if (input.quantity <= 0) {
    return;
  }
  const lotsRepo = manager.getRepository(ProductLot);
  const lots = await lotsRepo
    .createQueryBuilder('lot')
    .setLock('pessimistic_write')
    .where('lot.tenant_id = :tenantId', { tenantId: input.tenantId })
    .andWhere('lot.product_id = :productId', { productId: input.productId })
    .andWhere('lot.warehouse_id = :fromWarehouseId', { fromWarehouseId: input.fromWarehouseId })
    .andWhere(
      input.variantId ? 'lot.variant_id = :variantId' : 'lot.variant_id IS NULL',
      input.variantId ? { variantId: input.variantId } : {},
    )
    .andWhere('lot.quantity > 0')
    .orderBy('lot.expiry_date', 'ASC', 'NULLS LAST')
    .addOrderBy('lot.lot_number', 'ASC')
    .getMany();

  let remaining = input.quantity;
  for (const lot of lots) {
    if (remaining <= 0) {
      break;
    }
    const moved = Math.min(lot.quantity, remaining);
    lot.quantity = lot.quantity - moved;
    await lotsRepo.save(lot);

    let destLot = await lotsRepo.findOneBy({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId ?? IsNull(),
      warehouseId: input.toWarehouseId,
      lotNumber: lot.lotNumber,
    });
    if (!destLot) {
      destLot = lotsRepo.create({
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.toWarehouseId,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate,
        quantity: 0,
      });
    }
    destLot.quantity = destLot.quantity + moved;
    await lotsRepo.save(destLot);
    remaining -= moved;
  }
}

export async function transferStock(
  manager: EntityManager,
  input: TransferStockInput,
): Promise<{ from: StockMovement; to: StockMovement }> {
  const stockRepo = manager.getRepository(ProductStock);
  const movementsRepo = manager.getRepository(StockMovement);
  const lockByWarehouse = (warehouseId: string) =>
    stockRepo
      .createQueryBuilder('stock')
      .setLock('pessimistic_write')
      .where('stock.tenant_id = :tenantId', { tenantId: input.tenantId })
      .andWhere('stock.product_id = :productId', { productId: input.productId })
      .andWhere('stock.warehouse_id = :warehouseId', { warehouseId })
      .andWhere(
        input.variantId ? 'stock.variant_id = :variantId' : 'stock.variant_id IS NULL',
        input.variantId ? { variantId: input.variantId } : {},
      )
      .getOne();

  const origin = await lockByWarehouse(input.fromWarehouseId);
  const originQty = origin?.quantity ?? 0;
  const originReserved = origin?.reservedQuantity ?? 0;
  if (!origin || originQty - originReserved < input.quantity) {
    throw new InsufficientStockError();
  }
  const averageCost = origin.averageCost;

  origin.quantity = originQty - input.quantity;
  await stockRepo.save(origin);

  const destination = await lockByWarehouse(input.toWarehouseId);
  if (destination) {
    const destQty = destination.quantity;
    destination.quantity = destQty + input.quantity;
    destination.averageCost =
      destination.quantity > 0
        ? (destQty * destination.averageCost + input.quantity * averageCost) /
          destination.quantity
        : averageCost;
    await stockRepo.save(destination);
  } else if (input.quantity > 0) {
    await stockRepo.save(
      stockRepo.create({
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.toWarehouseId,
        quantity: input.quantity,
        reservedQuantity: 0,
        averageCost,
      }),
    );
  }

  await moveLotsFefo(manager, input);

  const base = {
    tenantId: input.tenantId,
    movementType: MovementType.TRANSFER,
    productId: input.productId,
    variantId: input.variantId ?? null,
    quantity: 0,
    unitCost: averageCost,
    referenceType: 'transfer',
    userId: input.userId ?? null,
    notes: input.notes ?? null,
  };
  const from = await movementsRepo.save(
    movementsRepo.create({
      ...base,
      warehouseId: input.fromWarehouseId,
      quantity: -input.quantity,
    }),
  );
  const to = await movementsRepo.save(
    movementsRepo.create({
      ...base,
      warehouseId: input.toWarehouseId,
      quantity: input.quantity,
    }),
  );
  return { from, to };
}

export async function reserveStock(
  manager: EntityManager,
  input: ReserveStockInput,
): Promise<void> {
  const stockRepo = manager.getRepository(ProductStock);
  const stock = await stockRepo
    .createQueryBuilder('stock')
    .setLock('pessimistic_write')
    .where('stock.tenant_id = :tenantId', { tenantId: input.tenantId })
    .andWhere('stock.product_id = :productId', { productId: input.productId })
    .andWhere('stock.warehouse_id = :warehouseId', { warehouseId: input.warehouseId })
    .andWhere(
      input.variantId ? 'stock.variant_id = :variantId' : 'stock.variant_id IS NULL',
      input.variantId ? { variantId: input.variantId } : {},
    )
    .getOne();

  const currentQty = stock?.quantity ?? 0;
  const currentReserved = stock?.reservedQuantity ?? 0;
  if (!stock || currentQty - currentReserved < input.quantity) {
    throw new InsufficientStockError();
  }
  stock.reservedQuantity = currentReserved + input.quantity;
  await stockRepo.save(stock);
}

export async function releaseStock(
  manager: EntityManager,
  input: ReserveStockInput,
): Promise<void> {
  const stockRepo = manager.getRepository(ProductStock);
  const stock = await stockRepo
    .createQueryBuilder('stock')
    .setLock('pessimistic_write')
    .where('stock.tenant_id = :tenantId', { tenantId: input.tenantId })
    .andWhere('stock.product_id = :productId', { productId: input.productId })
    .andWhere('stock.warehouse_id = :warehouseId', { warehouseId: input.warehouseId })
    .andWhere(
      input.variantId ? 'stock.variant_id = :variantId' : 'stock.variant_id IS NULL',
      input.variantId ? { variantId: input.variantId } : {},
    )
    .getOne();
  if (!stock) {
    return;
  }
  stock.reservedQuantity = Math.max(0, stock.reservedQuantity - input.quantity);
  await stockRepo.save(stock);
}
