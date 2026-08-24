import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AttendanceService } from '../src/modules/hr/attendance.service';
import { EmployeesService } from '../src/modules/hr/employees.service';
import { LeavesService } from '../src/modules/hr/leaves.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

describe('LeavesService create', () => {
  it('requires a tenant', async () => {
    const service = new LeavesService({} as never, {} as never);
    await expect(
      service.create(null, {
        employeeId: 'e1',
        leaveType: 'vacation',
        startDate: '2026-08-01',
        endDate: '2026-08-02',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an employee that does not exist', async () => {
    const leavesRepo = {};
    const employeesRepo = { findOneBy: vi.fn().mockResolvedValue(null) };
    const service = new LeavesService(leavesRepo as never, employeesRepo as never);
    await expect(
      service.create(TENANT, {
        employeeId: 'e1',
        leaveType: 'vacation',
        startDate: '2026-08-01',
        endDate: '2026-08-02',
      } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an end date before the start date', async () => {
    const employeesRepo = { findOneBy: vi.fn().mockResolvedValue({ id: 'e1' }) };
    const service = new LeavesService({} as never, employeesRepo as never);
    await expect(
      service.create(TENANT, {
        employeeId: 'e1',
        leaveType: 'vacation',
        startDate: '2026-08-10',
        endDate: '2026-08-05',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('computes inclusive days and defaults to pending', async () => {
    let saved: Record<string, unknown> | null = null;
    const leavesRepo = {
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: Record<string, unknown>) => {
        saved = x;
        return Promise.resolve(x);
      }),
      findOne: vi.fn(async () => saved),
    };
    const employeesRepo = { findOneBy: vi.fn().mockResolvedValue({ id: 'e1' }) };
    const service = new LeavesService(leavesRepo as never, employeesRepo as never);
    const result = await service.create(TENANT, {
      employeeId: 'e1',
      leaveType: 'vacation',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
    } as never);
    expect(result).toMatchObject({ days: 3, status: 'pending' });
  });
});

describe('LeavesService status transitions', () => {
  it('only allows editing pending leaves', async () => {
    const leavesRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'l1', status: 'approved' }),
      save: vi.fn(),
    };
    const service = new LeavesService(leavesRepo as never, {} as never);
    await expect(service.update(TENANT, 'l1', { reason: 'x' } as never)).rejects.toThrow(BadRequestException);
    expect(leavesRepo.save).not.toHaveBeenCalled();
  });

  it('approves a pending leave', async () => {
    const leave = { id: 'l1', status: 'pending' };
    const leavesRepo = {
      findOne: vi.fn().mockResolvedValue(leave),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = new LeavesService(leavesRepo as never, {} as never);
    await service.approve(TENANT, 'l1', 'u1');
    expect(leave).toMatchObject({ status: 'approved', approvedBy: 'u1' });
  });

  it('rejects approving a non-pending leave', async () => {
    const leavesRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'l1', status: 'rejected' }),
      save: vi.fn(),
    };
    const service = new LeavesService(leavesRepo as never, {} as never);
    await expect(service.approve(TENANT, 'l1', 'u1')).rejects.toThrow(BadRequestException);
  });

  it('rejects deleting a non-pending leave', async () => {
    const leavesRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'l1', status: 'cancelled' }),
      softDelete: vi.fn(),
    };
    const service = new LeavesService(leavesRepo as never, {} as never);
    await expect(service.remove(TENANT, 'l1')).rejects.toThrow(BadRequestException);
  });
});

describe('AttendanceService clock', () => {
  function buildClock(managerRepo: Record<string, unknown>) {
    const attendanceRepo = {
      manager: {
        transaction: vi.fn(async (cb: (m: unknown) => unknown) => cb({ getRepository: () => managerRepo })),
      },
    };
    const employeesRepo = { findOneBy: vi.fn().mockResolvedValue({ id: 'e1' }) };
    return new AttendanceService(attendanceRepo as never, employeesRepo as never);
  }

  it('creates a new record when clocking in', async () => {
    const managerRepo = {
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: Record<string, unknown>) => Promise.resolve(x)),
    };
    const service = buildClock(managerRepo);
    const result = await service.clock(TENANT, 'u1', {
      employeeId: 'e1',
      action: 'in',
      at: '2026-08-07T09:00:00.000Z',
    });
    expect(result).toMatchObject({
      workDate: '2026-08-07',
      status: 'present',
      workedMinutes: 0,
    });
    expect(result.clockInAt).toBeInstanceOf(Date);
  });

  it('rejects a second clock-in on the same day', async () => {
    const managerRepo = {
      findOneBy: vi.fn().mockResolvedValue({
        clockInAt: new Date('2026-08-07T08:00:00.000Z'),
      }),
      save: vi.fn(),
    };
    const service = buildClock(managerRepo);
    await expect(
      service.clock(TENANT, 'u1', { employeeId: 'e1', action: 'in', at: '2026-08-07T09:00:00.000Z' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects clock-out without a clock-in', async () => {
    const managerRepo = {
      findOneBy: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };
    const service = buildClock(managerRepo);
    await expect(
      service.clock(TENANT, 'u1', { employeeId: 'e1', action: 'out', at: '2026-08-07T17:00:00.000Z' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('computes worked minutes on clock-out', async () => {
    const managerRepo = {
      findOneBy: vi.fn().mockResolvedValue({
        clockInAt: new Date('2026-08-07T09:00:00.000Z'),
        clockOutAt: null,
      }),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const service = buildClock(managerRepo);
    const result = await service.clock(TENANT, 'u1', {
      employeeId: 'e1',
      action: 'out',
      at: '2026-08-07T17:30:00.000Z',
    });
    expect(result.workedMinutes).toBe(510);
  });
});

describe('AttendanceService create', () => {
  it('rejects a duplicate record for the same employee and date', async () => {
    const attendanceRepo = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'a1' }),
      create: vi.fn(),
      save: vi.fn(),
    };
    const employeesRepo = { findOneBy: vi.fn().mockResolvedValue({ id: 'e1' }) };
    const service = new AttendanceService(attendanceRepo as never, employeesRepo as never);
    await expect(
      service.create(TENANT, {
        employeeId: 'e1',
        workDate: '2026-08-07',
      } as never),
    ).rejects.toThrow(ConflictException);
  });
});

describe('EmployeesService', () => {
  it('auto-generates the employee number', async () => {
    let saved: Record<string, unknown> | null = null;
    const employeesRepo = {
      countBy: vi.fn().mockResolvedValue(4),
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: Record<string, unknown>) => {
        saved = x;
        return Promise.resolve(x);
      }),
      findOne: vi.fn(async () => saved),
    };
    const service = new EmployeesService(employeesRepo as never);
    const result = await service.create(TENANT, {
      firstName: 'Ana',
      lastName: 'Gomez',
      hireDate: '2026-01-01',
    } as never);
    expect(result.employeeNo).toBe('EMP-000005');
  });

  it('hides salary fields unless explicitly included', async () => {
    const row = {
      id: 'e1',
      employeeNo: 'EMP-1',
      firstName: 'Ana',
      lastName: 'Gomez',
      salary: 1000,
      salaryFrequency: 'monthly',
      bankName: 'Bank',
      bankAccount: '123',
      department: null,
    };
    const employeesRepo = {
      findAndCount: vi.fn().mockResolvedValue([[row], 1]),
    };
    const service = new EmployeesService(employeesRepo as never);
    const result = await service.findAll(TENANT, 1, 10, undefined, false);
    expect(result.data[0]).not.toHaveProperty('salary');
    expect(result.data[0]).not.toHaveProperty('salaryFrequency');
    expect(result.meta.total).toBe(1);
  });
});
