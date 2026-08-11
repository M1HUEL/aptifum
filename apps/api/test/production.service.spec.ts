import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BomsService } from '../src/modules/production/boms.service';
import { ProductionOrdersService } from '../src/modules/production/production-orders.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function buildOrdersService(
  ordersRepo: Record<string, unknown>,
  extras: Record<string, unknown> = {},
) {
  return new ProductionOrdersService(
    ordersRepo as never,
    (extras.bomsRepo ?? {}) as never,
    (extras.productsRepo ?? {}) as never,
    (extras.warehousesRepo ?? {}) as never,
    (extras.tenantsRepo ?? {}) as never,
    (extras.dataSource ?? {}) as never,
    (extras.outbox ?? {}) as never,
  );
}

describe('ProductionOrdersService start', () => {
  it('starts a planned order', async () => {
    const order = { id: 'o1', status: 'planned' };
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue(order),
      save: vi.fn((o: unknown) => Promise.resolve(o)),
    };
    const service = buildOrdersService(ordersRepo);
    await service.start(TENANT, 'o1');
    expect(order.status).toBe('in_progress');
  });

  it('rejects starting a non-planned order', async () => {
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'completed' }),
      save: vi.fn(),
    };
    const service = buildOrdersService(ordersRepo);
    await expect(service.start(TENANT, 'o1')).rejects.toThrow(BadRequestException);
    expect(ordersRepo.save).not.toHaveBeenCalled();
  });
});

describe('ProductionOrdersService update', () => {
  it('only allows editing planned orders', async () => {
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'in_progress' }),
      save: vi.fn(),
    };
    const service = buildOrdersService(ordersRepo);
    await expect(service.update(TENANT, 'o1', { quantity: 5 })).rejects.toThrow(
      BadRequestException,
    );
    expect(ordersRepo.save).not.toHaveBeenCalled();
  });

  it('applies editable fields on a planned order', async () => {
    const order = { id: 'o1', status: 'planned', quantity: 1, laborCost: 0, overhead: 0, notes: null };
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue(order),
      save: vi.fn((o: unknown) => Promise.resolve(o)),
    };
    const service = buildOrdersService(ordersRepo);
    await service.update(TENANT, 'o1', { quantity: 7, laborCost: 10, overhead: 2, notes: 'x' });
    expect(order).toMatchObject({ quantity: 7, laborCost: 10, overhead: 2, notes: 'x' });
  });
});

describe('ProductionOrdersService cancel', () => {
  it('cancels a planned or in-progress order', async () => {
    for (const status of ['planned', 'in_progress']) {
      const order = { id: 'o1', status };
      const ordersRepo = {
        findOne: vi.fn().mockResolvedValue(order),
        save: vi.fn((o: unknown) => Promise.resolve(o)),
      };
      const service = buildOrdersService(ordersRepo);
      await service.cancel(TENANT, 'o1');
      expect(order.status).toBe('cancelled');
    }
  });

  it('rejects cancelling a completed order', async () => {
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'completed' }),
    };
    const service = buildOrdersService(ordersRepo);
    await expect(service.cancel(TENANT, 'o1')).rejects.toThrow(BadRequestException);
  });
});

describe('ProductionOrdersService complete', () => {
  it('only allows completing in-progress orders', async () => {
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'planned' }),
    };
    const service = buildOrdersService(ordersRepo);
    await expect(service.complete(TENANT, 'u1', 'o1')).rejects.toThrow(BadRequestException);
  });

  it('requires a tenant', async () => {
    const service = buildOrdersService({});
    await expect(service.complete(null, 'u1', 'o1')).rejects.toThrow(BadRequestException);
  });
});

describe('ProductionOrdersService create', () => {
  it('rejects a BOM that does not produce the requested product', async () => {
    const extras = {
      productsRepo: { findOneBy: vi.fn().mockResolvedValue({ id: 'p1' }) },
      warehousesRepo: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      bomsRepo: { findOneBy: vi.fn().mockResolvedValue({ id: 'b1', productId: 'p2' }) },
    };
    const service = buildOrdersService({}, extras);
    await expect(
      service.create(TENANT, { productId: 'p1', bomId: 'b1', quantity: 5, warehouseId: 'w1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when the BOM does not exist', async () => {
    const extras = {
      productsRepo: { findOneBy: vi.fn().mockResolvedValue({ id: 'p1' }) },
      warehousesRepo: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      bomsRepo: { findOneBy: vi.fn().mockResolvedValue(null) },
    };
    const service = buildOrdersService({}, extras);
    await expect(
      service.create(TENANT, { productId: 'p1', bomId: 'b1', quantity: 5, warehouseId: 'w1' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('BomsService create validation', () => {
  it('rejects a component that is the finished product itself', async () => {
    const service = new BomsService({} as never, {} as never, {} as never, {} as never);
    await expect(
      service.create(TENANT, {
        name: 'BOM',
        productId: 'p1',
        lines: [{ productId: 'p1', quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when a component product does not exist', async () => {
    const productsRepo = { findBy: vi.fn().mockResolvedValue([{ id: 'p1' }]) };
    const service = new BomsService({} as never, {} as never, productsRepo as never, {} as never);
    await expect(
      service.create(TENANT, {
        name: 'BOM',
        productId: 'p9',
        lines: [
          { productId: 'p1', quantity: 1 },
          { productId: 'p2', quantity: 2 },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('requires a tenant', async () => {
    const service = new BomsService({} as never, {} as never, {} as never, {} as never);
    await expect(
      service.create(null, {
        name: 'BOM',
        productId: 'p1',
        lines: [{ productId: 'p2', quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
