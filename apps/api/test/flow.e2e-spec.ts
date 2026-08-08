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

describe('Vertical flow: sales -> accounting -> reports (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let productA: Created;
  let productB: Created;
  let warehouse: Created;
  let customer: Created;

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
      DELETE FROM suppliers;
      DELETE FROM production_order_lines;
      DELETE FROM production_orders;
      DELETE FROM production_bom_lines;
      DELETE FROM production_boms;
      DELETE FROM stock_movements;
      DELETE FROM product_stock;
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

    const [a, b, wh, cust] = await Promise.all([
      api('post', '/inventory/products', {
        sku: 'E2E-A',
        name: 'E2E Flour',
        unitOfMeasure: 'kg',
        purchasePrice: 1,
        salePrice: 10,
      }),
      api('post', '/inventory/products', {
        sku: 'E2E-B',
        name: 'E2E Sugar',
        unitOfMeasure: 'kg',
        purchasePrice: 2,
        salePrice: 20,
      }),
      api('post', '/inventory/warehouses', { code: 'E2E_WH', name: 'E2E WH' }),
      api('post', '/sales/customers', { code: 'E2E-C1', tradeName: 'E2E Customer', currency: 'USD' }),
    ]);
    productA = a.body as Created;
    productB = b.body as Created;
    warehouse = wh.body as Created;
    customer = cust.body as Created;

    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: productA.id,
      warehouseId: warehouse.id,
      quantity: 100,
      unitCost: 1,
    });
    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: productB.id,
      warehouseId: warehouse.id,
      quantity: 100,
      unitCost: 2,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an invoice with automatic stock consumption and COGS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [
          { productId: productA.id, quantity: 2, unitPrice: 10, taxRate: 0.08 },
          { productId: productB.id, quantity: 1, unitPrice: 20, taxRate: 0.08 },
        ],
      })
      .expect(201);

    expect(res.body.number).toBe('INV-000001');
    expect(res.body.total).toBe(43.2);
    expect(res.body.balanceDue).toBe(43.2);
  });

  it('registers a payment and clears the receivable', async () => {
    const invoice = await request(app.getHttpServer())
      .get('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const open = (invoice.body.data as Array<{ id: string; total: number }>).find(
      (i) => i.total === 43.2,
    );
    expect(open).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/sales/invoices/${open!.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'cash', amount: 43.2 })
      .expect(201);

    const paid = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${open!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(paid.body.balanceDue).toBe(0);
  });

  it('posts balanced journal entries', async () => {
    const tb = await request(app.getHttpServer())
      .get('/api/v1/accounting/reports/trial-balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(tb.body.totals.debit).toBe(90.4);
    expect(tb.body.totals.credit).toBe(90.4);
  });

  it('reports inventory valuation after consumption', async () => {
    const val = await request(app.getHttpServer())
      .get('/api/v1/reports/inventory/valuation')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const rows = val.body.data as Array<{ sku: string; quantity: number; value: number }>;
    expect(rows.find((r) => r.sku === 'E2E-A')).toMatchObject({ quantity: 98, value: 98 });
    expect(rows.find((r) => r.sku === 'E2E-B')).toMatchObject({ quantity: 99, value: 198 });
    expect(val.body.totals).toEqual({ quantity: 197, value: 296 });
  });

  it('reports sales summary and per-product gross profit', async () => {
    const summary = await request(app.getHttpServer())
      .get('/api/v1/reports/sales/summary?groupBy=month')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(summary.body.data[0]).toMatchObject({ revenue: 40, tax: 3.2, total: 43.2, invoices: 1 });

    const byProduct = await request(app.getHttpServer())
      .get('/api/v1/reports/sales/by-product')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const a = (byProduct.body.data as Array<{ sku: string; revenue: number; cogs: number }>).find(
      (r) => r.sku === 'E2E-A',
    );
    const b = (byProduct.body.data as Array<{ sku: string; revenue: number; cogs: number }>).find(
      (r) => r.sku === 'E2E-B',
    );
    expect(a).toMatchObject({ revenue: 20, cogs: 2, grossProfit: 18 });
    expect(b).toMatchObject({ revenue: 20, cogs: 2, grossProfit: 18 });
  });

  it('reports financial statements and dashboard are balanced', async () => {
    const income = await request(app.getHttpServer())
      .get('/api/v1/reports/financial/income-statement')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(income.body).toMatchObject({
      revenue: { total: 40 },
      costOfSales: { total: 4 },
      operatingExpenses: { total: 0 },
      netIncome: 36,
    });

    const bs = await request(app.getHttpServer())
      .get('/api/v1/reports/financial/balance-sheet')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(bs.body.totalAssets).toBe(39.2);
    expect(bs.body.totalLiabilitiesAndEquity).toBe(39.2);
    expect(bs.body.assets.total).toBe(39.2);
    expect(bs.body.liabilities.total).toBe(3.2);
    expect(bs.body.equity.total).toBe(36);

    const dash = await request(app.getHttpServer())
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dash.body).toMatchObject({
      salesToday: 43.2,
      salesMonth: 43.2,
      monthInvoices: 1,
      receivables: 0,
      payables: 0,
      inventoryValue: 296,
      lowStockProducts: 0,
      openPurchaseOrders: 0,
      productionInProgress: 0,
      netIncomeMonth: 36,
    });
  });

  it('exports valuation as CSV', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/reports/inventory/valuation?format=csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('productId,sku,');
    expect(res.text).toContain('E2E-A');
  });
});
