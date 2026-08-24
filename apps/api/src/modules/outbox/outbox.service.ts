import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { OutboxEventInput, OutboxEventStatus } from '@aptifum/core';
import { OutboxEvent, enqueueOutboxEvent } from '@aptifum/database';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly eventsRepo: Repository<OutboxEvent>,
  ) {}

  emit(manager: EntityManager, tenantId: string, input: OutboxEventInput) {
    return enqueueOutboxEvent(manager, tenantId, input);
  }

  findPending(limit: number): Promise<OutboxEvent[]> {
    return this.eventsRepo.find({
      where: { status: OutboxEventStatus.PENDING },
      order: { occurredAt: 'ASC' },
      take: limit,
    });
  }

  markDispatched(event: OutboxEvent): Promise<OutboxEvent> {
    event.status = OutboxEventStatus.DISPATCHED;
    event.processedAt = new Date();
    return this.eventsRepo.save(event);
  }

  markFailed(event: OutboxEvent, error: unknown): Promise<OutboxEvent> {
    const message = error instanceof Error ? error.message : String(error);
    event.attempts += 1;
    event.lastError = message;
    if (event.attempts >= 5) {
      event.status = OutboxEventStatus.FAILED;
    }
    this.logger.error(`Outbox event ${event.id} (${event.eventType}) failed attempt ${event.attempts}: ${message}`);
    return this.eventsRepo.save(event);
  }
}
