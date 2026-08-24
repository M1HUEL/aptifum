import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { LeaveStatus } from '@aptifum/core';
import { Employee, Leave } from '@aptifum/database';

import { CreateLeaveDto } from './dto/create-leave.dto.js';
import { UpdateLeaveDto } from './dto/update-leave.dto.js';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave) private readonly leavesRepo: Repository<Leave>,
    @InjectRepository(Employee) private readonly employeesRepo: Repository<Employee>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Leave> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(
    tenantId: string | null,
    page: number,
    limit: number,
    filters: { employeeId?: string; status?: string; leaveType?: string },
  ) {
    const where: FindOptionsWhere<Leave> = this.scoped(tenantId);
    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }
    if (filters.status) {
      where.status = filters.status as LeaveStatus;
    }
    if (filters.leaveType) {
      where.leaveType = filters.leaveType as Leave['leaveType'];
    }
    const [rows, total] = await this.leavesRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { startDate: 'DESC', createdAt: 'DESC' },
      relations: { employee: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const leave = await this.leavesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { employee: true },
    });
    if (!leave) {
      throw new NotFoundException('Leave not found');
    }
    return leave;
  }

  async create(tenantId: string | null, dto: CreateLeaveDto) {
    this.assertTenant(tenantId);
    await this.ensureEmployee(tenantId, dto.employeeId);
    this.validateRange(dto.startDate, dto.endDate);
    const leave = await this.leavesRepo.save(
      this.leavesRepo.create({
        tenantId: tenantId as string,
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: dto.days ?? this.countDays(dto.startDate, dto.endDate),
        status: LeaveStatus.PENDING,
        reason: dto.reason ?? null,
      }),
    );
    return this.findOne(tenantId, leave.id);
  }

  async update(tenantId: string | null, id: string, dto: UpdateLeaveDto) {
    this.assertTenant(tenantId);
    const leave = await this.findOne(tenantId, id);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leaves can be edited');
    }
    if (dto.employeeId && dto.employeeId !== leave.employeeId) {
      await this.ensureEmployee(tenantId, dto.employeeId);
    }
    const startDate = dto.startDate ?? leave.startDate;
    const endDate = dto.endDate ?? leave.endDate;
    this.validateRange(startDate, endDate);
    Object.assign(leave, {
      employeeId: dto.employeeId ?? leave.employeeId,
      leaveType: dto.leaveType ?? leave.leaveType,
      startDate,
      endDate,
      days: dto.days ?? this.countDays(startDate, endDate),
      reason: dto.reason === undefined ? leave.reason : dto.reason,
    });
    return this.leavesRepo.save(leave);
  }

  async approve(tenantId: string | null, id: string, userId: string | null) {
    const leave = await this.findOne(tenantId, id);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leaves can be approved');
    }
    leave.status = LeaveStatus.APPROVED;
    leave.approvedBy = userId;
    leave.approvedAt = new Date();
    return this.leavesRepo.save(leave);
  }

  async reject(tenantId: string | null, id: string, userId: string | null) {
    const leave = await this.findOne(tenantId, id);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leaves can be rejected');
    }
    leave.status = LeaveStatus.REJECTED;
    leave.approvedBy = userId;
    leave.approvedAt = new Date();
    return this.leavesRepo.save(leave);
  }

  async remove(tenantId: string | null, id: string) {
    const leave = await this.findOne(tenantId, id);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leaves can be deleted');
    }
    await this.leavesRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private countDays(startDate: string, endDate: string): number {
    const start = Date.parse(startDate);
    const end = Date.parse(endDate);
    return Math.round((end - start) / 86400000) + 1;
  }

  private validateRange(startDate: string, endDate: string) {
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
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
