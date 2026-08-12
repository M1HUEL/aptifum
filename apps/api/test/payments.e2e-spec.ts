import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';
import { json, urlencoded, NextFunction, Request, Response } from 'express';
import { AppModule } from '../src/app.module';

const ADMIN_EMAIL = 'admin@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';
const WEBHOOK_SECRET = 'whsec_abcdefghij';
const SECRET_KEY = 'sk_test_abcdefghij';

interface Created {
  id: string;
}

describe('Payment integrations: Stripe provider + webhook (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: Created;
  let warehouse: Created;
  let customer: Created;
  let invoice: { id: string; balanceDue: number };

  beforeAll(async () => {
    resetEnv();
    const base = getEnv();
    setEnv({ ...base, DB_NAME: base.DB_NAME_TEST });

    const dataSource = createDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(`
      DELETE FROM product_lots;
      DELETE FROM invoice_items;
      DELETE FROM payments;
      DELETE FROM invoices;
      DELETE FROM sales_order_items;
      DELETE FROM sales_orders;
      DELETE FROM crm_activities;
      DELETE FROM crm_opportunities;
      DELETE FROM crm_leads;
      DELETE FROM crm_contacts;
      DELETE FROM customers;
      DELETE FROM goods_receipt_items;
      DELETE FROM goods_receipts;
      DELETE FROM purchase_order_items;
      DELETE FROM purchase_orders;
      DELETE FROM supplier_payments;
      DELETE FROM supplier_bill_items;
      DELETE FROM supplier_bills;
      DELETE FROM suppliers;
      DELETE FROM production_order_lines;
      DELETE FROM production_orders;
      DELETE FROM production_bom_lines;
      DELETE FROM production_boms;
      DELETE FROM stock_movements;
      DELETE FROM product_stock;
      DELETE FROM product_variants;
      DELETE FROM products;
      DELETE FROM warehouse_locations;
      DELETE FROM warehouses;
      DELETE FROM hr_attendance;
      DELETE FROM hr_leaves;
      DELETE FROM hr_payroll_lines;
      DELETE FROM hr_payrolls;
      DELETE FROM hr_employees;
      DELETE FROM hr_departments;
      DELETE FROM journal_entry_lines;
      DELETE FROM journal_entries;
      DELETE FROM payment_providers;
      DELETE FROM idempotency_keys;
      DELETE FROM outbox_events;
      UPDATE document_series SET next_number = 1;
    `);
    await dataSource.destroy();
    await seed();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use((req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
      if (!req.url.startsWith('/api/v1/webhooks/')) {
        return next();
      }
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        next();
      });
      req.on('error', next);
    });
    app.use(json({ limit: '1mb' }));
    app.use(urlencoded({ extended: true, limit: '1mb' }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    token = login.body.accessToken as string;

    const api = (method: 'get' | 'post' | 'put', path: string, body?: unknown) => {
      const req = request(app.getHttpServer())[method](`/api/v1${path}`);
      req.set('Authorization', `Bearer ${token}`);
      if (body !== undefined) {
        req.send(body as object);
      }
      return req.expect((res) => {
        if (res.status >= 400) {
          throw new Error(`${method.toUpperCase()} ${path} -> ${res.status}: ${JSON.stringify(res.body)}`);
        }
      });
    };

    const [p, wh, cust] = await Promise.all([
      api('post', '/inventory/products', {
        sku: 'PAY-E2E',
        name: 'Pay E2E Product',
        unitOfMeasure: 'unit',
        purchasePrice: 1,
        salePrice: 10,
      }),
      api('post', '/inventory/warehouses', { code: 'PAY_WH', name: 'Pay WH' }),
      api('post', '/sales/customers', { code: 'PAY-C1', tradeName: 'Pay Customer', currency: 'USD' }),
    ]);
    product = p.body as Created;
    warehouse = wh.body as Created;
    customer = cust.body as Created;

    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 100,
      unitCost: 1,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for provider endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/payments/providers').expect(401);
  });

  it('rejects a checkout request when no provider is configured', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/payments/invoices/00000000-0000-4000-8000-000000000000/checkout')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('upserts and masks the Stripe provider', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/payments/providers/stripe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        environment: 'test',
        secretKey: SECRET_KEY,
        webhookSecret: WEBHOOK_SECRET,
        isEnabled: true,
      })
      .expect(200);
    expect(res.body.secretKeyMasked).toContain('********');
    expect(res.body.webhookSecretMasked).toContain('********');
    expect(res.body.webhookPath).toBe('/api/v1/webhooks/stripe');
    expect(res.body.isEnabled).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(SECRET_KEY);
  });

  it('lists providers with masked secrets', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payments/providers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(JSON.stringify(res.body[0])).not.toContain('sk_test');
  });

  it('creates an issued invoice with an outstanding balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [{ productId: product.id, quantity: 2, unitPrice: 10, taxRate: 0.08 }],
      })
      .expect(201);
    invoice = res.body as { id: string; balanceDue: number };
    expect(invoice.balanceDue).toBe(21.6);
  });

  it('records a card payment from a signed Stripe webhook', async () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_abc123',
          amount_total: 2160,
          currency: 'usd',
          metadata: { invoiceId: invoice.id },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('Stripe-Signature', `t=${timestamp},v1=${signature}`)
      .send(payload)
      .expect(201);
    expect(res.body).toEqual({ received: true });

    const paid = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(paid.body.balanceDue).toBe(0);
    expect(paid.body.paidAmount).toBe(21.6);
  });

  it('is idempotent on webhook replay', async () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_abc123',
          amount_total: 2160,
          currency: 'usd',
          metadata: { invoiceId: invoice.id },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('Stripe-Signature', `t=${timestamp},v1=${signature}`)
      .send(payload)
      .expect(201);

    const paid = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(paid.body.balanceDue).toBe(0);
    expect(paid.body.paidAmount).toBe(21.6);
  });

  it('rejects a webhook with an invalid signature', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('Stripe-Signature', 't=1,v1=deadbeef')
      .send('{"type":"checkout.session.completed"}')
      .expect(400);
  });

  it('emits exactly one payment.received outbox event for the invoice', async () => {
    const dataSource = createDataSource();
    await dataSource.initialize();
    const rows = await dataSource.query<Array<{ count: number }>>(
      `SELECT count(*)::int AS count FROM outbox_events
        WHERE event_type = 'payment.received' AND payload->>'invoiceId' = $1`,
      [invoice.id],
    );
    await dataSource.destroy();
    expect(rows[0].count).toBe(1);
  });
});
