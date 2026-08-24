import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { PaymentProviderConfig } from '@aptifum/database';

export interface CreateCheckoutSessionInput {
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}

@Injectable()
export class StripeClient {
  private readonly logger = new Logger(StripeClient.name);

  async createCheckoutSession(
    config: PaymentProviderConfig,
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSessionResult> {
    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set('success_url', input.successUrl);
    body.set('cancel_url', input.cancelUrl);
    body.set('line_items[0][quantity]', '1');
    body.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    body.set('line_items[0][price_data][unit_amount]', String(Math.round(input.amount * 100)));
    body.set('line_items[0][price_data][product_data][name]', input.description);
    for (const [key, value] of Object.entries(input.metadata)) {
      body.set(`metadata[${key}]`, value);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (input.idempotencyKey) {
      headers['Idempotency-Key'] = input.idempotencyKey;
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers,
      body: body.toString(),
    });
    const data = (await res.json()) as {
      url?: string;
      id?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.url || !data.id) {
      this.logger.warn(`Stripe checkout session creation failed: ${data.error?.message ?? res.status}`);
      throw new BadRequestException('Failed to create Stripe checkout session');
    }
    return { url: data.url, sessionId: data.id };
  }
}
