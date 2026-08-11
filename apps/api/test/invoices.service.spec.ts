import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyStockMovement,
  Customer,
  Invoice,
  InvoiceItem,
  ProductStock,
  Tenant,
  WALK_IN_CUSTOMER,
} from '@aptifum/database';
import { InvoicesService } from '../src/modules/sales/invoices.service';
import { nextDocumentNumber } from '../src/modules/sales/helpers';

vi.mock('@aptifum/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aptifum/database')>();
  return {
    ...original,
    applyStockMovement: vi.fn(),
    postJournalEntry: vi.fn(),
  };
});

vi.mock('../src/modules/sales/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/modules/sales/helpers')>();
  return {
    ...original,
    nextDocumentNumber: vi.fn(),
  };
});

const TENANT = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.mocked(applyStockMovement).mockReset();
  vi.mocked(applyStockMovement).mockResolvedValue({} as never);
  vi.mocked(nextDocumentNumber).mockReset();
  vi.mocked(nextDocumentNumber).mockResolvedValue({
    number: 'INV-000001',
    seriesId: 'sr1',
  });
});

function buildService(repos: Record<string, Record<string, unknown>>) {
  return new InvoicesService(
    (repos.invoice ?? {}) as never,
    (repos.warehouse ?? {}) as never,
    (repos.product ?? {}) as never,
    (repos.variant ?? {}) as never,
    (repos.idempotency ?? {}) as never,
    (repos.dataSource ?? {}) as never,
    (repos.outbox ?? {}) as never,
    (repos.exchangeRates ?? { resolveRate: vi.fn().mockResolvedValue(1) }) as never,
  );
}

function buildManager(repos: Record<string, Record<string, unknown>>) {
  return {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === Invoice) return repos.invoice;
      if (entity === InvoiceItem) return repos.item;
      if (entity === Customer) return repos.customer;
      if (entity === ProductStock) return repos.stock;
      if (entity === Tenant)
        return (
          repos.tenant ?? { findOneBy: vi.fn().mockResolvedValue({ defaultCurrency: 'USD' }) }
        );
      throw new Error(`Unexpected repository: ${String(entity)}`);
    }),
  };
}

function buildTransaction(repos: Record<string, Record<string, unknown>>) {
  const manager = buildManager(repos);
  return {
    transaction: vi.fn((fn: (m: typeof manager) => unknown) => fn(manager)),
    manager,
  };
}

const invoiceRepo = (customerId = 'walkin') => ({
  create: vi.fn((x: unknown) => x),
  save: vi.fn((x: object) => Promise.resolve({ ...x, id: 'inv-1' })),
  findOne: vi.fn().mockResolvedValue({ id: 'inv-1', customerId }),
});

function baseRepos(overrides: Record<string, Record<string, unknown>> = {}) {
  return {
    invoice: overrides.invoice ?? invoiceRepo(),
    item: { create: vi.fn((x: unknown) => x) },
    customer:
      overrides.customer ?? { findOneBy: vi.fn().mockResolvedValue(null) },
    stock: { findOneBy: vi.fn().mockResolvedValue(null) },
    warehouse:
      overrides.warehouse ??
      { findOneBy: vi.fn().mockResolvedValue({ id: 'w1', name: 'Main' }) },
    product: {
      findBy: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Espresso', salePrice: 10, sku: 'SKU-1' },
      ]),
    },
    outbox: overrides.outbox ?? { emit: vi.fn().mockResolvedValue(undefined) },
  };
}

const directDto = {
  warehouseId: 'w1',
  items: [{ productId: 'p1', quantity: 2, unitPrice: 10, taxRate: 0.08 }],
};

describe('InvoicesService direct invoice customer resolution', () => {
  it('requires a tenant', async () => {
    const service = buildService({});
    await expect(service.create(null, 'u1', directDto as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a direct invoice without warehouseId or items', async () => {
    const service = buildService({});
    await expect(service.create(TENANT, 'u1', {} as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown warehouse', async () => {
    const repos = baseRepos({
      warehouse: { findOneBy: vi.fn().mockResolvedValue(null) },
    });
    const service = buildService(repos);
    await expect(service.create(TENANT, 'u1', directDto as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a walk-in customer when customerId is omitted', async () => {
    const customerRepo = {
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: object) => Promise.resolve({ ...x, id: 'walkin' })),
    };
    const repos = baseRepos({ customer: customerRepo });
    const dataSource = buildTransaction(repos);
    const service = buildService({ ...repos, dataSource });

    const result = await service.create(TENANT, 'u1', directDto as never);

    expect(customerRepo.findOneBy).toHaveBeenCalledWith({
      code: WALK_IN_CUSTOMER.code,
      tenantId: TENANT,
    });
    expect(customerRepo.save).toHaveBeenCalled();
    expect((repos.invoice.create as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject(
      expect.objectContaining({
        customerId: 'walkin',
        currency: WALK_IN_CUSTOMER.currency,
        number: 'INV-000001',
      }),
    );
    expect(result).toMatchObject({ id: 'inv-1', number: 'INV-000001' });
  });

  it('reuses an existing walk-in customer', async () => {
    const customerRepo = {
      findOneBy: vi.fn().mockResolvedValue({
        id: 'walkin',
        code: WALK_IN_CUSTOMER.code,
        tradeName: WALK_IN_CUSTOMER.tradeName,
        currency: WALK_IN_CUSTOMER.currency,
      }),
      save: vi.fn(),
      create: vi.fn(),
    };
    const repos = baseRepos({ customer: customerRepo });
    const dataSource = buildTransaction(repos);
    const service = buildService({ ...repos, dataSource });

    await service.create(TENANT, 'u1', directDto as never);

    expect(customerRepo.save).not.toHaveBeenCalled();
    expect(customerRepo.create).not.toHaveBeenCalled();
    expect((repos.invoice.create as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject(
      expect.objectContaining({ customerId: 'walkin' }),
    );
  });

  it('rejects an explicit customer that does not belong to the tenant', async () => {
    const customerRepo = { findOneBy: vi.fn().mockResolvedValue(null) };
    const repos = baseRepos({ customer: customerRepo });
    const dataSource = buildTransaction(repos);
    const service = buildService({ ...repos, dataSource });

    await expect(
      service.create(TENANT, 'u1', { ...directDto, customerId: 'c1' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(customerRepo.findOneBy).toHaveBeenCalledWith({
      id: 'c1',
      tenantId: TENANT,
    });
  });
});
