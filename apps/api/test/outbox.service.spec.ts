import { describe, expect, it, vi } from 'vitest';

import { OutboxEventStatus } from '@aptifum/core';
import { OutboxEvent } from '@aptifum/database';

import { OutboxService } from '../src/modules/outbox/outbox.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function buildService(repo: Record<string, unknown>) {
  return new OutboxService(repo as never);
}

describe('OutboxService emit', () => {
  it('enqueues an event through the manager repo', async () => {
    const saved = { id: 'e1', status: OutboxEventStatus.PENDING };
    const paymentRepo = {
      create: vi.fn((x: unknown) => x),
      save: vi.fn(() => Promise.resolve(saved)),
    };
    const manager = { getRepository: vi.fn(() => paymentRepo) };
    const service = buildService({});
    const result = await service.emit(manager as never, TENANT, {
      eventType: 'invoice.issued',
      aggregateType: 'invoice',
      aggregateId: 'a1',
      payload: { total: 10 },
      tenantId: TENANT,
      userId: 'u1',
    });
    expect(result).toEqual(saved);
    expect(paymentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        eventType: 'invoice.issued',
        aggregateType: 'invoice',
        aggregateId: 'a1',
        payload: { total: 10 },
        userId: 'u1',
        status: OutboxEventStatus.PENDING,
        attempts: 0,
      }),
    );
  });

  it('defaults payload, userId and occurredAt when omitted', async () => {
    const paymentRepo = {
      create: vi.fn((x: unknown) => x),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const manager = { getRepository: vi.fn(() => paymentRepo) };
    const service = buildService({});
    await service.emit(manager as never, TENANT, {
      eventType: 'payment.received',
      aggregateType: 'payment',
      aggregateId: 'p1',
      tenantId: TENANT,
    });
    const created = paymentRepo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(created.payload).toEqual({});
    expect(created.userId).toBeNull();
    expect(created.occurredAt).toBeInstanceOf(Date);
  });
});

describe('OutboxService dispatch helpers', () => {
  it('findPending returns pending events ordered by occurredAt', async () => {
    const repo = { find: vi.fn(() => Promise.resolve([{ id: 'e1' }])) };
    const service = buildService(repo);
    await service.findPending(10);
    expect(repo.find).toHaveBeenCalledWith({
      where: { status: OutboxEventStatus.PENDING },
      order: { occurredAt: 'ASC' },
      take: 10,
    });
  });

  it('markDispatched sets status and processedAt', async () => {
    const repo = { save: vi.fn((x: unknown) => Promise.resolve(x)) };
    const service = buildService(repo);
    const event = { id: 'e1', status: OutboxEventStatus.PENDING, processedAt: null };
    const result = await service.markDispatched(event as unknown as OutboxEvent);
    expect(result.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(result.processedAt).toBeInstanceOf(Date);
  });

  it('markFailed increments attempts and marks failed after 5 attempts', async () => {
    const repo = { save: vi.fn((x: unknown) => Promise.resolve(x)) };
    const service = buildService(repo);
    let event: OutboxEvent = {
      id: 'e1',
      status: OutboxEventStatus.PENDING,
      attempts: 4,
      lastError: null,
    } as unknown as OutboxEvent;
    event = await service.markFailed(event, new Error('boom'));
    expect(event.attempts).toBe(5);
    expect(event.status).toBe(OutboxEventStatus.FAILED);
    expect(event.lastError).toBe('boom');
  });
});
