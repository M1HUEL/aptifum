import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

import { CrmActivity } from '@aptifum/database';

import { CreateActivityDto } from './dto/create-activity.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';

@Injectable()
export class ActivitiesService {
  constructor(@InjectRepository(CrmActivity) private readonly activitiesRepo: Repository<CrmActivity>) {}

  private scoped(tenantId: string | null): FindOptionsWhere<CrmActivity> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(
    tenantId: string | null,
    page: number,
    limit: number,
    filters: { referenceType?: string; referenceId?: string; q?: string },
  ) {
    const where: FindOptionsWhere<CrmActivity> = this.scoped(tenantId);
    if (filters.referenceType) {
      where.referenceType = filters.referenceType;
    }
    if (filters.referenceId) {
      where.referenceId = filters.referenceId;
    }
    if (filters.q) {
      where.subject = ILike(`%${filters.q}%`);
    }
    const [rows, total] = await this.activitiesRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const activity = await this.activitiesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return activity;
  }

  async create(tenantId: string | null, dto: CreateActivityDto) {
    this.assertTenant(tenantId);
    return this.activitiesRepo.save(
      this.activitiesRepo.create({
        tenantId: tenantId as string,
        activityType: dto.activityType,
        subject: dto.subject,
        description: dto.description ?? null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
        assigneeId: dto.assigneeId ?? null,
        referenceType: dto.referenceType ?? null,
        referenceId: dto.referenceId ?? null,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateActivityDto) {
    const activity = await this.findOne(tenantId, id);
    Object.assign(activity, {
      activityType: dto.activityType ?? activity.activityType,
      subject: dto.subject ?? activity.subject,
      description: dto.description === undefined ? activity.description : dto.description,
      dueAt: dto.dueAt === undefined ? activity.dueAt : dto.dueAt ? new Date(dto.dueAt) : null,
      completedAt:
        dto.completedAt === undefined ? activity.completedAt : dto.completedAt ? new Date(dto.completedAt) : null,
      assigneeId: dto.assigneeId === undefined ? activity.assigneeId : dto.assigneeId,
      referenceType: dto.referenceType === undefined ? activity.referenceType : dto.referenceType,
      referenceId: dto.referenceId === undefined ? activity.referenceId : dto.referenceId,
    });
    return this.activitiesRepo.save(activity);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.activitiesRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
