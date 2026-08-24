import { EntityManager } from 'typeorm';

import { OutboxEventInput, OutboxEventStatus } from '@aptifum/core';

import { OutboxEvent } from '../entities/outbox-event.entity.js';

export async function enqueueOutboxEvent(
  manager: EntityManager,
  tenantId: string,
  input: OutboxEventInput,
): Promise<OutboxEvent> {
  const event = manager.getRepository(OutboxEvent).create({
    tenantId,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload ?? {},
    userId: input.userId ?? null,
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    processedAt: null,
    lastError: null,
  });
  return manager.getRepository(OutboxEvent).save(event);
}
