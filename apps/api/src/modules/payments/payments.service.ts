import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InvoiceStatus, InvoiceType, PaymentMethod, PaymentProvider } from '@aptifum/core';
import { Invoice, PaymentProviderConfig } from '@aptifum/database';

import { InvoicesService } from '../sales/invoices.service';

import { UpsertPaymentProviderDto } from './dto/upsert-payment-provider.dto';
import { StripeClient } from './stripe/stripe-client.service';
import { verifyStripeSignature } from './stripe/stripe-signature.util';

export interface PaymentProviderView {
  id: string | null;
  provider: string;
  environment: string;
  secretKeyMasked: string;
  webhookSecretMasked: string;
  isEnabled: boolean;
  webhookPath: string;
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '********';
  }
  return `${secret.slice(0, 6)}********${secret.slice(-4)}`;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentProviderConfig)
    private readonly providersRepo: Repository<PaymentProviderConfig>,
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
    private readonly stripe: StripeClient,
    private readonly invoices: InvoicesService,
  ) {}

  async listProviders(tenantId: string | null): Promise<PaymentProviderView[]> {
    if (!tenantId) {
      return [];
    }
    const configs = await this.providersRepo.find({ where: { tenantId } });
    return configs.map((config) => this.toView(config));
  }

  async upsertProvider(
    tenantId: string | null,
    provider: PaymentProvider,
    dto: UpsertPaymentProviderDto,
  ): Promise<PaymentProviderView> {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    const existing = await this.providersRepo.findOne({ where: { tenantId, provider } });
    const config = existing ?? this.providersRepo.create({ tenantId, provider });
    config.environment = dto.environment;
    config.secretKey = dto.secretKey;
    config.webhookSecret = dto.webhookSecret;
    if (dto.isEnabled !== undefined) {
      config.isEnabled = dto.isEnabled;
    }
    const saved = await this.providersRepo.save(config);
    return this.toView(saved);
  }

  async createCheckoutUrl(tenantId: string | null, invoiceId: string, origin?: string): Promise<{ url: string }> {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    const config = await this.providersRepo.findOne({ where: { tenantId, provider: 'stripe' } });
    if (!config) {
      throw new BadRequestException('No payment provider configured');
    }
    if (!config.isEnabled) {
      throw new BadRequestException('Payment provider is not enabled');
    }
    const invoice = await this.invoicesRepo.findOne({
      where: { id: invoiceId, tenantId, type: InvoiceType.INVOICE },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Invoice is not issued');
    }
    if (invoice.balanceDue <= 0) {
      throw new BadRequestException('Invoice has no outstanding balance');
    }
    const base = origin && /^https?:\/\//.test(origin) ? origin : 'http://localhost:5173';
    const session = await this.stripe.createCheckoutSession(config, {
      amount: invoice.balanceDue,
      currency: invoice.currency,
      description: `Invoice ${invoice.number}`,
      successUrl: `${base}/invoices`,
      cancelUrl: `${base}/invoices/${invoice.id}`,
      metadata: { invoiceId: invoice.id, tenantId },
      idempotencyKey: `checkout:${invoice.id}`,
    });
    return { url: session.url };
  }

  async handleStripeWebhook(payload: Buffer | string, signature: string): Promise<{ received: boolean }> {
    const configs = await this.providersRepo.find({
      where: { provider: 'stripe', isEnabled: true },
    });
    let matched: PaymentProviderConfig | null = null;
    for (const config of configs) {
      if (verifyStripeSignature({ payload, header: signature, secret: config.webhookSecret })) {
        matched = config;
        break;
      }
    }
    if (!matched) {
      throw new BadRequestException('Invalid webhook signature');
    }
    const raw = payload.toString('utf8');
    const event = JSON.parse(raw) as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          amount_total?: number;
          currency?: string;
          metadata?: Record<string, string>;
        };
      };
    };
    if (event.type !== 'checkout.session.completed') {
      return { received: true };
    }
    const session = event.data?.object;
    const invoiceId = session?.metadata?.invoiceId;
    const sessionId = session?.id;
    if (!invoiceId || !sessionId) {
      return { received: true };
    }
    const dto: { method: PaymentMethod; amount: number; currency?: string; reference: string } = {
      method: PaymentMethod.CARD,
      amount: Number((session.amount_total ?? 0) / 100),
      reference: sessionId,
    };
    if (session.currency) {
      dto.currency = session.currency.toUpperCase();
    }
    await this.invoices.recordPayment(matched.tenantId, null, invoiceId, dto, sessionId);
    return { received: true };
  }

  private toView(config: PaymentProviderConfig): PaymentProviderView {
    return {
      id: config.id,
      provider: config.provider,
      environment: config.environment,
      secretKeyMasked: maskSecret(config.secretKey),
      webhookSecretMasked: maskSecret(config.webhookSecret),
      isEnabled: config.isEnabled,
      webhookPath: `/api/v1/webhooks/${config.provider}`,
    };
  }
}
