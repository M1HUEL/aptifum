import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProductStock } from '@aptifum/database';
import { OrdersService } from '../src/modules/sales/orders.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function mockQueryBuilder(getOneResult: unknown) {
  const qb = {
    setLock: vi.fn(() => qb),
    where: vi.fn(() => qb),
    andWhere: vi.fn(() => qb),
    getOne: vi.fn().mockResolvedValue(getOneResult),
  };
  return qb;
}

function buildService(
  ordersRepo: Record<string, unknown>,
  extras: {
    stock?: Record<string, unknown> | null;
    salesOrderRepo?: Record<string, unknown>;
  } = {},
) {
  const stock = extras.stock ?? { quantity: 100, reservedQuantity: 0 };
  const stockRepo = {
    createQueryBuilder: vi.fn(() => mockQueryBuilder(stock)),
    save: vi.fn((s: unknown) => Promise.resolve(s)),
  };
  const salesOrderRepo = extras.salesOrderRepo ?? {
    save: vi.fn((o: unknown) => Promise.resolve(o)),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) =>
      entity === ProductStock ? stockRepo : salesOrderRepo,
    ),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(manager)),
  };
  const ordersRepoWithSave = {
    save: vi.fn((o: unknown) => Promise.resolve(o)),
    ...ordersRepo,
  };
  const service = new OrdersService(
    ordersRepoWithSave as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    dataSource as never,
  );
  return { service, stockRepo, salesOrderRepo };
}

describe('OrdersService confirm', () => {
  it('reserves stock for order items when confirming an order', async () => {
    const order = {
      id: 'o1',
      tenantId: TENANT,
      kind: 'order',
      status: 'draft',
      warehouseId: 'w1',
      items: [{ productId: 'p1', quantity: 5 }],
    };
    const { service, stockRepo } = buildService({ findOne: vi.fn().mockResolvedValue(order) });
    const result = await service.confirm(TENANT, 'o1');
    expect(stockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 100, reservedQuantity: 5 }),
    );
    expect(result.status).toBe('confirmed');
  });

  it('throws 400 when stock is insufficient for a reserved item', async () => {
    const order = {
      id: 'o1',
      tenantId: TENANT,
      kind: 'order',
      status: 'draft',
      warehouseId: 'w1',
      items: [{ productId: 'p1', quantity: 200 }],
    };
    const { service } = buildService(
      { findOne: vi.fn().mockResolvedValue(order) },
      { stock: { quantity: 100, reservedQuantity: 0 } },
    );
    await expect(service.confirm(TENANT, 'o1')).rejects.toThrow(BadRequestException);
  });

  it('does not reserve stock when confirming a quote', async () => {
    const order = {
      id: 'o1',
      tenantId: TENANT,
      kind: 'quote',
      status: 'draft',
      items: [{ productId: 'p1', quantity: 5 }],
    };
    const { service, stockRepo } = buildService({ findOne: vi.fn().mockResolvedValue(order) });
    await service.confirm(TENANT, 'o1');
    expect(stockRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects confirming a non-draft order', async () => {
    const { service } = buildService({
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        kind: 'order',
        status: 'confirmed',
        items: [],
      }),
    });
    await expect(service.confirm(TENANT, 'o1')).rejects.toThrow(ConflictException);
  });
});

describe('OrdersService cancel', () => {
  it('releases reserved stock when cancelling a confirmed order', async () => {
    const order = {
      id: 'o1',
      tenantId: TENANT,
      kind: 'order',
      status: 'confirmed',
      warehouseId: 'w1',
      items: [{ productId: 'p1', quantity: 5 }],
    };
    const { service, stockRepo } = buildService(
      { findOne: vi.fn().mockResolvedValue(order) },
      { stock: { quantity: 100, reservedQuantity: 5 } },
    );
    const result = await service.cancel(TENANT, 'o1');
    expect(stockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 100, reservedQuantity: 0 }),
    );
    expect(result.status).toBe('cancelled');
  });

  it('does not release stock when cancelling a draft order', async () => {
    const order = {
      id: 'o1',
      tenantId: TENANT,
      kind: 'order',
      status: 'draft',
      items: [{ productId: 'p1', quantity: 5 }],
    };
    const { service, stockRepo } = buildService({ findOne: vi.fn().mockResolvedValue(order) });
    await service.cancel(TENANT, 'o1');
    expect(stockRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects cancelling an invoiced order', async () => {
    const { service } = buildService({
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        kind: 'order',
        status: 'invoiced',
        items: [],
      }),
    });
    await expect(service.cancel(TENANT, 'o1')).rejects.toThrow(ConflictException);
  });
});
