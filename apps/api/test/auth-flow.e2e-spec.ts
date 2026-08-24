import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';

import { AppModule } from '../src/app.module';

const ADMIN_EMAIL = 'admin@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';

describe('Auth security (e2e)', () => {
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

  const server = () => app.getHttpServer();
  const login = () =>
    request(server()).post('/api/v1/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const refresh = (refreshToken: string) => request(server()).post('/api/v1/auth/refresh').send({ refreshToken });

  it('refresh rotates the token and rejects the previous one', async () => {
    const res = await login().expect(200);
    const firstRefresh = res.body.refreshToken as string;

    const rotated = await refresh(firstRefresh).expect(200);
    expect(rotated.body.accessToken).toBeDefined();
    expect(rotated.body.refreshToken).toBeDefined();
    expect(rotated.body.refreshToken).not.toBe(firstRefresh);

    await refresh(firstRefresh).expect(401);
  });

  it('replaying a rotated token revokes the whole family', async () => {
    const res = await login().expect(200);
    const first = res.body.refreshToken as string;

    const rotated = await refresh(first).expect(200);
    const second = rotated.body.refreshToken as string;

    await refresh(first).expect(401);

    await refresh(second).expect(401);
  });

  it('logout revokes the refresh token family', async () => {
    const res = await login().expect(200);

    await request(server()).post('/api/v1/auth/logout').send({ refreshToken: res.body.refreshToken }).expect(200);

    await refresh(res.body.refreshToken).expect(401);
  });

  it('rejects a garbage refresh token', async () => {
    await refresh('not-a-real-token').expect(401);
  });

  it('RBAC: seller reads inventory but cannot read reports or users', async () => {
    const email = `seller-auth-${Date.now()}@aptifum.dev`;
    const reg = await request(server())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const token = reg.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    await request(server()).get('/api/v1/inventory/products').set(auth).expect(200);

    await request(server()).get('/api/v1/reports/dashboard').set(auth).expect(403);

    await request(server()).get('/api/v1/users').set(auth).expect(403);
  });

  it('enforces the per-user active session limit', async () => {
    const email = `sessions-${Date.now()}@aptifum.dev`;
    await request(server()).post('/api/v1/auth/register').send({ email, password: 'password123' }).expect(201);

    const tokens: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);
      tokens.push(res.body.refreshToken as string);
    }

    await refresh(tokens[0]).expect(401);
    await refresh(tokens[5]).expect(200);
  });
});
