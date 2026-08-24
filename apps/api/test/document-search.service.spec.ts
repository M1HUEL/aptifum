import { describe, expect, it, vi } from 'vitest';

import { PurchaseOrdersService } from '../src/modules/purchasing/purchase-orders.service';
import { InvoicesService } from '../src/modules/sales/invoices.service';
import { OrdersService } from '../src/modules/sales/orders.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function qbChain(ids: string[]) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))),
  };
}

function whereIdOf(repo: { findAndCount: ReturnType<typeof vi.fn> }): { _type: string; _value: string[] } {
  const args = repo.findAndCount.mock.calls[0][0];
  return (args.where as { id: unknown }).id as { _type: string; _value: string[] };
}

describe('document search (q) on invoices', () => {
  it('matches customer trade name and combines with status/type filters', async () => {
    const qb = qbChain(['inv-1']);
    const invoicesRepo = {
      createQueryBuilder: vi.fn(() => qb),
      findAndCount: vi.fn().mockResolvedValue([[{ id: 'inv-1', number: 'INV-000001' }], 1]),
    };
    const service = new InvoicesService(
      invoicesRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.findAll(TENANT, 1, 20, {
      q: 'Cafe',
      status: 'issued',
      type: 'invoice',
    });

    expect(result.meta.total).toBe(1);
    expect(invoicesRepo.createQueryBuilder).toHaveBeenCalledWith('d');
    expect(qb.andWhere.mock.calls[0][0]).toContain('customers');
    expect(qb.andWhere.mock.calls[0][0]).toContain('invoice_items');
    const whereId = whereIdOf(invoicesRepo);
    expect(whereId._type).toBe('in');
    expect(whereId._value).toEqual(['inv-1']);
    const args = invoicesRepo.findAndCount.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.tenantId).toBe(TENANT);
    expect(args.where.status).toBe('issued');
    expect(args.where.type).toBe('invoice');
  });

  it('returns empty when no ids match and skips findAndCount', async () => {
    const qb = qbChain([]);
    const invoicesRepo = {
      createQueryBuilder: vi.fn(() => qb),
      findAndCount: vi.fn(),
    };
    const service = new InvoicesService(
      invoicesRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.findAll(TENANT, 1, 20, { q: 'nomatch' });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(invoicesRepo.findAndCount).not.toHaveBeenCalled();
  });

  it('does not expand the search when q is omitted', async () => {
    const invoicesRepo = {
      createQueryBuilder: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[{ id: 'inv-1' }], 1]),
    };
    const service = new InvoicesService(
      invoicesRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.findAll(TENANT, 1, 20, {});

    expect(invoicesRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(invoicesRepo.findAndCount).toHaveBeenCalledTimes(1);
  });
});

describe('document search (q) on sales orders', () => {
  it('searches quotes/orders by product name in lines', async () => {
    const qb = qbChain(['ord-1']);
    const ordersRepo = {
      createQueryBuilder: vi.fn(() => qb),
      findAndCount: vi.fn().mockResolvedValue([[{ id: 'ord-1', number: 'ORD-000001' }], 1]),
    };
    const service = new OrdersService(
      ordersRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.findAll(TENANT, 1, 20, { q: 'Espresso', kind: 'order' });

    expect(result.meta.total).toBe(1);
    expect(qb.andWhere.mock.calls[0][0]).toContain('sales_order_items');
    expect(whereIdOf(ordersRepo)._value).toEqual(['ord-1']);
    const args = ordersRepo.findAndCount.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.kind).toBe('order');
  });
});

describe('document search (q) on purchase orders', () => {
  it('matches supplier trade name and product sku', async () => {
    const qb = qbChain(['po-1']);
    const ordersRepo = {
      createQueryBuilder: vi.fn(() => qb),
      findAndCount: vi.fn().mockResolvedValue([[{ id: 'po-1', number: 'PO-000001' }], 1]),
    };
    const service = new PurchaseOrdersService(
      ordersRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.findAll(TENANT, 1, 20, { q: 'Sparkle' });

    expect(result.meta.total).toBe(1);
    const sql = qb.andWhere.mock.calls[0][0] as string;
    expect(sql).toContain('suppliers');
    expect(sql).toContain('purchase_order_items');
    expect(whereIdOf(ordersRepo)._value).toEqual(['po-1']);
  });
});
