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

interface TrialBalanceRow {
  code: string;
  debit: number;
  credit: number;
}

describe('E2E workflows: purchasing -> inventory and payroll -> accounting', () => {
  let app: INestApplication;
  let token: string;
  let productA: Created;
  let productB: Created;
  let warehouse: Created;
  let supplierId: string;
  let orderId: string;
  let orderItemAId: string;
  let orderItemBId: string;
  let employee: Created;
  let payrollId: string;

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

    const [supplier, a, b, wh, dep] = await Promise.all([
      api('post', '/purchasing/suppliers', {
        code: 'E2EP-S1',
        tradeName: 'E2E Purchasing Supplier',
        currency: 'USD',
      }),
      api('post', '/inventory/products', {
        sku: 'E2EP-A',
        name: 'E2E Raw Material A',
        unitOfMeasure: 'kg',
        purchasePrice: 5,
        salePrice: 15,
      }),
      api('post', '/inventory/products', {
        sku: 'E2EP-B',
        name: 'E2E Raw Material B',
        unitOfMeasure: 'kg',
        purchasePrice: 10,
        salePrice: 25,
      }),
      api('post', '/inventory/warehouses', { code: 'E2EP_WH', name: 'E2E Production WH' }),
      api('post', '/hr/departments', { code: 'E2EPY-DEP', name: 'E2E Payroll Dept' }),
    ]);
    const supplierIdRaw = (supplier.body as Created).id;
    supplierId = supplierIdRaw;
    productA = a.body as Created;
    productB = b.body as Created;
    warehouse = wh.body as Created;
    const departmentId = (dep.body as Created).id;

    const orderRes = await api('post', '/purchasing/purchase-orders', {
      supplierId,
      warehouseId: warehouse.id,
      items: [
        { productId: productA.id, quantity: 10, unitCost: 5, taxRate: 0.1 },
        { productId: productB.id, quantity: 20, unitCost: 10, taxRate: 0.1 },
      ],
    });
    orderId = (orderRes.body as Created).id;
    expect(orderRes.body.status).toBe('draft');
    expect(orderRes.body.subtotal).toBe(250);
    expect(orderRes.body.tax).toBe(25);
    expect(orderRes.body.total).toBe(275);

    await api('post', `/purchasing/purchase-orders/${orderId}/approve`);

    const detail = await api('get', `/purchasing/purchase-orders/${orderId}`);
    const items = detail.body.items as Array<{ id: string; productId: string }>;
    orderItemAId = items.find((i) => i.productId === productA.id)!.id;
    orderItemBId = items.find((i) => i.productId === productB.id)!.id;

    await api('post', `/purchasing/purchase-orders/${orderId}/receipts`, {
      items: [
        { orderItemId: orderItemAId, quantity: 10 },
        { orderItemId: orderItemBId, quantity: 10 },
      ],
    });

    const partial = await api('get', `/purchasing/purchase-orders/${orderId}`);
    expect(partial.body.status).toBe('approved');

    await api('post', `/purchasing/purchase-orders/${orderId}/receipts`, {
      items: [{ orderItemId: orderItemBId, quantity: 10 }],
    });

    const received = await api('get', `/purchasing/purchase-orders/${orderId}`);
    expect(received.body.status).toBe('received');

    const empRes = await api('post', '/hr/employees', {
      employeeNo: 'E2EPY-1',
      firstName: 'E2E',
      lastName: 'Payroll',
      departmentId,
      hireDate: '2026-01-01',
      salary: 1000,
      salaryFrequency: 'monthly',
    });
    employee = empRes.body as Created;

    const period = new Date().toISOString().slice(0, 7);
    const payrollRes = await api('post', '/hr/payrolls/generate', {
      period,
      lines: [{ employeeId: employee.id, bonus: 100, overtime: 50, deductions: 60 }],
    });
    payrollId = (payrollRes.body as Created).id;
  });

  afterAll(async () => {
    await app.close();
    const dataSource = createDataSource();
    await dataSource.initialize();
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
      UPDATE document_series SET next_number = 1;
    `);
    await dataSource.destroy();
  });

  it('receives goods into inventory and values stock correctly', async () => {
    const val = await request(app.getHttpServer())
      .get('/api/v1/reports/inventory/valuation')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const rows = val.body.data as Array<{ sku: string; quantity: number; value: number }>;
    expect(rows.find((r) => r.sku === 'E2EP-A')).toMatchObject({ quantity: 10, value: 50 });
    expect(rows.find((r) => r.sku === 'E2EP-B')).toMatchObject({ quantity: 20, value: 200 });
    expect(val.body.totals).toEqual({ quantity: 30, value: 250 });
  });

  it('posts balanced inventory / accounts payable entries', async () => {
    const tb = await request(app.getHttpServer())
      .get('/api/v1/accounting/reports/trial-balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byCode = new Map(
      (tb.body.data as TrialBalanceRow[]).map((row) => [row.code, row]),
    );
    expect(byCode.get('1200')?.debit).toBe(250);
    expect(byCode.get('2000')?.credit).toBe(250);
    expect(tb.body.totals).toEqual({ debit: 250, credit: 250 });
  });

  it('generates a draft payroll with computed totals', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/hr/payrolls/${payrollId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'draft',
      totalGross: 1150,
      totalDeductions: 60,
      totalNet: 1090,
    });
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0]).toMatchObject({ gross: 1150, bonus: 100, overtime: 50, deductions: 60, net: 1090 });
  });

  it('posts the payroll as a balanced journal entry', async () => {
    const posted = await request(app.getHttpServer())
      .post(`/api/v1/hr/payrolls/${payrollId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(posted.body.status).toBe('posted');
    expect(posted.body.postedEntryId).toBeDefined();

    const tb = await request(app.getHttpServer())
      .get('/api/v1/accounting/reports/trial-balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byCode = new Map(
      (tb.body.data as TrialBalanceRow[]).map((row) => [row.code, row]),
    );
    expect(byCode.get('6000')?.debit).toBe(1150);
    expect(byCode.get('2001')?.credit).toBe(1090);
    expect(byCode.get('2002')?.credit).toBe(60);
    expect(tb.body.totals).toEqual({ debit: 1400, credit: 1400 });
  });

  it('reflects payables and inventory on the dashboard', async () => {
    const dash = await request(app.getHttpServer())
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dash.body).toMatchObject({
      payables: 250,
      inventoryValue: 250,
      receivables: 0,
      openPurchaseOrders: 0,
    });
  });
});

describe('E2E supplier bills: receipt -> bill -> payment', () => {
  let app: INestApplication;
  let token: string;
  let billId: string;
  let supplierId: string;

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

    const [supplier, a, b, wh] = await Promise.all([
      api('post', '/purchasing/suppliers', {
        code: 'E2EB-S1',
        tradeName: 'E2E Bills Supplier',
        currency: 'USD',
      }),
      api('post', '/inventory/products', {
        sku: 'E2EB-A',
        name: 'E2E Bill Raw Material',
        unitOfMeasure: 'kg',
        purchasePrice: 5,
        salePrice: 15,
      }),
      api('post', '/inventory/products', {
        sku: 'E2EB-B',
        name: 'E2E Bill Material B',
        unitOfMeasure: 'kg',
        purchasePrice: 10,
        salePrice: 25,
      }),
      api('post', '/inventory/warehouses', { code: 'E2EB_WH', name: 'E2E Bills WH' }),
    ]);
    const supplierRawId = (supplier.body as Created).id;
    supplierId = supplierRawId;
    const productA = a.body as Created;
    const productB = b.body as Created;

    const orderRes = await api('post', '/purchasing/purchase-orders', {
      supplierId,
      warehouseId: (wh.body as Created).id,
      items: [
        { productId: productA.id, quantity: 10, unitCost: 5, taxRate: 0.1 },
        { productId: productB.id, quantity: 10, unitCost: 10, taxRate: 0.1 },
      ],
    });
    const orderId = (orderRes.body as Created).id;
    await api('post', `/purchasing/purchase-orders/${orderId}/approve`);

    const detail = await api('get', `/purchasing/purchase-orders/${orderId}`);
    const items = detail.body.items as Array<{ id: string; productId: string }>;
    const receiptRes = await api('post', `/purchasing/purchase-orders/${orderId}/receipts`, {
      items: [
        { orderItemId: items.find((i) => i.productId === productA.id)!.id, quantity: 10 },
        { orderItemId: items.find((i) => i.productId === productB.id)!.id, quantity: 10 },
      ],
    });

    const draftRes = await api('post', '/purchasing/bills', {
      supplierId,
      receiptId: (receiptRes.body as Created).id,
      items: [
        { productId: productA.id, description: 'Bill raw material A', quantity: 10, unitPrice: 5, taxRate: 0.1 },
        { productId: productB.id, description: 'Bill material B', quantity: 10, unitPrice: 10, taxRate: 0.1 },
      ],
    });
    billId = (draftRes.body as Created).id;
    expect(draftRes.body).toMatchObject({ status: 'draft', subtotal: 150, tax: 15, total: 165 });

    const issued = await api('post', `/purchasing/bills/${billId}/issue`);
    expect(issued.body).toMatchObject({ status: 'issued', number: 'SB-000001', balanceDue: 165 });
  });

  afterAll(async () => {
    await app.close();
    const dataSource = createDataSource();
    await dataSource.initialize();
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
      UPDATE document_series SET next_number = 1;
    `);
    await dataSource.destroy();
  });

  it('posts the AP variance on issue and pays the bill off', async () => {
    const tb = await request(app.getHttpServer())
      .get('/api/v1/accounting/reports/trial-balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byCode = new Map((tb.body.data as TrialBalanceRow[]).map((row) => [row.code, row]));
    expect(byCode.get('2000')?.credit).toBe(165);
    expect(byCode.get('5000')?.debit).toBe(15);
    expect(tb.body.totals).toEqual({ debit: 165, credit: 165 });

    await request(app.getHttpServer())
      .post('/api/v1/purchasing/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ supplierId, billId, method: 'cash', amount: 165 })
      .expect((res) => {
        if (res.status >= 400) {
          throw new Error(`POST /purchasing/payments -> ${res.status}: ${JSON.stringify(res.body)}`);
        }
      });

    const list = await request(app.getHttpServer())
      .get('/api/v1/purchasing/payments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const payments = list.body.data as Array<{ billId: string | null; amount: number }>;
    expect(payments.some((p) => p.billId === billId && p.amount === 165)).toBe(true);
  });

  it('marks the bill paid and reflects remaining payables from unbilled receipts', async () => {
    const bill = await request(app.getHttpServer())
      .get(`/api/v1/purchasing/bills/${billId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(bill.body).toMatchObject({ status: 'paid', paidAmount: 165, balanceDue: 0 });

    const dash = await request(app.getHttpServer())
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dash.body).toMatchObject({ payables: 0 });
  });
});
