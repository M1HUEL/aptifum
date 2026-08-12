import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';
import { AppModule } from '../src/app.module';

const ADMIN_EMAIL = 'admin@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';

interface Created {
  id: string;
}

describe('Multi-currency POS sale and payment (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: Created;
  let warehouse: Created;
  let customer: Created;

  const rateDate = '2026-08-01';
  const bookedRate = 0.92;

  const tb = () =>
    request(app.getHttpServer())
      .get('/api/v1/accounting/reports/trial-balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

  const balanceOf = (body: { data: Array<{ code: string; balance: number }> }, code: string) =>
    body.data.find((row) => row.code === code)?.balance ?? 0;

  const createInvoice = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

  const pay = (invoiceId: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/api/v1/sales/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    resetEnv();
    const base = getEnv();
    setEnv({ ...base, DB_NAME: base.DB_NAME_TEST });

    const dataSource = createDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(`
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
      DELETE FROM exchange_rates;
      UPDATE document_series SET next_number = 1;
    `);
    await dataSource.destroy();
    await seed();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    token = login.body.accessToken as string;

    const api = (method: 'get' | 'post', path: string, body?: unknown) => {
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
        sku: 'E2E-POSFX',
        name: 'E2E POS FX Product',
        unitOfMeasure: 'unit',
        purchasePrice: 1,
        salePrice: 100,
      }),
      api('post', '/inventory/warehouses', { code: 'POSFX_WH', name: 'POS FX WH' }),
      api('post', '/sales/customers', { code: 'E2E-POSFX', tradeName: 'E2E POS FX Customer' }),
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

    await api('post', '/exchange-rates', {
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rate: bookedRate,
      rateDate,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues a POS invoice in EUR and posts the sale in functional USD', async () => {
    const res = await createInvoice({
      customerId: customer.id,
      warehouseId: warehouse.id,
      currency: 'EUR',
      exchangeRate: bookedRate,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, taxRate: 0 }],
    });

    expect(res.body).toMatchObject({
      currency: 'EUR',
      exchangeRate: bookedRate,
      total: 100,
      balanceDue: 100,
    });

    const after = await tb();
    expect(after.body.totals).toEqual({ debit: 93, credit: 93 });
    expect(balanceOf(after.body, '1100')).toBe(92);
    expect(balanceOf(after.body, '4000')).toBe(92);
    expect(balanceOf(after.body, '5000')).toBe(1);
  });

  it('collects the EUR payment at the booked rate and nets the receivable to zero', async () => {
    const before = await tb();
    const invoice = await createInvoice({
      customerId: customer.id,
      warehouseId: warehouse.id,
      currency: 'EUR',
      exchangeRate: bookedRate,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, taxRate: 0 }],
    });

    const paid = await pay(invoice.body.id, {
      method: 'cash',
      amount: 100,
      currency: 'EUR',
      exchangeRate: bookedRate,
      receivedAt: '2026-08-05',
    }).expect(201);

    expect(paid.body).toMatchObject({ amount: 100, paidAmount: 100, balanceDue: 0 });

    const after = await tb();
    expect(after.body.totals).toEqual({
      debit: before.body.totals.debit + 185,
      credit: before.body.totals.credit + 185,
    });
    expect(balanceOf(after.body, '1100')).toBe(balanceOf(before.body, '1100'));
    expect(balanceOf(after.body, '1000')).toBe(balanceOf(before.body, '1000') + 92);
    expect(balanceOf(after.body, '4000')).toBe(balanceOf(before.body, '4000') + 92);
  });

  it('realizes the FX gain when the payment rate differs from the booked rate', async () => {
    const before = await tb();
    const invoice = await createInvoice({
      customerId: customer.id,
      warehouseId: warehouse.id,
      currency: 'EUR',
      exchangeRate: bookedRate,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, taxRate: 0 }],
    });

    await pay(invoice.body.id, {
      method: 'cash',
      amount: 100,
      currency: 'EUR',
      exchangeRate: 1.0,
      receivedAt: '2026-08-05',
    }).expect(201);

    const after = await tb();
    expect(after.body.totals).toEqual({
      debit: before.body.totals.debit + 193,
      credit: before.body.totals.credit + 193,
    });
    expect(balanceOf(after.body, '1100')).toBe(balanceOf(before.body, '1100'));
    expect(balanceOf(after.body, '1000')).toBe(balanceOf(before.body, '1000') + 100);
    expect(balanceOf(after.body, '4000')).toBe(balanceOf(before.body, '4000') + 92);
    expect(balanceOf(after.body, '4200')).toBe(balanceOf(before.body, '4200') + 8);
  });

  it('resolves the booked rate from configured rates when the invoice omits exchangeRate', async () => {
    const invoice = await createInvoice({
      customerId: customer.id,
      warehouseId: warehouse.id,
      currency: 'EUR',
      items: [{ productId: product.id, quantity: 1, unitPrice: 50, taxRate: 0 }],
    });

    expect(invoice.body.exchangeRate).toBe(bookedRate);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${invoice.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.currency).toBe('EUR');
    expect(detail.body.exchangeRate).toBe(bookedRate);

    await pay(invoice.body.id, { method: 'cash', amount: 50, receivedAt: '2026-08-05' }).expect(
      201,
    );
  });

  it('rejects a payment whose currency does not match the invoice', async () => {
    const invoice = await createInvoice({
      customerId: customer.id,
      warehouseId: warehouse.id,
      currency: 'EUR',
      exchangeRate: bookedRate,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100, taxRate: 0 }],
    });

    const res = await pay(invoice.body.id, {
      method: 'cash',
      amount: 100,
      currency: 'MXN',
      exchangeRate: 18,
      receivedAt: '2026-08-05',
    }).expect(400);

    expect(res.body.message).toContain('does not match');
  });
});
