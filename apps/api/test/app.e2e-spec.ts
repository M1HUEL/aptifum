import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';

import { AppModule } from '../src/app.module';

const ADMIN_EMAIL = 'admin@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    resetEnv();
    const base = getEnv();
    setEnv({ ...base, DB_NAME: base.DB_NAME_TEST });

    const dataSource = createDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.destroy();
    await seed();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('up');
  });

  it('POST /auth/register creates a user and returns tokens', async () => {
    const email = `e2e-${Date.now()}@aptifum.dev`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', name: 'E2E User' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('POST /auth/login rejects invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong-password' })
      .expect(401);
  });

  it('POST /auth/login succeeds for seeded admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(ADMIN_EMAIL);
    expect(res.body.user.roles.map((r: { name: string }) => r.name)).toContain('admin');
  });

  it('GET /auth/me returns the profile with bearer token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(ADMIN_EMAIL);
  });

  it('GET /auth/me rejects requests without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('admin can create a role (rbac:write)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ name: `ops-${Date.now()}`, permissions: ['reporting:read'] })
      .expect(201);

    expect(res.body.name).toBeDefined();
    expect(res.body.isSystem).toBe(false);
  });

  it('seller cannot create a role (forbidden)', async () => {
    const email = `seller-${Date.now()}@aptifum.dev`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${register.body.accessToken}`)
      .send({ name: `hacker-${Date.now()}`, permissions: [] })
      .expect(403);
  });

  it('audit log records write operations', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    const token = login.body.accessToken as string;
    await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `audited-${Date.now()}`, permissions: [] })
      .expect(201);

    const dataSource = createDataSource();
    await dataSource.initialize();
    const rows = await dataSource.query(
      `SELECT * FROM audit_logs WHERE module = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1`,
      ['roles', 'create'],
    );
    await dataSource.destroy();

    expect(rows.length).toBe(1);
    expect(rows[0].entity_id).toBeNull();
  });
});
