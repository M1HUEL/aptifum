import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AccountingPeriodStatus } from '@aptifum/core';
import { AccountingPeriod } from '@aptifum/database';

@Injectable()
export class PeriodsService {
  constructor(
    @InjectRepository(AccountingPeriod)
    private readonly periodsRepo: Repository<AccountingPeriod>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<AccountingPeriod> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, status?: string) {
    const where: FindOptionsWhere<AccountingPeriod> = this.scoped(tenantId);
    if (status) {
      where.status = status as AccountingPeriodStatus;
    }
    const [rows, total] = await this.periodsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { period: 'DESC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async close(tenantId: string | null, userId: string | null, id: string) {
    const period = await this.periodsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!period) {
      throw new NotFoundException('Accounting period not found');
    }
    if (period.status === AccountingPeriodStatus.CLOSED) {
      throw new BadRequestException('Period is already closed');
    }
    period.status = AccountingPeriodStatus.CLOSED;
    period.closedAt = new Date();
    period.closedBy = userId;
    return this.periodsRepo.save(period);
  }
}
