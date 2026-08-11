import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierPaymentsService } from '../src/modules/purchasing/supplier-payments.service';
import { Supplier, SupplierBill, SupplierPayment, postJournalEntry } from '@aptifum/database';
import { SupplierBillStatus } from '@aptifum/core';

vi.mock('@aptifum/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aptifum/database')>();
  return { ...original, postJournalEntry: vi.fn() };
});

const TENANT = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.mocked(postJournalEntry).mockResolvedValue({ id: 'je1' } as never);
});

function buildService(paymentsRepo: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return new SupplierPaymentsService(
    paymentsRepo as never,
    (extras.suppliersRepo ?? {}) as never,
    (extras.billsRepo ?? {}) as never,
    (extras.dataSource ?? {}) as never,
  );
}

function buildDataSource() {
  const repos = {
    supplier: {
      findOneBy: vi.fn().mockResolvedValue({ id: 's1', currency: 'USD' }),
    },
    bill: {
      findOneBy: vi.fn(),
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    },
    payment: {
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: unknown) =>
        Promise.resolve({ ...(x as Record<string, unknown>), id: 'p1' }),
      ),
      findOne: vi.fn().mockResolvedValue({ id: 'p1', supplierId: 's1' }),
    },
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === Supplier) return repos.supplier;
      if (entity === SupplierBill) return repos.bill;
      if (entity === SupplierPayment) return repos.payment;
      throw new Error(`Unexpected repository: ${String(entity)}`);
    }),
  };
  const dataSource = {
    transaction: vi.fn((fn: (m: typeof manager) => unknown) => fn(manager)),
  };
  return { dataSource, manager, repos };
}

describe('SupplierPaymentsService record', () => {
  const dto = {
    supplierId: 's1',
    method: 'cash',
    amount: 100,
  };

  it('requires a tenant', async () => {
    const service = buildService({});
    await expect(service.record(null, 'u1', dto as never)).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown supplier', async () => {
    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === Supplier) {
          return { findOneBy: vi.fn().mockResolvedValue(null) };
        }
        throw new Error(`Unexpected repository: ${String(entity)}`);
      }),
    };
    const dataSource = { transaction: vi.fn((fn: (m: typeof manager) => unknown) => fn(manager)) };
    const service = buildService({}, { dataSource });
    await expect(service.record(TENANT, 'u1', dto as never)).rejects.toThrow(NotFoundException);
  });

  it('records a payment with journal entry Dr AP / Cr CASH', async () => {
    const { dataSource, repos } = buildDataSource();
    const service = buildService({}, { dataSource });
    const result = await service.record(TENANT, 'u1', dto as never);
    expect(result).toMatchObject({ id: 'p1', supplierId: 's1' });
    expect(repos.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, supplierId: 's1', amount: 100 }),
    );
    expect(repos.payment.save).toHaveBeenCalled();
    expect(postJournalEntry).toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      expect.objectContaining({
        referenceType: 'supplier_payment',
        lines: [
          { accountCode: '2000', debit: 100 },
          { accountCode: '1000', credit: 100 },
        ],
      }),
    );
  });

  it('defaults paidAt when omitted', async () => {
    const { dataSource, repos } = buildDataSource();
    const service = buildService({}, { dataSource });
    await service.record(TENANT, 'u1', dto as never);
    const created = repos.payment.create.mock.calls[0][0] as Record<string, unknown>;
    expect(created.paidAt).toBeInstanceOf(Date);
  });

  describe('with billId', () => {
    function issuedBill(overrides: Record<string, unknown> = {}) {
      return {
        id: 'b1',
        tenantId: TENANT,
        supplierId: 's1',
        number: 'SB-0001',
        status: SupplierBillStatus.ISSUED,
        paidAmount: 0,
        balanceDue: 250,
        ...overrides,
      };
    }

    it('rejects an unknown bill', async () => {
      const { dataSource } = buildDataSource();
      const service = buildService({}, { dataSource });
      await expect(
        service.record(TENANT, 'u1', { ...dto, billId: 'missing' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a bill from a different supplier', async () => {
      const { dataSource, repos } = buildDataSource();
      repos.bill.findOneBy = vi.fn().mockResolvedValue(issuedBill({ supplierId: 's2' }));
      const service = buildService({}, { dataSource });
      await expect(
        service.record(TENANT, 'u1', { ...dto, billId: 'b1' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a bill that is not issued', async () => {
      const { dataSource, repos } = buildDataSource();
      repos.bill.findOneBy = vi
        .fn()
        .mockResolvedValue(issuedBill({ status: SupplierBillStatus.CANCELLED }));
      const service = buildService({}, { dataSource });
      await expect(
        service.record(TENANT, 'u1', { ...dto, billId: 'b1' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a payment exceeding the bill balance due', async () => {
      const { dataSource, repos } = buildDataSource();
      repos.bill.findOneBy = vi.fn().mockResolvedValue(issuedBill());
      const service = buildService({}, { dataSource });
      await expect(
        service.record(TENANT, 'u1', { ...dto, billId: 'b1', amount: 251 } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies a partial payment and keeps the bill issued', async () => {
      const { dataSource, repos } = buildDataSource();
      repos.bill.findOneBy = vi.fn().mockResolvedValue(issuedBill());
      repos.payment.findOne = vi.fn().mockResolvedValue({ id: 'p1', billId: 'b1' });
      const service = buildService({}, { dataSource });
      const result = await service.record(TENANT, 'u1', {
        ...dto,
        billId: 'b1',
        amount: 100,
      } as never);
      expect(result).toMatchObject({ id: 'p1', billId: 'b1' });
      expect(repos.bill.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SupplierBillStatus.ISSUED,
          paidAmount: 100,
          balanceDue: 150,
        }),
      );
    });

    it('marks the bill paid when the balance reaches zero', async () => {
      const { dataSource, repos } = buildDataSource();
      repos.bill.findOneBy = vi.fn().mockResolvedValue(issuedBill());
      const service = buildService({}, { dataSource });
      await service.record(TENANT, 'u1', { ...dto, billId: 'b1', amount: 250 } as never);
      expect(repos.bill.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SupplierBillStatus.PAID,
          paidAmount: 250,
          balanceDue: 0,
        }),
      );
    });
  });
});

describe('SupplierPaymentsService findAll', () => {
  it('paginates and orders by paidAt desc', async () => {
    const paymentsRepo = {
      findAndCount: vi.fn().mockResolvedValue([[{ id: 'p1' }], 1]),
    };
    const service = buildService(paymentsRepo);
    const result = await service.findAll(TENANT, 1, 25);
    expect(result).toEqual({ data: [{ id: 'p1' }], meta: { page: 1, limit: 25, total: 1 } });
    expect(paymentsRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25, order: { paidAt: 'DESC' } }),
    );
  });

  it('filters by supplier when provided', async () => {
    const paymentsRepo = { findAndCount: vi.fn().mockResolvedValue([[], 0]) };
    const service = buildService(paymentsRepo);
    await service.findAll(TENANT, 1, 25, 's1');
    expect(paymentsRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ supplierId: 's1' }) }),
    );
  });
});
