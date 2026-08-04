import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction } from '@aptifum/core';
import { AuditLog } from '@aptifum/database';
import { Repository } from 'typeorm';

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
  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.auditRepo.save(this.auditRepo.create({ ...entry }));
  }
}
