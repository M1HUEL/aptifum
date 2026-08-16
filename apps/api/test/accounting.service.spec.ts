import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Employee, Payroll } from '@aptifum/database';
import { describe, expect, it, vi } from 'vitest';
import { PeriodsService } from '../src/modules/accounting/periods.service';
import { PayrollsService } from '../src/modules/hr/payrolls.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

describe('PeriodsService close', () => {
  it('throws when the period does not exist', async () => {
    const periodsRepo = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new PeriodsService(periodsRepo as never);
    await expect(service.close(TENANT, 'u1', 'p1')).rejects.toThrow(NotFoundException);
  });

  it('rejects closing an already-closed period', async () => {
    const periodsRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'p1', status: 'closed' }),
      save: vi.fn(),
    };
    const service = new PeriodsService(periodsRepo as never);
    await expect(service.close(TENANT, 'u1', 'p1')).rejects.toThrow(BadRequestException);
    expect(periodsRepo.save).not.toHaveBeenCalled();
  });

  it('closes an open period and records who closed it', async () => {
    const period = { id: 'p1', status: 'open', closedAt: null, closedBy: null };
    const periodsRepo = {
      findOne: vi.fn().mockResolvedValue(period),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = new PeriodsService(periodsRepo as never);
    const result = await service.close(TENANT, 'u1', 'p1');
    expect(result.status).toBe('closed');
    expect(result.closedBy).toBe('u1');
    expect(result.closedAt).toBeInstanceOf(Date);
  });
});

describe('PayrollsService cancel', () => {
  it('cancels a draft payroll', async () => {
    const payroll = { id: 'p1', status: 'draft' };
    const payrollsRepo = {
      findOne: vi.fn().mockResolvedValue(payroll),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = new PayrollsService(payrollsRepo as never, {} as never, {} as never, {} as never);
    await service.cancel(TENANT, 'p1');
    expect(payroll.status).toBe('cancelled');
  });

  it('rejects cancelling a posted payroll', async () => {
    const payrollsRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'p1', status: 'posted' }),
      save: vi.fn(),
    };
    const service = new PayrollsService(payrollsRepo as never, {} as never, {} as never, {} as never);
    await expect(service.cancel(TENANT, 'p1')).rejects.toThrow(BadRequestException);
    expect(payrollsRepo.save).not.toHaveBeenCalled();
  });
});

describe('PayrollsService post', () => {
  it('only allows posting draft payrolls', async () => {
    const payrollsRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'p1', status: 'posted' }),
    };
    const service = new PayrollsService(payrollsRepo as never, {} as never, {} as never, {} as never);
    await expect(service.post(TENANT, 'u1', 'p1')).rejects.toThrow(BadRequestException);
  });
});

describe('PayrollsService generate', () => {
  function buildService(manager: Record<string, unknown>) {
    const dataSource = {
      transaction: vi.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
    };
    return new PayrollsService({} as never, {} as never, dataSource as never, {} as never);
  }

  it('rejects a duplicate payroll for the same period', async () => {
    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === Payroll) {
          return { findOneBy: vi.fn().mockResolvedValue({ id: 'p9' }) };
        }
        return { findBy: vi.fn() };
      }),
    };
    const service = buildService(manager);
    await expect(service.generate(TENANT, { period: '2026-08', lines: [] } as never)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects negative net pay for an employee', async () => {
    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === Employee) {
          return {
            findBy: vi.fn().mockResolvedValue([{ id: 'e1', employeeNo: 'EMP-1', salary: 100 }]),
          };
        }
        return { findOneBy: vi.fn().mockResolvedValue(null) };
      }),
    };
    const service = buildService(manager);
    await expect(
      service.generate(TENANT, {
        period: '2026-08',
        lines: [{ employeeId: 'e1', deductions: 150 }],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when an employee is missing', async () => {
    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === Employee) {
          return { findBy: vi.fn().mockResolvedValue([]) };
        }
        return { findOneBy: vi.fn().mockResolvedValue(null) };
      }),
    };
    const service = buildService(manager);
    await expect(
      service.generate(TENANT, {
        period: '2026-08',
        lines: [{ employeeId: 'e1' }],
      } as never),
    ).rejects.toThrow(NotFoundException);
  });
});
