import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, ILike, Repository } from 'typeorm';

import { AuditAction } from '@aptifum/core';
import { AuditLog } from '@aptifum/database';

import { AuditQueryDto } from './dto/audit-query.dto.js';

export interface AuditEntry {
  tenantId: string | null;
  userId: string | null;
  module: string;
  entity: string;
  entityId: string | null;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  requestId: string | null;
  ip: string | null;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.auditRepo.save(this.auditRepo.create({ ...entry }));
  }

  async findAll(tenantId: string | null, query: AuditQueryDto) {
    const where: FindOptionsWhere<AuditLog> = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (query.module) {
      where.module = ILike(`%${query.module}%`);
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.from && query.to) {
      where.createdAt = Between(new Date(query.from), new Date(query.to));
    } else if (query.from) {
      where.createdAt = Between(new Date(query.from), new Date());
    }
    const [rows, total] = await this.auditRepo.findAndCount({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        module: row.module,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        before: row.before,
        after: row.after,
        requestId: row.requestId,
        ip: row.ip,
        createdAt: row.createdAt,
      })),
      meta: { page: query.page, limit: query.limit, total },
    };
  }
}
