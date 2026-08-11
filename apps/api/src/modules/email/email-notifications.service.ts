import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer, Invoice, OutboxEvent, Supplier } from '@aptifum/database';
import { EmailService } from './email.service';

@Injectable()
export class EmailNotificationsService {
  private readonly logger = new Logger(EmailNotificationsService.name);

  constructor(
    private readonly email: EmailService,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Supplier) private readonly suppliersRepo: Repository<Supplier>,
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
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
}

function formatMoney(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}
