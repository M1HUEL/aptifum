import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { AccountingPeriodStatus, DocumentSeriesKind, RoleName } from '@aptifum/core';
import {
  AccountingPeriod,
  ChartAccount,
  createDataSource,
  DEFAULT_ACCOUNTS,
  DEFAULT_SERIES,
  DocumentSeries,
  Role,
  seed,
  Tenant,
  User,
} from '@aptifum/database';
import { json, NextFunction, Request, Response, urlencoded } from 'express';
import { AppModule } from '../src/app.module';

const MX_TENANT_ID = '00000000-0000-4000-8000-00000000000a';
const MX_ADMIN_EMAIL = 'mx@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';

describe('CFDI / tax compliance (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let product: { id: string };
  let warehouse: { id: string };
  let customer: { id: string };
  let invoice: { id: string };

  beforeAll(async () => {
    resetEnv();
    const base = getEnv();
    setEnv({ ...base, DB_NAME: base.DB_NAME_TEST });

    const dataSource = createDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(`
      DELETE FROM cfdi_documents;
      DELETE FROM cfdi_certificates;
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
      DELETE FROM accounting_periods;
      DELETE FROM chart_accounts;
      DELETE FROM document_series;
      DELETE FROM payment_providers;
      DELETE FROM idempotency_keys;
      DELETE FROM outbox_events;
      DELETE FROM user_roles;
      DELETE FROM user_tenants;
      DELETE FROM refresh_sessions;
      DELETE FROM users;
      DELETE FROM tenants;
    `);
    await dataSource.destroy();
    await seed();

    const setup = createDataSource();
    await setup.initialize();
    const tenantRepo = setup.getRepository(Tenant);
    const seriesRepo = setup.getRepository(DocumentSeries);
    const accountsRepo = setup.getRepository(ChartAccount);
    const periodRepo = setup.getRepository(AccountingPeriod);
    const roleRepo = setup.getRepository(Role);
    const userRepo = setup.getRepository(User);

    const mxTenant = await tenantRepo.save(
      tenantRepo.create({
        id: MX_TENANT_ID,
        name: 'Aptifum MX SA de CV',
        taxId: 'XND160713M46',
        defaultCurrency: 'MXN',
        country: 'MX',
        fiscalRegime: '601',
        fiscalAddress: { street: 'Av Reforma 100', zip: '06600', city: 'Ciudad de México' },
      }),
    );
    for (const [kind, prefix] of Object.entries(DEFAULT_SERIES) as [DocumentSeriesKind, string][]) {
      await seriesRepo.save(
        seriesRepo.create({ tenantId: mxTenant.id, kind, prefix, nextNumber: 1, active: true }),
      );
    }
    for (const account of DEFAULT_ACCOUNTS) {
      await accountsRepo.save(
        accountsRepo.create({ tenantId: mxTenant.id, ...account }),
      );
    }
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await periodRepo.save(
      periodRepo.create({
        tenantId: mxTenant.id,
        period: month,
        label: `Period ${month}`,
        startDate: `${month}-01`,
        endDate: `${month}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
        status: AccountingPeriodStatus.OPEN,
      }),
    );
    const adminRole = await roleRepo.findOneByOrFail({ name: RoleName.ADMIN });
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await userRepo.save(
      userRepo.create({
        email: MX_ADMIN_EMAIL,
        passwordHash,
        name: 'MX Admin',
        active: true,
        defaultTenantId: mxTenant.id,
        tenants: [mxTenant],
        roles: [adminRole],
      }),
    );
    await setup.destroy();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use((req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
      if (!req.url.startsWith('/api/v1/webhooks/')) {
        return next();
      }
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        next();
      });
      req.on('error', next);
    });
    app.use(json({ limit: '1mb' }));
    app.use(urlencoded({ extended: true, limit: '1mb' }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: MX_ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    token = login.body.accessToken as string;

    const api = (method: 'get' | 'post' | 'put', path: string, body?: unknown) => {
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
        sku: 'CFDI-E2E',
        name: 'CFDI E2E Product',
        unitOfMeasure: 'unit',
        purchasePrice: 50,
        salePrice: 100,
      }),
      api('post', '/inventory/warehouses', { code: 'CFDI_WH', name: 'CFDI WH' }),
      api('post', '/sales/customers', {
        code: 'CFDI-C1',
        tradeName: 'Cliente Demo SA',
        legalName: 'Cliente Demo SA de CV',
        taxId: 'CND070823MTA',
        usoCfdi: 'G03',
        regimenFiscal: '601',
        currency: 'MXN',
      }),
    ]);
    product = p.body as { id: string };
    warehouse = wh.body as { id: string };
    customer = cust.body as { id: string };

    await api('post', '/inventory/movements', {
      movementType: 'inbound',
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 100,
      unitCost: 50,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for tax endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/tax/settings').expect(401);
  });

  it('returns CFDI settings for the MX tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tax/settings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.rfc).toBe('XND160713M46');
    expect(res.body.regime).toBe('601');
    expect(res.body.country).toBe('MX');
    expect(res.body.placeOfExpedition).toBe('06600');
  });

  it('updates CFDI settings', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/tax/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ placeOfExpedition: '06000' })
      .expect(200);
    expect(res.body.placeOfExpedition).toBe('06000');
  });

  it('rejects customers with an invalid RFC for a MX tenant', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'CFDI-BAD', tradeName: 'Bad RFC', taxId: '1234567890123' })
      .expect(400);
  });

  it('creates an issued MXN invoice', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [{ productId: product.id, quantity: 2, unitPrice: 100, taxRate: 0.16 }],
      })
      .expect(201);
    invoice = res.body as { id: string };
    expect(invoice.id).toBeDefined();
  });

  it('generates a stamped CFDI for the invoice', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tax/cfdi/invoices/${invoice.id}/generate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.status).toBe('stamped');
    expect(res.body.invoiceId).toBe(invoice.id);
    expect(res.body.uuid).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    );
    expect(res.body.serie).toBe('INV');
    expect(res.body.emitterRfc).toBe('XND160713M46');
    expect(res.body.receiverRfc).toBe('CND070823MTA');
    expect(res.body.total).toBe(232);
  });

  it('is idempotent on regenerate', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/tax/cfdi/invoices/${invoice.id}/generate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/tax/cfdi/invoices/${invoice.id}/generate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it('retrieves the CFDI by invoice and downloads the XML', async () => {
    const byInvoice = await request(app.getHttpServer())
      .get(`/api/v1/tax/cfdi/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const id = byInvoice.body.id as string;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/tax/cfdi/${id}/xml`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toContain('<cfdi:Comprobante');
    expect(res.text).toContain('Version="4.0"');
    expect(res.text).toContain('<tfd:TimbreFiscalDigital');
    expect(res.text).toContain(`UUID="${byInvoice.body.uuid.toUpperCase()}"`);
    expect(res.text).toContain('RfcProvCertif="XND000000000"');
  });

  it('lists CFDI documents', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tax/cfdi?limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('cancels a CFDI (demo: no PAC cancellation)', async () => {
    const byInvoice = await request(app.getHttpServer())
      .get(`/api/v1/tax/cfdi/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const res = await request(app.getHttpServer())
      .put(`/api/v1/tax/cfdi/${byInvoice.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancelledAt).toBeDefined();
  });
});
