import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PurchaseOrdersService } from '../src/modules/purchasing/purchase-orders.service';
import { SuppliersService } from '../src/modules/purchasing/suppliers.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function buildOrdersService(ordersRepo: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return new PurchaseOrdersService(
    ordersRepo as never,
    (extras.suppliersRepo ?? {}) as never,
    (extras.warehousesRepo ?? {}) as never,
    (extras.productsRepo ?? {}) as never,
    (extras.receiptsRepo ?? {}) as never,
    (extras.dataSource ?? {}) as never,
    (extras.outbox ?? {}) as never,
  );
}

describe('PurchaseOrdersService approval', () => {
  it('approves a draft order', async () => {
    const order = { id: 'o1', tenantId: TENANT, status: 'draft' };
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue(order),
      save: vi.fn((o: unknown) => Promise.resolve(o)),
    };
    const service = buildOrdersService(ordersRepo);
    await service.approve(TENANT, 'o1');
    expect(order.status).toBe('approved');
    expect(ordersRepo.save).toHaveBeenCalledWith(order);
  });

  it('rejects approving a non-draft order', async () => {
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'received' }),
      save: vi.fn(),
    };
    const service = buildOrdersService(ordersRepo);
    await expect(service.approve(TENANT, 'o1')).rejects.toThrow(BadRequestException);
    expect(ordersRepo.save).not.toHaveBeenCalled();
  });
});

describe('PurchaseOrdersService cancel', () => {
  it('cancels a draft order', async () => {
    const order = { id: 'o1', status: 'draft' };
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue(order),
      save: vi.fn((o: unknown) => Promise.resolve(o)),
    };
    const service = buildOrdersService(ordersRepo);
    await service.cancel(TENANT, 'o1');
    expect(order.status).toBe('cancelled');
  });

  it('cancels an approved order', async () => {
    const order = { id: 'o1', status: 'approved' };
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue(order),
      save: vi.fn((o: unknown) => Promise.resolve(o)),
    };
    const service = buildOrdersService(ordersRepo);
    await service.cancel(TENANT, 'o1');
    expect(order.status).toBe('cancelled');
  });

  it('rejects cancelling a received order', async () => {
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'received' }),
    };
    const service = buildOrdersService(ordersRepo);
    await expect(service.cancel(TENANT, 'o1')).rejects.toThrow(BadRequestException);
  });
});

describe('PurchaseOrdersService receive', () => {
  const approvedOrder = {
    id: 'o1',
    tenantId: TENANT,
    status: 'approved',
    supplierId: 's1',
    warehouseId: 'w1',
    currency: 'USD',
    items: [{ id: 'i1', productId: 'p1', quantity: 10, receivedQuantity: 0, unitCost: 2 }],
  };

  it('requires a tenant', async () => {
    const service = buildOrdersService({});
    await expect(service.receive(null, 'u1', 'o1', { items: [] })).rejects.toThrow(BadRequestException);
  });

  it('only allows receiving approved orders', async () => {
    const ordersRepo = {
      findOne: vi.fn().mockResolvedValue({ ...approvedOrder, status: 'draft' }),
    };
    const service = buildOrdersService(ordersRepo);
    await expect(service.receive(TENANT, 'u1', 'o1', { items: [{ orderItemId: 'i1', quantity: 1 }] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown order item', async () => {
    const ordersRepo = { findOne: vi.fn().mockResolvedValue(approvedOrder) };
    const service = buildOrdersService(ordersRepo);
    await expect(
      service.receive(TENANT, 'u1', 'o1', { items: [{ orderItemId: 'nope', quantity: 1 }] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects receiving more than the remaining quantity', async () => {
    const ordersRepo = { findOne: vi.fn().mockResolvedValue(approvedOrder) };
    const service = buildOrdersService(ordersRepo);
    await expect(service.receive(TENANT, 'u1', 'o1', { items: [{ orderItemId: 'i1', quantity: 11 }] })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('SuppliersService create', () => {
  it('requires a tenant', async () => {
    const suppliersRepo = { create: vi.fn(), save: vi.fn() };
    const service = new SuppliersService(suppliersRepo as never);
    await expect(service.create(null, { code: 'S1', tradeName: 'Acme' } as never)).rejects.toThrow(BadRequestException);
  });

  it('defaults currency and active when omitted', async () => {
    const suppliersRepo = {
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = new SuppliersService(suppliersRepo as never);
    const result = await service.create(TENANT, {
      code: 'S1',
      tradeName: 'Acme',
    } as never);
    expect(result).toMatchObject({ code: 'S1', currency: 'USD', active: true });
  });
});
