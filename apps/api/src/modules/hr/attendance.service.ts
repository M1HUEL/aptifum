import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';

import { AttendanceStatus } from '@aptifum/core';
import { AttendanceRecord, Employee } from '@aptifum/database';

import { ClockAttendanceDto } from './dto/clock-attendance.dto.js';
import { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import { UpdateAttendanceDto } from './dto/update-attendance.dto.js';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord) private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(Employee) private readonly employeesRepo: Repository<Employee>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<AttendanceRecord> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(
    tenantId: string | null,
    page: number,
    limit: number,
    filters: { employeeId?: string; from?: string; to?: string; status?: string },
  ) {
    const where: FindOptionsWhere<AttendanceRecord> = this.scoped(tenantId);
    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }
    if (filters.status) {
      where.status = filters.status as AttendanceStatus;
    }
    if (filters.from || filters.to) {
      where.workDate = Between(filters.from ?? '1970-01-01', filters.to ?? '2999-12-31');
    }
    const [rows, total] = await this.attendanceRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { workDate: 'DESC', createdAt: 'DESC' },
      relations: { employee: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const record = await this.attendanceRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { employee: true },
    });
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }
    return record;
  }

  async clock(tenantId: string | null, _userId: string | null, dto: ClockAttendanceDto) {
    this.assertTenant(tenantId);
    await this.ensureEmployee(tenantId, dto.employeeId);
    const at = dto.at ? new Date(dto.at) : new Date();
    const workDate = at.toISOString().slice(0, 10);
    return this.attendanceRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AttendanceRecord);
      let record = await repo.findOneBy({
        tenantId,
        employeeId: dto.employeeId,
        workDate,
      });
      if (dto.action === 'in') {
        if (record && record.clockInAt) {
          throw new ConflictException('Employee already clocked in for this day');
        }
        if (!record) {
          record = repo.create({
            tenantId,
            employeeId: dto.employeeId,
            workDate,
            clockInAt: at,
            clockOutAt: null,
            workedMinutes: 0,
            status: AttendanceStatus.PRESENT,
            notes: null,
          });
        } else {
          record.clockInAt = at;
          record.status = AttendanceStatus.PRESENT;
        }
      } else {
        if (!record || !record.clockInAt) {
          throw new BadRequestException('Employee has no clock-in for this day');
        }
        if (record.clockOutAt) {
          throw new ConflictException('Employee already clocked out for this day');
        }
        record.clockOutAt = at;
        record.workedMinutes = this.computeMinutes(record.clockInAt, at);
      }
      return repo.save(record);
    });
  }

  async create(tenantId: string | null, dto: CreateAttendanceDto) {
    this.assertTenant(tenantId);
    await this.ensureEmployee(tenantId, dto.employeeId);
    const existing = await this.attendanceRepo.findOneBy({
      tenantId,
      employeeId: dto.employeeId,
      workDate: dto.workDate,
    });
    if (existing) {
      throw new ConflictException('Attendance record already exists for this employee and date');
    }
    const clockIn = dto.clockInAt ? new Date(dto.clockInAt) : null;
    const clockOut = dto.clockOutAt ? new Date(dto.clockOutAt) : null;
    const record = await this.attendanceRepo.save(
      this.attendanceRepo.create({
        tenantId: tenantId as string,
        employeeId: dto.employeeId,
        workDate: dto.workDate,
        clockInAt: clockIn,
        clockOutAt: clockOut,
        workedMinutes: clockIn && clockOut ? this.computeMinutes(clockIn, clockOut) : 0,
        status: dto.status ?? AttendanceStatus.PRESENT,
        notes: dto.notes ?? null,
      }),
    );
    return this.findOne(tenantId, record.id);
  }

  async update(tenantId: string | null, id: string, dto: UpdateAttendanceDto) {
    const record = await this.findOne(tenantId, id);
    const clockIn = dto.clockInAt !== undefined ? (dto.clockInAt ? new Date(dto.clockInAt) : null) : record.clockInAt;
    const clockOut =
      dto.clockOutAt !== undefined ? (dto.clockOutAt ? new Date(dto.clockOutAt) : null) : record.clockOutAt;
    Object.assign(record, {
      clockInAt: clockIn,
      clockOutAt: clockOut,
      workedMinutes: clockIn && clockOut ? this.computeMinutes(clockIn, clockOut) : 0,
      status: dto.status ?? record.status,
      notes: dto.notes === undefined ? record.notes : dto.notes,
    });
    return this.attendanceRepo.save(record);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.attendanceRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private computeMinutes(clockIn: Date, clockOut: Date): number {
    const minutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
    return Math.max(0, minutes);
  }

  private async ensureEmployee(tenantId: string, employeeId: string) {
    const employee = await this.employeesRepo.findOneBy({ id: employeeId, tenantId });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
