import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Customer,
  Invoice,
  OutboxEvent,
  PurchaseOrder,
  Supplier,
  SupplierBill,
} from '@aptifum/database';
import { ModuleName, permission } from '@aptifum/core';
import { EmailService } from './email.service';

@Injectable()
export class EmailNotificationsService {
  private readonly logger = new Logger(EmailNotificationsService.name);

  constructor(
    private readonly email: EmailService,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Supplier) private readonly suppliersRepo: Repository<Supplier>,
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(SupplierBill) private readonly supplierBillsRepo: Repository<SupplierBill>,
    @InjectRepository(PurchaseOrder) private readonly ordersRepo: Repository<PurchaseOrder>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.email.isConfigured()) {
      return;
    }
    switch (event.eventType) {
      case 'invoice.issued':
      case 'credit_note.issued':
        await this.sendInvoiceEvent(event);
        return;
      case 'payment.received':
        await this.sendPaymentReceived(event);
        return;
      case 'purchase_receipt':
        await this.sendPurchaseReceipt(event);
        return;
      case 'reminder.ar_overdue':
        await this.sendArOverdue(event);
        return;
      case 'reminder.ap_overdue':
        await this.sendApOverdue(event);
        return;
      case 'reminder.pending_approval':
        await this.sendPendingApproval(event);
        return;
      default:
        this.logger.warn(`No email handler for outbox event type "${event.eventType}"`);
        return;
    }
  }

  private async sendInvoiceEvent(event: OutboxEvent): Promise<void> {
    const customerId = event.payload.customerId as string | undefined;
    if (!customerId) {
      return;
    }
    const customer = await this.customersRepo.findOneBy({
      id: customerId,
      tenantId: event.tenantId,
    });
    if (!customer?.email) {
      return;
    }
    const label = event.eventType === 'invoice.issued' ? 'Invoice' : 'Credit note';
    await this.email.sendMail({
      to: customer.email,
      subject: `${label} ${event.payload.number} issued`,
      text: [
        `Dear ${customer.tradeName},`,
        '',
        `${label} ${event.payload.number} for ${formatMoney(event.payload.total)} has been issued.`,
        '',
        'Thank you for your business.',
      ].join('\n'),
    });
  }

  private async sendPaymentReceived(event: OutboxEvent): Promise<void> {
    const invoiceId = event.payload.invoiceId as string | undefined;
    if (!invoiceId) {
      return;
    }
    const invoice = await this.invoicesRepo.findOneBy({
      id: invoiceId,
      tenantId: event.tenantId,
    });
    if (!invoice) {
      return;
    }
    const customer = await this.customersRepo.findOneBy({
      id: invoice.customerId,
      tenantId: event.tenantId,
    });
    if (!customer?.email) {
      return;
    }
    await this.email.sendMail({
      to: customer.email,
      subject: `Payment received for invoice ${invoice.number}`,
      text: [
        `Dear ${customer.tradeName},`,
        '',
        `We received your payment of ${formatMoney(event.payload.amount)} for invoice ${invoice.number}.`,
        `Balance due: ${formatMoney(invoice.balanceDue)}.`,
        '',
        'Thank you.',
      ].join('\n'),
    });
  }

  private async sendPurchaseReceipt(event: OutboxEvent): Promise<void> {
    const supplierId = event.payload.supplierId as string | undefined;
    if (!supplierId) {
      return;
    }
    const supplier = await this.suppliersRepo.findOneBy({
      id: supplierId,
      tenantId: event.tenantId,
    });
    if (!supplier?.email) {
      return;
    }
    await this.email.sendMail({
      to: supplier.email,
      subject: `Goods receipt ${event.payload.number} received`,
      text: [
        `Dear ${supplier.tradeName},`,
        '',
        `We received your shipment ${event.payload.number}.`,
        '',
        'Thank you.',
      ].join('\n'),
    });
  }
  private async sendArOverdue(event: OutboxEvent): Promise<void> {
    const invoiceId = event.payload.invoiceId as string | undefined;
    if (!invoiceId) {
      return;
    }
    const invoice = await this.invoicesRepo.findOneBy({
      id: invoiceId,
      tenantId: event.tenantId,
    });
    if (!invoice) {
      return;
    }
    const customer = await this.customersRepo.findOneBy({
      id: invoice.customerId,
      tenantId: event.tenantId,
    });
    if (!customer?.email) {
      return;
    }
    const daysOverdue = Number(event.payload.daysOverdue ?? 0);
    await this.email.sendMail({
      to: customer.email,
      subject: `Payment reminder: invoice ${invoice.number} is overdue`,
      text: [
        `Dear ${customer.tradeName},`,
        '',
        `This is a reminder that invoice ${invoice.number} for ${formatMoney(invoice.total)} is ${daysOverdue} day(s) overdue.`,
        `Balance due: ${formatMoney(invoice.balanceDue)}.`,
        '',
        'Please arrange payment at your earliest convenience.',
        '',
        'Thank you for your business.',
      ].join('\n'),
    });
  }

  private async sendApOverdue(event: OutboxEvent): Promise<void> {
    const billId = event.payload.billId as string | undefined;
    if (!billId) {
      return;
    }
    const bill = await this.supplierBillsRepo.findOneBy({
      id: billId,
      tenantId: event.tenantId,
    });
    if (!bill) {
      return;
    }
    const recipients = await this.tenantEmailsWithPermission(
      event.tenantId,
      permission(ModuleName.PURCHASING, 'read'),
    );
    if (recipients.length === 0) {
      return;
    }
    const supplier = await this.suppliersRepo.findOneBy({
      id: bill.supplierId,
      tenantId: event.tenantId,
    });
    const daysOverdue = Number(event.payload.daysOverdue ?? 0);
    await this.email.sendMail({
      to: recipients.join(', '),
      subject: `Payable reminder: bill ${bill.number ?? bill.id} is overdue`,
      text: [
        `Supplier bill ${bill.number ?? bill.id} from ${supplier?.tradeName ?? 'unknown supplier'} is ${daysOverdue} day(s) overdue.`,
        `Balance due: ${formatMoney(bill.balanceDue)}.`,
        '',
        'Please schedule payment.',
      ].join('\n'),
    });
  }

  private async sendPendingApproval(event: OutboxEvent): Promise<void> {
    const orderId = event.payload.orderId as string | undefined;
    if (!orderId) {
      return;
    }
    const order = await this.ordersRepo.findOneBy({
      id: orderId,
      tenantId: event.tenantId,
    });
    if (!order) {
      return;
    }
    const recipients = await this.tenantEmailsWithPermission(
      event.tenantId,
      permission(ModuleName.PURCHASING, 'write'),
    );
    if (recipients.length === 0) {
      return;
    }
    const supplier = await this.suppliersRepo.findOneBy({
      id: order.supplierId,
      tenantId: event.tenantId,
    });
    const daysPending = Number(event.payload.daysPending ?? 0);
    await this.email.sendMail({
      to: recipients.join(', '),
      subject: `Purchase order ${order.number} awaiting approval`,
      text: [
        `Purchase order ${order.number} (${supplier?.tradeName ?? 'unknown supplier'}) is pending approval.`,
        `Total: ${formatMoney(order.total)}.`,
        `Days pending: ${daysPending}.`,
        '',
        'Please review and approve or cancel it.',
      ].join('\n'),
    });
  }

  private async tenantEmailsWithPermission(tenantId: string, perm: string): Promise<string[]> {
    const rows: Array<{ email: string }> = await this.dataSource.query(
      `SELECT DISTINCT u.email
         FROM users u
         JOIN user_tenants ut ON ut.user_id = u.id AND ut.tenant_id = $1
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
        WHERE u.active = true AND u.deleted_at IS NULL AND r.deleted_at IS NULL
          AND (r.permissions @> $2::jsonb OR r.permissions @> '["*"]'::jsonb)`,
      [tenantId, JSON.stringify([perm])],
    );
    return rows.map((row) => row.email);
  }
}

function formatMoney(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}
