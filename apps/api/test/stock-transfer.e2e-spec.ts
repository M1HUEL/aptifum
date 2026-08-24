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

interface StockRow {
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantity: number;
}

describe('Stock transfer between warehouses (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: Created;
  let variant: Created;
  let origin: Created;
  let destination: Created;

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
          throw new Error(`${method.toUpperCase()} ${path} -> ${res.status}: ${JSON.stringify(res.body)}`);
        }
      });
    };

    const [p, from, to] = await Promise.all([
      api('post', '/inventory/products', {
        sku: 'E2E-TR-1',
        name: 'E2E Transfer Product',
        unitOfMeasure: 'unit',
        purchasePrice: 1,
        salePrice: 10,
      }),
      api('post', '/inventory/warehouses', { code: 'E2E_TR_FROM', name: 'E2E Transfer Origin' }),
      api('post', '/inventory/warehouses', { code: 'E2E_TR_TO', name: 'E2E Transfer Dest' }),
    ]);
    product = p.body as Created;
    origin = from.body as Created;
    destination = to.body as Created;

    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: origin.id,
      quantity: 100,
      unitCost: 1,
    });

    const v = await api('post', `/inventory/products/${product.id}/variants`, {
      sku: 'E2E-TR-1-RED',
      attributes: { color: 'Red' },
      purchasePrice: 1.5,
      salePrice: 12.5,
    });
    variant = v.body as Created;

    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      variantId: variant.id,
      warehouseId: origin.id,
      quantity: 20,
      unitCost: 1.5,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const stockByProduct = async (productId: string) => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as StockRow[];
  };

  it('transfers stock from origin to destination', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromWarehouseId: origin.id,
        toWarehouseId: destination.id,
        quantity: 30,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      fromWarehouseId: origin.id,
      toWarehouseId: destination.id,
      productId: product.id,
      quantity: 30,
    });
    expect(res.body.movements).toHaveLength(2);

    const rows = await stockByProduct(product.id);
    const baseRows = rows.filter((r) => r.variantId === null);
    expect(baseRows.find((r) => r.warehouseId === origin.id)?.quantity).toBe(70);
    expect(baseRows.find((r) => r.warehouseId === destination.id)?.quantity).toBe(30);
  });

  it('records two-sided transfer movements', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/inventory/movements')
      .query({ productId: product.id, movementType: 'transfer' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const movements = res.body.data as Array<{
      movementType: string;
      warehouseId: string;
      variantId: string | null;
      quantity: number;
      referenceType: string;
    }>;
    const base = movements.filter((m) => m.variantId === null);
    expect(base).toHaveLength(2);
    expect(base.find((m) => m.warehouseId === origin.id)?.quantity).toBe(-30);
    expect(base.find((m) => m.warehouseId === destination.id)?.quantity).toBe(30);
    expect(base.every((m) => m.movementType === 'transfer' && m.referenceType === 'transfer')).toBe(true);
  });

  it('transfers a variant between warehouses independently of the base product', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        variantId: variant.id,
        fromWarehouseId: origin.id,
        toWarehouseId: destination.id,
        quantity: 5,
      })
      .expect(201);
    expect(res.body.variantId).toBe(variant.id);

    const rows = await stockByProduct(product.id);
    const variantRows = rows.filter((r) => r.variantId === variant.id);
    expect(variantRows.find((r) => r.warehouseId === origin.id)?.quantity).toBe(15);
    expect(variantRows.find((r) => r.warehouseId === destination.id)?.quantity).toBe(5);

    const baseRows = rows.filter((r) => r.variantId === null);
    expect(baseRows.find((r) => r.warehouseId === origin.id)?.quantity).toBe(70);
  });

  it('rejects transfers with insufficient stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromWarehouseId: origin.id,
        toWarehouseId: destination.id,
        quantity: 1000,
      })
      .expect(400);
    expect(res.body.message).toContain('Insufficient stock');
  });

  it('rejects transfers to the same warehouse', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromWarehouseId: origin.id,
        toWarehouseId: origin.id,
        quantity: 1,
      })
      .expect(400);
    expect(res.body.message).toContain('must differ');
  });

  it('rejects an unknown destination warehouse', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromWarehouseId: origin.id,
        toWarehouseId: '00000000-0000-4000-8000-000000000999',
        quantity: 1,
      })
      .expect(404);
  });
});
