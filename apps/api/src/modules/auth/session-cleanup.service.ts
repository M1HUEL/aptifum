import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { RefreshSession } from '@aptifum/database';

import { ConfigService } from '../../config/config.module.js';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    @InjectRepository(RefreshSession)
    private readonly sessionsRepo: Repository<RefreshSession>,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.config.env.SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const batch = await this.sessionsRepo.find({
        where: [{ revokedAt: LessThan(cutoff) }, { expiresAt: LessThan(cutoff) }],
        order: { updatedAt: 'ASC' },
        take: 5000,
        select: { id: true },
      });
      if (batch.length > 0) {
        await this.sessionsRepo.delete(batch.map((session) => session.id));
        this.logger.log(`Purged ${batch.length} expired refresh sessions`);
      }
    } catch (error) {
      this.logger.error('Failed to purge expired refresh sessions', error);
    }
  }
}
