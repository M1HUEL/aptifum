import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StripeClient } from '../src/modules/payments/stripe/stripe-client.service';

describe('StripeClient', () => {
  const config = { secretKey: 'sk_test_abcdefgh' } as never;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a checkout session via the Stripe API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'cs_test_1',
        url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new StripeClient();
    const result = await client.createCheckoutSession(config, {
      amount: 21.6,
      currency: 'USD',
      description: 'Invoice INV-000001',
      successUrl: 'http://localhost:5173/invoices',
      cancelUrl: 'http://localhost:5173/invoices/1',
      metadata: { invoiceId: '1', tenantId: 't1' },
      idempotencyKey: 'checkout:1',
    });

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      sessionId: 'cs_test_1',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer sk_test_abcdefgh',
      'Idempotency-Key': 'checkout:1',
    });
    const body = init.body as string;
    expect(body).toContain('line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=2160');
    expect(body).toContain('metadata%5BinvoiceId%5D=1');
    expect(body).toContain('success_url=http%3A%2F%2Flocalhost%3A5173%2Finvoices');
  });

  it('throws BadRequestException when the API returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      }),
    );

    const client = new StripeClient();
    await expect(
      client.createCheckoutSession(config, {
        amount: 10,
        currency: 'USD',
        description: 'Invoice INV-1',
        successUrl: 'http://localhost:5173/invoices',
        cancelUrl: 'http://localhost:5173/invoices/1',
        metadata: { invoiceId: '1' },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
