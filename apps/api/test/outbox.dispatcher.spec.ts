import { describe, expect, it, vi } from 'vitest';

import { OutboxEventStatus } from '@aptifum/core';
import { OutboxEvent } from '@aptifum/database';

import { OutboxDispatcher } from '../src/modules/outbox/outbox.dispatcher';

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'e1',
    tenantId: '00000000-0000-4000-8000-000000000001',
    eventType: 'invoice.issued',
    aggregateType: 'invoice',
    aggregateId: 'a1',
    payload: {},
    userId: null,
    occurredAt: new Date(),
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    processedAt: null,
    lastError: null,
    createdAt: new Date(),
    ...overrides,
  } as OutboxEvent;
}

function buildDispatcher(
  outbox: Record<string, unknown>,
  notifications: Record<string, unknown> = {},
  cfdi: Record<string, unknown> = {},
) {
  return new OutboxDispatcher(outbox as never, notifications as never, cfdi as never);
}

function freshNotifications() {
  return { handle: vi.fn(() => Promise.resolve()) };
}

function freshCfdi() {
  return { handle: vi.fn(() => Promise.resolve()) };
}

describe('OutboxDispatcher dispatchPending', () => {
  it('marks a known event dispatched', async () => {
    const ev = event({ eventType: 'payment.received' });
    const outbox = {
      findPending: vi.fn(() => Promise.resolve([ev])),
      markDispatched: vi.fn((e: OutboxEvent) => Promise.resolve(e)),
      markFailed: vi.fn(),
    };
    const dispatcher = buildDispatcher(outbox, freshNotifications(), freshCfdi());
    await dispatcher.dispatchPending();
    expect(outbox.markDispatched).toHaveBeenCalledWith(ev);
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('marks an unknown event type as dispatched too', async () => {
    const ev = event({ eventType: 'something.else' });
    const outbox = {
      findPending: vi.fn(() => Promise.resolve([ev])),
      markDispatched: vi.fn((e: OutboxEvent) => Promise.resolve(e)),
      markFailed: vi.fn(),
    };
    const dispatcher = buildDispatcher(outbox, freshNotifications(), freshCfdi());
    await dispatcher.dispatchPending();
    expect(outbox.markDispatched).toHaveBeenCalledWith(ev);
  });

  it('marks as failed when handling throws', async () => {
    const ev = event({ eventType: 'invoice.issued' });
    const outbox = {
      findPending: vi.fn(() => Promise.resolve([ev])),
      markDispatched: vi.fn((e: OutboxEvent) => Promise.resolve(e)),
      markFailed: vi.fn((e: OutboxEvent) => Promise.resolve(e)),
    };
    const dispatcher = buildDispatcher(outbox, freshNotifications(), freshCfdi());
    dispatcher['handle'] = () => Promise.reject(new Error('boom'));
    await dispatcher.dispatchPending();
    expect(outbox.markFailed).toHaveBeenCalledWith(ev, expect.any(Error));
    expect(outbox.markDispatched).not.toHaveBeenCalled();
  });

  it('does nothing when there are no pending events', async () => {
    const outbox = {
      findPending: vi.fn(() => Promise.resolve([])),
      markDispatched: vi.fn(),
      markFailed: vi.fn(),
    };
    const dispatcher = buildDispatcher(outbox, freshNotifications(), freshCfdi());
    await dispatcher.dispatchPending();
    expect(outbox.markDispatched).not.toHaveBeenCalled();
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });
});
