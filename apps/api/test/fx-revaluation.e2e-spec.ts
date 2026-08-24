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

describe('FX revaluation and realized FX on settlement (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: Created;
  let warehouse: Created;
  let customer: Created;
  let supplier: Created;

  const utcDay = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const bookedDate = utcDay(-14);
  const revalDate = utcDay(1);
  const laterDate = utcDay(6);

  const tb = () =>
    request(app.getHttpServer())
      .get('/api/v1/accounting/reports/trial-balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

  const balanceOf = (body: { data: Array<{ code: string; balance: number }> }, code: string) =>
    body.data.find((row) => row.code === code)?.balance ?? 0;

  const createRate = (rate: number, rateDate: string) =>
    request(app.getHttpServer())
      .post('/api/v1/exchange-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ baseCurrency: 'USD', quoteCurrency: 'EUR', rate, rateDate })
      .expect(201);

  const revalue = (date: string) =>
    request(app.getHttpServer())
      .post('/api/v1/accounting/revaluations')
      .set('Authorization', `Bearer ${token}`)
      .send({ date })
      .expect(201);

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

    const [p, wh, cust, sup] = await Promise.all([
      api('post', '/inventory/products', {
        sku: 'E2E-FX',
        name: 'E2E Import Product',
        unitOfMeasure: 'unit',
        purchasePrice: 1,
        salePrice: 100,
      }),
      api('post', '/inventory/warehouses', { code: 'FX_WH', name: 'FX WH' }),
      api('post', '/sales/customers', { code: 'E2E-FXC', tradeName: 'E2E FX Customer', currency: 'EUR' }),
      api('post', '/purchasing/suppliers', { code: 'E2E-FXS', tradeName: 'E2E FX Supplier', currency: 'EUR' }),
    ]);
    product = p.body as Created;
    warehouse = wh.body as Created;
    customer = cust.body as Created;
    supplier = sup.body as Created;

    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 100,
      unitCost: 1,
    });

    await createRate(1.1, bookedDate);
    await createRate(1.25, revalDate);
    await createRate(1.3, laterDate);
  });

  afterAll(async () => {
    await app.close();
  });

  it('books a EUR invoice at the functional rate and revalues the open balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [{ productId: product.id, quantity: 1, unitPrice: 100, taxRate: 0 }],
      })
      .expect(201);

    expect(res.body).toMatchObject({ currency: 'EUR', total: 100, balanceDue: 100 });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.exchangeRate).toBe(1.1);

    const before = await tb();
    expect(before.body.totals).toEqual({ debit: 111, credit: 111 });
    expect(balanceOf(before.body, '1100')).toBe(110);
    expect(balanceOf(before.body, '4000')).toBe(110);
    expect(balanceOf(before.body, '5000')).toBe(1);

    const reval = await revalue(revalDate);
    expect(reval.body.entries).toEqual([
      {
        documentType: 'invoice',
        documentId: expect.any(String),
        number: expect.stringContaining('INV-'),
        currency: 'EUR',
        balanceDue: 100,
        rate: 1.25,
        adjustment: 15,
        entryId: expect.any(String),
      },
    ]);

    const after = await tb();
    expect(after.body.totals).toEqual({ debit: 126, credit: 126 });
    expect(balanceOf(after.body, '1100')).toBe(125);
    expect(balanceOf(after.body, '4200')).toBe(15);
  });

  it('re-running revaluation on the same date is a no-op and a later rate adjusts incrementally', async () => {
    const same = await revalue(revalDate);
    expect(same.body.entries).toEqual([]);

    const later = await revalue(laterDate);
    expect(later.body.entries).toHaveLength(1);
    expect(later.body.entries[0]).toMatchObject({ adjustment: 20, rate: 1.3 });

    const after = await tb();
    expect(after.body.totals).toEqual({ debit: 161, credit: 161 });
    expect(balanceOf(after.body, '1100')).toBe(130);
    expect(balanceOf(after.body, '4200')).toBe(20);
  });

  it('settlement realizes the FX gain and the next revaluation clears the receivable', async () => {
    const invoice = await request(app.getHttpServer())
      .get('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const open = (invoice.body.data as Array<{ id: string; currency: string }>).find((i) => i.currency === 'EUR');
    expect(open).toBeDefined();

    const payment = await request(app.getHttpServer())
      .post(`/api/v1/sales/invoices/${open!.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'cash', amount: 100, receivedAt: revalDate })
      .expect(201);
    expect(payment.body).toMatchObject({ amount: 100, balanceDue: 0 });

    const paid = await tb();
    expect(balanceOf(paid.body, '1100')).toBe(20);
    expect(balanceOf(paid.body, '4200')).toBe(35);

    const clear = await revalue(laterDate);
    expect(clear.body.entries).toEqual([]);

    const settled = await tb();
    expect(balanceOf(settled.body, '1100')).toBe(0);
    expect(balanceOf(settled.body, '1000')).toBe(125);
    expect(balanceOf(settled.body, '4000')).toBe(110);
    expect(balanceOf(settled.body, '4200')).toBe(15);
    expect(settled.body.totals).toEqual({ debit: 306, credit: 306 });
  });

  it('revalues open AP on a supplier bill and realizes the FX loss on payment', async () => {
    const bill = await request(app.getHttpServer())
      .post('/api/v1/purchasing/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: supplier.id,
        currency: 'EUR',
        billDate: bookedDate,
        items: [{ description: 'FX import', quantity: 1, unitPrice: 100 }],
      })
      .expect(201);

    const issued = await request(app.getHttpServer())
      .post(`/api/v1/purchasing/bills/${bill.body.id}/issue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(issued.body).toMatchObject({ currency: 'EUR', exchangeRate: 1.1, total: 100, status: 'issued' });

    const afterIssue = await tb();
    expect(balanceOf(afterIssue.body, '2000')).toBe(110);
    expect(balanceOf(afterIssue.body, '5000')).toBe(111);

    const reval = await revalue(revalDate);
    const billRow = reval.body.entries.find((e: { documentType: string }) => e.documentType === 'supplier_bill');
    expect(billRow).toMatchObject({ documentType: 'supplier_bill', adjustment: 15, rate: 1.25 });

    const afterReval = await tb();
    expect(balanceOf(afterReval.body, '2000')).toBe(125);
    expect(balanceOf(afterReval.body, '6100')).toBe(15);

    await request(app.getHttpServer())
      .post('/api/v1/purchasing/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: supplier.id,
        billId: bill.body.id,
        method: 'cash',
        amount: 100,
        paidAt: revalDate,
      })
      .expect(201);

    const afterPayment = await tb();
    expect(balanceOf(afterPayment.body, '2000')).toBe(15);
    expect(balanceOf(afterPayment.body, '6100')).toBe(30);

    const clear = await revalue(laterDate);
    expect(clear.body.entries).toEqual([]);

    const settled = await tb();
    expect(balanceOf(settled.body, '2000')).toBe(0);
    expect(balanceOf(settled.body, '6100')).toBe(15);
    expect(balanceOf(settled.body, '5000')).toBe(111);
    expect(settled.body.totals).toEqual({ debit: 571, credit: 571 });
  });
});
