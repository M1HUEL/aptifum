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

interface LocationRow {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  active: boolean;
}

describe('Warehouse locations CRUD (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let warehouse: Created;

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

    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'E2E_LOC', name: 'E2E Locations Warehouse' })
      .expect(201);
    warehouse = res.body as Created;
  });

  afterAll(async () => {
    await app.close();
  });

  const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`);
    req.set('Authorization', `Bearer ${token}`);
    if (body !== undefined) {
      req.send(body as object);
    }
    return req;
  };

  const listLocations = async () => {
    const res = await api('get', `/inventory/warehouses/${warehouse.id}/locations`).expect(200);
    return res.body as LocationRow[];
  };

  it('adds a location to the warehouse', async () => {
    const res = await api('post', `/inventory/warehouses/${warehouse.id}/locations`, {
      code: 'A1',
      name: 'Aisle 1',
    }).expect(201);
    expect(res.body).toMatchObject({
      warehouseId: warehouse.id,
      code: 'A1',
      name: 'Aisle 1',
      active: true,
    });
  });

  it('lists locations ordered by name', async () => {
    await api('post', `/inventory/warehouses/${warehouse.id}/locations`, {
      code: 'B1',
      name: 'Back room',
    }).expect(201);
    const locations = await listLocations();
    expect(locations.map((location) => location.code)).toEqual(['A1', 'B1']);
  });

  it('rejects a duplicate code in the same warehouse', async () => {
    const res = await api('post', `/inventory/warehouses/${warehouse.id}/locations`, {
      code: 'A1',
      name: 'Duplicate',
    }).expect(400);
    expect(res.body.message).toContain('already exists');
  });

  it('updates a location', async () => {
    const locations = await listLocations();
    const a1 = locations.find((location) => location.code === 'A1')!;
    const res = await api('patch', `/inventory/warehouses/${warehouse.id}/locations/${a1.id}`, {
      name: 'Aisle 1 (Front)',
      active: false,
    }).expect(200);
    expect(res.body).toMatchObject({ id: a1.id, name: 'Aisle 1 (Front)', active: false });
  });

  it('rejects a location from another warehouse', async () => {
    const other = await api('post', '/inventory/warehouses', {
      code: 'E2E_LOC_2',
      name: 'Second Warehouse',
    }).expect(201);
    const locations = await listLocations();
    const b1 = locations.find((location) => location.code === 'B1')!;
    await api('patch', `/inventory/warehouses/${other.body.id}/locations/${b1.id}`, {
      name: 'Nope',
    }).expect(404);
  });

  it('deactivates a location', async () => {
    const locations = await listLocations();
    const b1 = locations.find((location) => location.code === 'B1')!;
    await api('delete', `/inventory/warehouses/${warehouse.id}/locations/${b1.id}`).expect(200);
    const remaining = await listLocations();
    expect(remaining.map((location) => location.code)).not.toContain('B1');
  });

  it('returns 404 when operating on a deactivated location', async () => {
    const locations = await listLocations();
    const a1 = locations.find((location) => location.code === 'A1')!;
    await api('delete', `/inventory/warehouses/${warehouse.id}/locations/${a1.id}`).expect(200);
    await api('patch', `/inventory/warehouses/${warehouse.id}/locations/${a1.id}`, {
      name: 'Gone',
    }).expect(404);
  });
});
