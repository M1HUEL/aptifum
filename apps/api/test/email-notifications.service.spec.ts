import { describe, expect, it, vi } from 'vitest';
import { OutboxEventStatus } from '@aptifum/core';
import { OutboxEvent } from '@aptifum/database';
import { EmailNotificationsService } from '../src/modules/email/email-notifications.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'e1',
    tenantId: TENANT,
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

function buildService(
  email: Record<string, unknown>,
  repos: { customers?: Record<string, unknown>; suppliers?: Record<string, unknown>; invoices?: Record<string, unknown> } = {},
) {
  return new EmailNotificationsService(
    email as never,
    (repos.customers ?? {}) as never,
    (repos.suppliers ?? {}) as never,
    (repos.invoices ?? {}) as never,
  );
}

describe('EmailNotificationsService', () => {
  it('does nothing when SMTP is not configured', async () => {
    const email = { isConfigured: vi.fn(() => false), sendMail: vi.fn() };
    const customersRepo = { findOneBy: vi.fn() };
    const service = buildService(email, { customers: customersRepo });
    await service.handle(event({ eventType: 'invoice.issued', payload: { customerId: 'c1' } }));
    expect(email.sendMail).not.toHaveBeenCalled();
    expect(customersRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('sends an invoice email to the customer', async () => {
    const email = { isConfigured: vi.fn(() => true), sendMail: vi.fn(() => Promise.resolve(true)) };
    const customersRepo = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'c1', email: 'bob@example.com', tradeName: 'Bob Co' }),
    };
    const service = buildService(email, { customers: customersRepo });
    await service.handle(
      event({ eventType: 'invoice.issued', payload: { number: 'INV-000001', customerId: 'c1', total: 120.5 } }),
    );
    expect(customersRepo.findOneBy).toHaveBeenCalledWith({ id: 'c1', tenantId: TENANT });
    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'bob@example.com',
        subject: 'Invoice INV-000001 issued',
      }),
    );
    const message = (email.sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0] as { text: string };
    expect(message.text).toContain('120.50');
  });

  it('uses the credit note label for credit_note.issued', async () => {
    const email = { isConfigured: vi.fn(() => true), sendMail: vi.fn(() => Promise.resolve(true)) };
    const customersRepo = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'c1', email: 'bob@example.com', tradeName: 'Bob Co' }),
    };
    const service = buildService(email, { customers: customersRepo });
    await service.handle(
      event({ eventType: 'credit_note.issued', payload: { number: 'CN-000001', customerId: 'c1', total: 30 } }),
    );
    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Credit note CN-000001 issued' }),
    );
  });

  it('skips when the customer has no email', async () => {
    const email = { isConfigured: vi.fn(() => true), sendMail: vi.fn() };
    const customersRepo = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'c1', email: null, tradeName: 'Bob Co' }),
    };
    const service = buildService(email, { customers: customersRepo });
    await service.handle(event({ payload: { customerId: 'c1' } }));
    expect(email.sendMail).not.toHaveBeenCalled();
  });

  it('skips when the customer is not found', async () => {
    const email = { isConfigured: vi.fn(() => true), sendMail: vi.fn() };
    const customersRepo = { findOneBy: vi.fn().mockResolvedValue(null) };
    const service = buildService(email, { customers: customersRepo });
    await service.handle(event({ payload: { customerId: 'c1' } }));
    expect(email.sendMail).not.toHaveBeenCalled();
  });

  it('sends a payment receipt email resolving the invoice and customer', async () => {
    const email = { isConfigured: vi.fn(() => true), sendMail: vi.fn(() => Promise.resolve(true)) };
    const invoicesRepo = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'inv-1', number: 'INV-000001', customerId: 'c1', balanceDue: 40 }),
    };
    const customersRepo = {
      findOneBy: vi.fn().mockResolvedValue({ id: 'c1', email: 'bob@example.com', tradeName: 'Bob Co' }),
    };
    const service = buildService(email, { customers: customersRepo, invoices: invoicesRepo });
    await service.handle(
      event({ eventType: 'payment.received', payload: { invoiceId: 'inv-1', amount: 80.5, method: 'cash' } }),
    );
    expect(invoicesRepo.findOneBy).toHaveBeenCalledWith({ id: 'inv-1', tenantId: TENANT });
    expect(customersRepo.findOneBy).toHaveBeenCalledWith({ id: 'c1', tenantId: TENANT });
    const message = (email.sendMail as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string; text: string };
    expect(message.subject).toBe('Payment received for invoice INV-000001');
    expect(message.text).toContain('80.50');
    expect(message.text).toContain('Balance due: 40.00');
  });

  it('sends a goods receipt email to the supplier', async () => {
    const email = { isConfigured: vi.fn(() => true), sendMail: vi.fn(() => Promise.resolve(true)) };
    const suppliersRepo = {
      findOneBy: vi.fn().mockResolvedValue({ id: 's1', email: 'sales@supplier.com', tradeName: 'Acme Supplies' }),
    };
    const service = buildService(email, { suppliers: suppliersRepo });
    await service.handle(
      event({ eventType: 'purchase_receipt', payload: { number: 'GR-000001', orderId: 'o1', supplierId: 's1' } }),
    );
    expect(suppliersRepo.findOneBy).toHaveBeenCalledWith({ id: 's1', tenantId: TENANT });
    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'sales@supplier.com', subject: 'Goods receipt GR-000001 received' }),
    );
  });

  it('ignores event types without an email handler', async () => {
    const email = { isConfigured: vi.fn(() => true), sendMail: vi.fn() };
    const service = buildService(email);
    await service.handle(event({ eventType: 'payroll.posted' }));
    expect(email.sendMail).not.toHaveBeenCalled();
  });
});
