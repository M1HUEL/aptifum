import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';

import { AppModule } from '../src/app.module';

const ADMIN_EMAIL = 'admin@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';

const csv = (content: string): Buffer => Buffer.from(content, 'utf8');

describe('CSV imports (e2e)', () => {
  let app: INestApplication;
  let token: string;

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
      DELETE FROM categories;
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
  });

  afterAll(async () => {
    await app.close();
  });

  const upload = (path: string, content: string, filename = 'data.csv') =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', csv(content), filename);

  it('imports products, creating categories and skipping duplicates', async () => {
    const content = [
      'sku,name,category,brand,unit_of_measure,barcode,purchase_price,sale_price,enabled',
      'IMP-P-1,Import Widget A,Imported,Acme,unit,10001,4.5,9.99,true',
      'IMP-P-2,Import Widget B,Imported,,unit,,2.00,5.00,true',
      'IMP-P-1,Duplicate Sku,Other,,unit,,,,',
      ',,Missing Required,,unit,,,,',
      'IMP-P-3,Bad Price,Imported,,unit,,-5.00,0,true',
    ].join('\n');

    const res = await upload('/api/v1/imports/products/csv', content).expect(201);
    expect(res.body).toMatchObject({
      type: 'products',
      total: 5,
      imported: 2,
      skipped: 1,
    });
    expect(res.body.errors.map((e: { row: number }) => e.row)).toEqual([5, 6]);

    const list = await request(app.getHttpServer())
      .get('/api/v1/inventory/products')
      .query({ limit: 100 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const skus = (list.body.data as Array<{ sku: string }>).map((p) => p.sku);
    expect(skus).toContain('IMP-P-1');
    expect(skus).toContain('IMP-P-2');
    expect(skus).not.toContain('IMP-P-3');

    const cats = await request(app.getHttpServer())
      .get('/api/v1/inventory/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((cats.body.data as Array<{ name: string }>).some((c) => c.name === 'Imported')).toBe(true);
  });

  it('rejects CSV files missing required columns', async () => {
    const res = await upload('/api/v1/imports/products/csv', 'name,category\nThing,Stuff\n').expect(400);
    expect(res.body.message).toContain('Missing required columns');
  });

  it('rejects malformed CSV rows', async () => {
    const res = await upload('/api/v1/imports/products/csv', 'a,b\n1,2,3\n').expect(400);
    expect(res.body.message).toContain('columns');
  });

  it('rejects uploads without a file part', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/imports/products/csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.message).toContain('file is required');
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/imports/products/csv')
      .attach('file', csv('sku,name\nX,Y\n'), 'p.csv')
      .expect(401);
  });

  it('imports customers and normalizes tax ids', async () => {
    const content = [
      'code,trade_name,legal_name,tax_id,email,phone,address,currency,credit_limit,state,tax_exempt,active',
      'IMP-C-1,Import Customer One,Import Customer One LLC,12-3456789,one@example.com,+1 555 0100,1 Main St,USD,5000,CA,false,true',
      'IMP-C-2,Import Customer Two,,987654321,,+1 555 0101,,,,NY,false,true',
      'IMP-C-1,Duplicate Code,,123456789,,,,,,,,',
    ].join('\n');

    const res = await upload('/api/v1/imports/customers/csv', content).expect(201);
    expect(res.body).toMatchObject({ type: 'customers', total: 3, imported: 2, skipped: 1, errors: [] });

    const list = await request(app.getHttpServer())
      .get('/api/v1/sales/customers')
      .query({ limit: 100 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const customers = list.body.data as Array<{
      code: string;
      taxId: string | null;
      state: string | null;
      creditLimit: number;
    }>;
    const one = customers.find((c) => c.code === 'IMP-C-1');
    expect(one?.taxId).toBe('123456789');
    expect(one?.state).toBe('CA');
    expect(one?.creditLimit).toBe(5000);
  });

  it('imports suppliers', async () => {
    const content = [
      'code,trade_name,legal_name,tax_id,email,currency,payment_terms,credit_limit,active',
      'IMP-S-1,Import Supplier One,Import Supplier One LLC,111111111,sup@example.com,USD,net30,10000,true',
      'IMP-S-2,Import Supplier Two,,,,EUR,,,true',
    ].join('\n');

    const res = await upload('/api/v1/imports/suppliers/csv', content).expect(201);
    expect(res.body).toMatchObject({ type: 'suppliers', imported: 2, skipped: 0, errors: [] });

    const list = await request(app.getHttpServer())
      .get('/api/v1/purchasing/suppliers')
      .query({ limit: 100 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const suppliers = list.body.data as Array<{ code: string; paymentTerms: string | null }>;
    const one = suppliers.find((s) => s.code === 'IMP-S-1');
    expect(one?.paymentTerms).toBe('net30');
  });

  it('imports initial stock and accumulates quantities and average cost', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ sku: 'IMP-STK-1', name: 'Stock Product', unitOfMeasure: 'unit', purchasePrice: 1, salePrice: 5 })
      .expect(201);
    const warehouseRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'IMP_WHS', name: 'Import Warehouse' })
      .expect(201);
    const productId = productRes.body.id as string;
    const warehouseId = warehouseRes.body.id as string;

    const content = [
      'sku,warehouse,quantity,unit_cost',
      'IMP-STK-1,IMP_WHS,100,1.50',
      'IMP-STK-1,IMP_WHS,50,2.00',
      'UNKNOWN,IMP_WHS,10,1.00',
      'IMP-STK-1,UNKNOWN_WHS,10,1.00',
      'IMP-STK-1,IMP_WHS,0,1.00',
    ].join('\n');

    const res = await upload('/api/v1/imports/initial-stock/csv', content).expect(201);
    expect(res.body).toMatchObject({ type: 'initial-stock', total: 5, imported: 2, skipped: 0 });
    expect(res.body.errors).toHaveLength(3);

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const rows = stock.body as Array<{ warehouseId: string; quantity: number; averageCost: number }>;
    const row = rows.find((r) => r.warehouseId === warehouseId);
    expect(row?.quantity).toBe(150);
    expect(row?.averageCost).toBeCloseTo((100 * 1.5 + 50 * 2) / 150, 2);

    const movements = await request(app.getHttpServer())
      .get('/api/v1/inventory/movements')
      .query({ productId, movementType: 'inbound' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const list = movements.body.data as Array<{ referenceType: string; quantity: number }>;
    expect(list).toHaveLength(2);
    expect(list.every((m) => m.referenceType === 'import')).toBe(true);
  });
});
