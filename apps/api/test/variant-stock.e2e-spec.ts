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

interface PosRow {
  id: string;
  variantId: string | null;
  sku: string;
  name: string;
  barcode: string | null;
  salePrice: number;
  availableStock: number;
}

describe('Product variants in stock/POS (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: Created;
  let otherProduct: Created;
  let variant: Created;
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

    const [p, other, wh, cust] = await Promise.all([
      api('post', '/inventory/products', {
        sku: 'E2E-V-BASE',
        name: 'E2E Variant Base',
        unitOfMeasure: 'unit',
        purchasePrice: 1,
        salePrice: 10,
      }),
      api('post', '/inventory/products', {
        sku: 'E2E-V-OTHER',
        name: 'E2E Variant Other',
        unitOfMeasure: 'unit',
        purchasePrice: 1,
        salePrice: 10,
      }),
      api('post', '/inventory/warehouses', { code: 'E2E_V_WH', name: 'E2E Variant WH' }),
      api('post', '/sales/customers', { code: 'E2E-V-C1', tradeName: 'E2E Variant Customer', currency: 'USD' }),
    ]);
    product = p.body as Created;
    otherProduct = other.body as Created;
    warehouse = wh.body as Created;
    customer = cust.body as Created;

    const v = await api('post', `/inventory/products/${product.id}/variants`, {
      sku: 'E2E-V-RED',
      barcode: '9900000001',
      attributes: { color: 'Red', size: 'M' },
      purchasePrice: 1.5,
      salePrice: 12.5,
    });
    variant = v.body as Created;

    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      quantity: 20,
      unitCost: 1.5,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const pos = async (q: string) => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/inventory/pos-products')
      .query({ warehouseId: warehouse.id, q })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body.data as PosRow[];
  };

  it('lists the variant in the POS catalog separately from the base product', async () => {
    const variantRows = await pos('E2E-V-RED');
    expect(variantRows).toHaveLength(1);
    expect(variantRows[0]).toMatchObject({
      variantId: variant.id,
      sku: 'E2E-V-RED',
      barcode: '9900000001',
      salePrice: 12.5,
      availableStock: 20,
    });
    expect(variantRows[0].name).toContain('E2E Variant Base');

    const baseRows = await pos('E2E-V-BASE');
    expect(baseRows).toHaveLength(1);
    expect(baseRows[0]).toMatchObject({
      variantId: null,
      sku: 'E2E-V-BASE',
      availableStock: 0,
    });
  });

  it('consumes variant stock only when the variant is sold', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [{ productId: product.id, variantId: variant.id, quantity: 3, unitPrice: 12.5 }],
      })
      .expect(201);
    expect(res.body.items[0]).toMatchObject({
      productId: product.id,
      variantId: variant.id,
      quantity: 3,
    });

    const variantRows = await pos('E2E-V-RED');
    expect(variantRows[0].availableStock).toBe(17);

    const baseRows = await pos('E2E-V-BASE');
    expect(baseRows[0].availableStock).toBe(0);
  });

  it('records the movements against the variant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/inventory/movements')
      .query({ variantId: variant.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const movements = res.body.data as Array<{ movementType: string; quantity: number; variantId: string | null }>;
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.variantId === variant.id)).toBe(true);
    expect(movements.find((m) => m.movementType === 'inbound')?.quantity).toBe(20);
    expect(movements.find((m) => m.movementType === 'outbound')?.quantity).toBe(-3);
  });

  it('rejects variant stock/invoice lines that do not belong to the product', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        movementType: 'inbound',
        productId: otherProduct.id,
        variantId: variant.id,
        warehouseId: warehouse.id,
        quantity: 5,
      })
      .expect(404);

    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [{ productId: otherProduct.id, variantId: variant.id, quantity: 1, unitPrice: 10 }],
      })
      .expect(400);
    expect(res.body.message).toContain('does not belong to product');
  });
});
