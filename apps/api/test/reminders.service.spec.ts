import { describe, expect, it, vi } from 'vitest';

import { RemindersService } from '../src/modules/reminders/reminders.service.js';

const TENANT = '00000000-0000-4000-8000-000000000001';

function buildService(overrides: { count?: number } = {}) {
  const dataSource = {
    query: vi.fn(() => Promise.resolve([]) as Promise<unknown>),
    manager: { transaction: vi.fn() },
  };
  const outboxEventsRepo = { count: vi.fn().mockResolvedValue(overrides.count ?? 0) };
  const outbox = { emit: vi.fn().mockResolvedValue(undefined) };
  const service = new RemindersService(dataSource as never, outboxEventsRepo as never, outbox as never);
  return { service, dataSource, outboxEventsRepo, outbox };
}

const invoiceRow = {
  id: 'inv-1',
  tenant_id: TENANT,
  number: 'INV-000001',
  customer_id: 'c1',
  total: '200',
  balance_due: '200',
  due_date: '2026-08-01',
  days_overdue: '10',
};

const billRow = {
  id: 'sb-1',
  tenant_id: TENANT,
  number: 'SB-000001',
  supplier_id: 's1',
  balance_due: '50',
  due_date: '2026-08-01',
  days_overdue: '2',
};

const orderRow = {
  id: 'po-1',
  tenant_id: TENANT,
  number: 'PO-000001',
  supplier_id: 's1',
  total: '300',
  days_pending: '3',
};

describe('RemindersService', () => {
  it('queues an ar_overdue reminder for each overdue invoice', async () => {
    const { service, dataSource, outbox } = buildService();
    dataSource.query.mockResolvedValueOnce([invoiceRow]).mockResolvedValue([]);
    await service.runDaily();
    expect(outbox.emit).toHaveBeenCalledTimes(1);
    const [, tenantId, input] = outbox.emit.mock.calls[0]!;
    expect(tenantId).toBe(TENANT);
    expect(input.eventType).toBe('reminder.ar_overdue');
    expect(input.aggregateType).toBe('invoice');
    expect(input.aggregateId).toBe('inv-1');
    expect(input.payload.daysOverdue).toBe(10);
  });

  it('does not re-emit a reminder already sent today for the same aggregate', async () => {
    const { service, dataSource, outboxEventsRepo, outbox } = buildService({ count: 1 });
    dataSource.query.mockResolvedValueOnce([invoiceRow]).mockResolvedValue([]);
    await service.runDaily();
    expect(outboxEventsRepo.count).toHaveBeenCalledTimes(1);
    expect(outbox.emit).not.toHaveBeenCalled();
  });

  it('queues ar_overdue, ap_overdue and pending_approval reminders', async () => {
    const { service, dataSource, outbox } = buildService();
    dataSource.query
      .mockResolvedValueOnce([invoiceRow])
      .mockResolvedValueOnce([billRow])
      .mockResolvedValueOnce([orderRow]);
    await service.runDaily();
    const types = outbox.emit.mock.calls.map(([, , input]) => input.eventType);
    expect(types).toEqual(['reminder.ar_overdue', 'reminder.ap_overdue', 'reminder.pending_approval']);
    const [, , approvalInput] = outbox.emit.mock.calls[2]!;
    expect(approvalInput.payload.orderId).toBe('po-1');
    expect(approvalInput.payload.daysPending).toBe(3);
  });

  it('sends the manager when emitting through the outbox', async () => {
    const { service, dataSource, outbox } = buildService();
    dataSource.query.mockResolvedValueOnce([invoiceRow]).mockResolvedValue([]);
    await service.runDaily();
    const [manager] = outbox.emit.mock.calls[0]!;
    expect(manager).toBe(dataSource.manager);
  });
});
