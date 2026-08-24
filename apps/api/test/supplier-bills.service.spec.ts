import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupplierBillStatus } from '@aptifum/core';
import {
  ChartAccountNotFoundError,
  GoodsReceipt,
  JournalEntryUnbalancedError,
  nextDocumentNumber,
  postJournalEntry,
  Supplier,
  SupplierBill,
  SupplierBillItem,
  Tenant,
} from '@aptifum/database';

import { SupplierBillsService } from '../src/modules/purchasing/supplier-bills.service';

vi.mock('@aptifum/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aptifum/database')>();
  return {
    ...original,
    postJournalEntry: vi.fn(),
    nextDocumentNumber: vi.fn(),
  };
});

const TENANT = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.mocked(postJournalEntry).mockReset();
  vi.mocked(postJournalEntry).mockResolvedValue({ id: 'je1' } as never);
  vi.mocked(nextDocumentNumber).mockReset();
  vi.mocked(nextDocumentNumber).mockResolvedValue({ number: 'SB-0001', seriesId: 'sr1' });
});

function buildService(billsRepo: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return new SupplierBillsService(
    billsRepo as never,
    (extras.dataSource ?? {}) as never,
    (extras.outbox ?? {}) as never,
    (extras.exchangeRates ?? { resolveRate: vi.fn().mockResolvedValue(1) }) as never,
  );
}

function buildManager(repos: Record<string, Record<string, unknown>>) {
  return {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === SupplierBill) return repos.bill;
      if (entity === Supplier) return repos.supplier;
      if (entity === GoodsReceipt) return repos.receipt;
      if (entity === SupplierBillItem) return repos.item;
      if (entity === Tenant) {
        return { findOneBy: vi.fn().mockResolvedValue({ defaultCurrency: 'USD' }) };
      }
      throw new Error(`Unexpected repository: ${String(entity)}`);
    }),
  };
}

function buildDataSource(repos: Record<string, Record<string, unknown>>) {
  const manager = buildManager(repos);
  return {
    dataSource: { transaction: vi.fn((fn: (m: typeof manager) => unknown) => fn(manager)) },
    manager,
    repos,
  };
}

const draftDto = {
  supplierId: 's1',
  receiptId: 'r1',
  currency: 'USD',
  items: [{ productId: 'p1', description: 'Widget', quantity: 10, unitPrice: 2, taxRate: 0.1 }],
};

describe('SupplierBillsService create', () => {
  it('requires a tenant', async () => {
    const service = buildService({});
    await expect(service.create(null, 'u1', draftDto as never)).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown supplier', async () => {
    const { dataSource } = buildDataSource({
      bill: { findOneBy: vi.fn(), create: vi.fn(), save: vi.fn() },
      supplier: { findOneBy: vi.fn().mockResolvedValue(null) },
      receipt: { findOneBy: vi.fn() },
      item: { create: vi.fn() },
    });
    const service = buildService({}, { dataSource });
    await expect(service.create(TENANT, 'u1', draftDto as never)).rejects.toThrow(NotFoundException);
  });

  it('rejects a receipt from a different supplier', async () => {
    const { dataSource } = buildDataSource({
      bill: { findOneBy: vi.fn(), create: vi.fn(), save: vi.fn() },
      supplier: { findOneBy: vi.fn().mockResolvedValue({ id: 's1', currency: 'USD' }) },
      receipt: { findOneBy: vi.fn().mockResolvedValue({ id: 'r1', supplierId: 's9' }) },
      item: { create: vi.fn() },
    });
    const service = buildService({}, { dataSource });
    await expect(service.create(TENANT, 'u1', draftDto as never)).rejects.toThrow(BadRequestException);
  });

  it('rejects a second draft for the same receipt', async () => {
    const { dataSource } = buildDataSource({
      bill: {
        findOneBy: vi.fn().mockResolvedValue({ id: 'b1', status: SupplierBillStatus.DRAFT }),
        create: vi.fn(),
        save: vi.fn(),
      },
      supplier: { findOneBy: vi.fn().mockResolvedValue({ id: 's1', currency: 'USD' }) },
      receipt: { findOneBy: vi.fn().mockResolvedValue({ id: 'r1', supplierId: 's1' }) },
      item: { create: vi.fn() },
    });
    const service = buildService({}, { dataSource });
    await expect(service.create(TENANT, 'u1', draftDto as never)).rejects.toThrow(BadRequestException);
  });

  it('computes totals, line totals and returns the bill view', async () => {
    const view = { id: 'b1', tenantId: TENANT, status: SupplierBillStatus.DRAFT };
    const billRepo = {
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: unknown) => Promise.resolve({ ...(x as object), id: 'b1' })),
      findOne: vi.fn().mockResolvedValue(view),
    };
    const itemRepo = { create: vi.fn((x: unknown) => x) };
    const { dataSource } = buildDataSource({
      bill: billRepo,
      supplier: { findOneBy: vi.fn().mockResolvedValue({ id: 's1', currency: 'USD' }) },
      receipt: { findOneBy: vi.fn().mockResolvedValue({ id: 'r1', supplierId: 's1' }) },
      item: itemRepo,
    });
    const service = buildService({}, { dataSource });
    const result = await service.create(TENANT, 'u1', draftDto as never);
    expect(result).toBe(view);
    expect(billRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        supplierId: 's1',
        receiptId: 'r1',
        status: SupplierBillStatus.DRAFT,
        subtotal: 20,
        tax: 2,
        total: 22,
        paidAmount: 0,
        balanceDue: 22,
      }),
    );
    expect(itemRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 10, unitPrice: 2, taxRate: 0.1, lineTotal: 22 }),
    );
  });
});

describe('SupplierBillsService issue', () => {
  const issuedView = { id: 'b1', tenantId: TENANT, status: SupplierBillStatus.ISSUED };

  function build(data: { total: number; receiptAmount?: number; outbox?: { emit: ReturnType<typeof vi.fn> } }) {
    const bill = {
      id: 'b1',
      tenantId: TENANT,
      supplierId: 's1',
      number: null,
      status: SupplierBillStatus.DRAFT,
      billDate: '2026-08-01',
      dueDate: null,
      currency: 'USD',
      total: data.total,
      receiptId: 'r1',
      supplier: { id: 's1' },
    };
    const billRepo = {
      findOne: vi.fn().mockResolvedValue(bill),
      save: vi.fn((x: unknown) => Promise.resolve({ ...(x as object), id: 'b1' })),
    };
    const managerBill = {
      findOne: vi.fn().mockResolvedValue(issuedView),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const { dataSource, repos } = buildDataSource({
      bill: managerBill,
      supplier: { findOneBy: vi.fn() },
      receipt: {
        findOne: vi.fn().mockResolvedValue({
          id: 'r1',
          items: [{ quantity: 10, unitCost: (data.receiptAmount ?? 10) / 10 }],
        }),
      },
      item: { create: vi.fn() },
    });
    const outbox = data.outbox ?? { emit: vi.fn().mockResolvedValue(undefined) };
    const service = buildService(billRepo, { dataSource, outbox });
    return { service, bill, managerBill, outbox, repos };
  }

  it('requires a draft bill', async () => {
    const billRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'b1', tenantId: TENANT, status: 'issued' }),
    };
    const service = buildService(billRepo);
    await expect(service.issue(TENANT, 'u1', 'b1')).rejects.toThrow(BadRequestException);
  });

  it('posts the variance as Dr COGS / Cr AP when bill exceeds the receipt', async () => {
    const { service, managerBill, outbox } = build({ total: 22, receiptAmount: 10 });
    await service.issue(TENANT, 'u1', 'b1');
    expect(postJournalEntry).toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      expect.objectContaining({
        referenceType: 'supplier_bill',
        referenceId: 'b1',
        lines: [
          { accountCode: '5000', debit: 12 },
          { accountCode: '2000', credit: 12 },
        ],
      }),
    );
    expect(managerBill.save).toHaveBeenCalledWith(
      expect.objectContaining({ number: 'SB-0001', status: SupplierBillStatus.ISSUED }),
    );
    expect(outbox.emit).toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      expect.objectContaining({ eventType: 'supplier_bill.issued', aggregateId: 'b1' }),
    );
  });

  it('posts the inverse entry when the receipt exceeds the bill', async () => {
    const { service } = build({ total: 10, receiptAmount: 30 });
    await service.issue(TENANT, 'u1', 'b1');
    expect(postJournalEntry).toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      expect.objectContaining({
        lines: [
          { accountCode: '2000', debit: 20 },
          { accountCode: '5000', credit: 20 },
        ],
      }),
    );
  });

  it('does not post a journal entry when the bill equals the receipt', async () => {
    const { service } = build({ total: 10, receiptAmount: 10 });
    await service.issue(TENANT, 'u1', 'b1');
    expect(postJournalEntry).not.toHaveBeenCalled();
  });

  it('maps missing chart accounts to a bad request', async () => {
    vi.mocked(postJournalEntry).mockRejectedValue(new ChartAccountNotFoundError('Account 5000 missing'));
    const { service } = build({ total: 22, receiptAmount: 10 });
    await expect(service.issue(TENANT, 'u1', 'b1')).rejects.toThrow(BadRequestException);
  });

  it('maps unbalanced entries to a conflict', async () => {
    vi.mocked(postJournalEntry).mockRejectedValue(new JournalEntryUnbalancedError(12, 12));
    const { service } = build({ total: 22, receiptAmount: 10 });
    await expect(service.issue(TENANT, 'u1', 'b1')).rejects.toThrow(ConflictException);
  });
});

describe('SupplierBillsService cancel', () => {
  it('cancels a draft bill', async () => {
    const bill = { id: 'b1', status: SupplierBillStatus.DRAFT };
    const billsRepo = {
      findOne: vi.fn().mockResolvedValue(bill),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = buildService(billsRepo);
    await service.cancel(TENANT, 'b1');
    expect(bill.status).toBe(SupplierBillStatus.CANCELLED);
    expect(billsRepo.save).toHaveBeenCalledWith(bill);
  });

  it('rejects cancelling an issued bill', async () => {
    const billsRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'b1', status: SupplierBillStatus.ISSUED }),
      save: vi.fn(),
    };
    const service = buildService(billsRepo);
    await expect(service.cancel(TENANT, 'b1')).rejects.toThrow(BadRequestException);
    expect(billsRepo.save).not.toHaveBeenCalled();
  });
});

describe('SupplierBillsService findAll', () => {
  it('paginates with supplier filter and relations', async () => {
    const billsRepo = {
      findAndCount: vi.fn().mockResolvedValue([[{ id: 'b1' }], 1]),
    };
    const service = buildService(billsRepo);
    const result = await service.findAll(TENANT, 1, 25, 's1');
    expect(result).toEqual({ data: [{ id: 'b1' }], meta: { page: 1, limit: 25, total: 1 } });
    expect(billsRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, supplierId: 's1' }),
        skip: 0,
        take: 25,
        relations: { supplier: true, items: true },
      }),
    );
  });
});
