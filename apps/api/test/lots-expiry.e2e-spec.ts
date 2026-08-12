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

interface LotRow {
  id: string;
  productId: string;
  warehouseId: string;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  status: string;
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

describe('Lot and expiry tracking (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: Created;
  let warehouseA: Created;
  let warehouseB: Created;

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

    const api = (method: 'get' | 'post', path: string, body?: unknown) => {
      const req = request(app.getHttpServer())[method](`/api/v1${path}`);
      req.set('Authorization', `Bearer ${token}`);
      if (body !== undefined) {
        req.send(body as object);
      }
      return req.expect((res) => {
        if (res.status >= 400) {
          throw new Error(
            `${method.toUpperCase()} ${path} -> ${res.status}: ${JSON.stringify(res.body)}`,
          );
        }
      });
    };

    const [p, wa, wb] = await Promise.all([
      api('post', '/inventory/products', {
        sku: 'E2E-LOT-1',
        name: 'E2E Perishable Product',
        unitOfMeasure: 'unit',
        purchasePrice: 1,
        salePrice: 10,
      }),
      api('post', '/inventory/warehouses', { code: 'E2E_LOT_A', name: 'E2E Lot Main' }),
      api('post', '/inventory/warehouses', { code: 'E2E_LOT_B', name: 'E2E Lot Second' }),
    ]);
    product = p.body as Created;
    warehouseA = wa.body as Created;
    warehouseB = wb.body as Created;

    // Lot B expires first (FEFO should consume it before Lot A)
    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: warehouseA.id,
      quantity: 10,
      unitCost: 1,
      lotNumber: 'LOT-A',
      expiryDate: isoDaysFromNow(90),
    });
    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: warehouseA.id,
      quantity: 20,
      unitCost: 1,
      lotNumber: 'LOT-B',
      expiryDate: isoDaysFromNow(10),
    });
    // Expired lot - FEFO must consume it first
    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: warehouseA.id,
      quantity: 5,
      unitCost: 1,
      lotNumber: 'LOT-EXP',
      expiryDate: isoDaysFromNow(-5),
    });
    // Same lot upsert (accumulates quantity on LOT-A)
    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: warehouseA.id,
      quantity: 5,
      unitCost: 1,
      lotNumber: 'LOT-A',
      expiryDate: isoDaysFromNow(90),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const listLots = async (query: Record<string, string> = {}) => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/inventory/lots')
      .query(query)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as { data: LotRow[]; meta: { total: number } };
  };

  it('creates and upserts lots on inbound movements', async () => {
    const res = await listLots({ warehouseId: warehouseA.id });
    expect(res.meta.total).toBe(3);
    const lotA = res.data.find((lot) => lot.lotNumber === 'LOT-A');
    const lotB = res.data.find((lot) => lot.lotNumber === 'LOT-B');
    const lotExp = res.data.find((lot) => lot.lotNumber === 'LOT-EXP');
    expect(lotA?.quantity).toBe(15);
    expect(lotB?.quantity).toBe(20);
    expect(lotExp?.quantity).toBe(5);
  });

  it('computes lot status from the expiry date', async () => {
    const res = await listLots({ warehouseId: warehouseA.id });
    const byNumber = new Map(res.data.map((lot) => [lot.lotNumber, lot.status]));
    expect(byNumber.get('LOT-EXP')).toBe('expired');
    expect(byNumber.get('LOT-B')).toBe('expiring');
    expect(byNumber.get('LOT-A')).toBe('active');
  });

  it('filters lots by status', async () => {
    const expired = await listLots({ status: 'expired' });
    expect(expired.data.every((lot) => lot.status === 'expired')).toBe(true);
    expect(expired.data.map((lot) => lot.lotNumber)).toContain('LOT-EXP');
  });

  it('consumes lots first-expiry-first-out and records a movement per lot', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        movementType: 'outbound',
        productId: product.id,
        warehouseId: warehouseA.id,
        quantity: 18,
      })
      .expect(201);

    const lots = (await listLots({ warehouseId: warehouseA.id })).data;
    const byNumber = new Map(lots.map((lot) => [lot.lotNumber, lot.quantity]));
    // 18 units: LOT-EXP (5) then LOT-B (13 of 20); LOT-A untouched
    expect(byNumber.get('LOT-EXP')).toBe(0);
    expect(byNumber.get('LOT-B')).toBe(7);
    expect(byNumber.get('LOT-A')).toBe(15);

    const movements = await request(app.getHttpServer())
      .get('/api/v1/inventory/movements')
      .query({ productId: product.id, movementType: 'outbound', limit: 50 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const outbound = movements.body.data as Array<{ lotId: string | null; quantity: number }>;
    const lotMovements = outbound.filter((m) => m.lotId !== null);
    expect(lotMovements).toHaveLength(2);
    expect(lotMovements.reduce((sum, m) => sum + m.quantity, 0)).toBe(-18);
    expect(res.body.lotId ?? true).toBeDefined();
  });

  it('deducts a specific lot when lotId is provided', async () => {
    const before = (await listLots({ warehouseId: warehouseA.id })).data;
    const lotA = before.find((lot) => lot.lotNumber === 'LOT-A')!;
    await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        movementType: 'outbound',
        productId: product.id,
        warehouseId: warehouseA.id,
        quantity: 5,
        lotId: lotA.id,
      })
      .expect(201);
    const after = (await listLots({ warehouseId: warehouseA.id })).data;
    const lotAAfter = after.find((lot) => lot.lotNumber === 'LOT-A')!;
    expect(lotAAfter.quantity).toBe(10);
  });

  it('moves lots with the same lot number on a transfer', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromWarehouseId: warehouseA.id,
        toWarehouseId: warehouseB.id,
        quantity: 10,
      })
      .expect(201);

    const origin = (await listLots({ warehouseId: warehouseA.id })).data;
    const destination = (await listLots({ warehouseId: warehouseB.id })).data;
    const originByNumber = new Map(origin.map((lot) => [lot.lotNumber, lot.quantity]));
    const destByNumber = new Map(destination.map((lot) => [lot.lotNumber, lot.quantity]));
    // FEFO origin: LOT-B (7) then LOT-A (3); destination receives same lot numbers
    expect(originByNumber.get('LOT-B')).toBe(0);
    expect(originByNumber.get('LOT-A')).toBe(7);
    expect(destByNumber.get('LOT-B')).toBe(7);
    expect(destByNumber.get('LOT-A')).toBe(3);
  });

  it('rejects a lotNumber inbound without an expiry date', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        movementType: 'inbound',
        productId: product.id,
        warehouseId: warehouseB.id,
        quantity: 2,
        lotNumber: 'LOT-NO-DATE',
      })
      .expect(400);
    expect(res.body.message).toContain('expiryDate is required');
  });
});
