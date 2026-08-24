import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';

import { AppModule } from '../src/app.module.js';

const ADMIN_EMAIL = 'admin@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';

interface Created {
  id: string;
}

describe('E2E reorders: suggestions generate draft purchase orders', () => {
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
      DELETE FROM product_suppliers;
      DELETE FROM goods_receipt_items;
      DELETE FROM goods_receipts;
      DELETE FROM purchase_order_items;
      DELETE FROM purchase_orders;
      DELETE FROM suppliers;
      DELETE FROM stock_movements;
      DELETE FROM product_stock;
      DELETE FROM product_lots;
      DELETE FROM product_variants;
      DELETE FROM products;
      DELETE FROM warehouse_locations;
      DELETE FROM warehouses;
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

  it('suggests low-stock products and generates grouped draft orders', async () => {
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

    const [supplier, warehouse, product] = (
      await Promise.all([
        api('post', '/purchasing/suppliers', {
          code: 'E2ER-S1',
          tradeName: 'E2E Reorder Supplier',
          currency: 'USD',
        }),
        api('post', '/inventory/warehouses', { code: 'E2ER_WH', name: 'E2E Reorder WH' }),
        api('post', '/inventory/products', {
          sku: 'E2ER-P1',
          name: 'E2E Reorder Product',
          unitOfMeasure: 'unit',
          purchasePrice: 4,
          salePrice: 9,
          reorderPoint: 100,
          reorderQuantity: 150,
        }),
      ])
    ).map((res) => res.body as Created & { sku?: string });
    const productId = product.id;
    const supplierId = supplier.id;

    const linkDs = createDataSource();
    await linkDs.initialize();
    await linkDs.query(
      `INSERT INTO product_suppliers (id, created_at, updated_at, tenant_id, product_id, supplier_id, unit_cost, lead_time_days, is_preferred)
       SELECT uuid_generate_v4(), now(), now(), tenant_id, $1, $2, 3.5, 5, TRUE FROM products WHERE id = $1`,
      [productId, supplierId],
    );
    await linkDs.destroy();

    const suggestions = await api('get', '/purchasing/reorders');
    const rows = (
      suggestions.body as {
        data: Array<{
          productId: string;
          availableQuantity: number;
          suggestedQuantity: number;
          supplierName: string | null;
        }>;
      }
    ).data;
    const match = rows.find((row) => row.productId === productId);
    expect(match).toBeDefined();
    expect(match?.availableQuantity).toBe(0);
    expect(match?.suggestedQuantity).toBe(150);
    expect(match?.supplierName).toBe('E2E Reorder Supplier');

    const generated = await api('post', '/purchasing/reorders/generate', {
      warehouseId: warehouse.id,
      productIds: [productId],
    });
    const body = generated.body as {
      data: Array<{ purchaseOrderId: string; number: string; supplierId: string; itemCount: number }>;
      warnings: unknown[];
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.supplierId).toBe(supplierId);
    expect(body.data[0]?.itemCount).toBe(1);
    expect(body.warnings).toHaveLength(0);

    const drafts = await api('get', '/purchasing/purchase-orders?status=draft');
    const draftBody = drafts.body as { data: Array<{ id: string; number: string }> };
    const createdDraft = draftBody.data.find((order) => order.id === body.data[0]?.purchaseOrderId);
    expect(createdDraft).toBeDefined();
  });
});
