import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';

import { AppModule } from '../src/app.module';

const ADMIN_EMAIL = 'admin@aptifum.dev';
const ADMIN_PASSWORD = 'Admin123!';

describe('Users and roles (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const suffix = Date.now();

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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    token = login.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('lists roles with the system defaults', async () => {
    const res = await request(server()).get('/api/v1/roles').set(auth()).expect(200);
    const roles = res.body as Array<{ name: string; isSystem: boolean }>;
    const byName = new Map(roles.map((r) => [r.name, r]));
    expect(byName.has('admin')).toBe(true);
    expect(byName.has('seller')).toBe(true);
    expect(byName.get('admin')!.isSystem).toBe(true);
    expect(byName.get('seller')!.isSystem).toBe(true);
  });

  it('creates, updates and deletes a custom role', async () => {
    const roleName = `custom-${suffix}`;
    const created = await request(server())
      .post('/api/v1/roles')
      .set(auth())
      .send({ name: roleName, description: 'E2E role', permissions: ['crm:read'] })
      .expect(201);
    const roleId = created.body.id as string;
    expect(created.body).toMatchObject({ name: roleName, isSystem: false });

    const patched = await request(server())
      .patch(`/api/v1/roles/${roleId}`)
      .set(auth())
      .send({ name: `${roleName}-v2`, permissions: ['crm:read', 'crm:write'] })
      .expect(200);
    expect(patched.body).toMatchObject({ name: `${roleName}-v2`, isSystem: false });
    expect(patched.body.permissions).toEqual(['crm:read', 'crm:write']);

    const removed = await request(server()).delete(`/api/v1/roles/${roleId}`).set(auth()).expect(200);
    expect(removed.body).toEqual({ id: roleId });
  });

  it('refuses to delete or duplicate a system role', async () => {
    const res = await request(server()).get('/api/v1/roles').set(auth()).expect(200);
    const adminRole = (res.body as Array<{ name: string; id: string }>).find((r) => r.name === 'admin')!;

    await request(server()).delete(`/api/v1/roles/${adminRole.id}`).set(auth()).expect(403);

    await request(server()).post('/api/v1/roles').set(auth()).send({ name: 'seller', permissions: [] }).expect(409);
  });

  it('creates a user with roles and lists it', async () => {
    const res = await request(server()).get('/api/v1/roles').set(auth()).expect(200);
    const sellerRole = (res.body as Array<{ name: string; id: string }>).find((r) => r.name === 'seller')!;

    const email = `user-${suffix}@aptifum.dev`;
    const created = await request(server())
      .post('/api/v1/users')
      .set(auth())
      .send({
        email,
        password: 'password123',
        name: 'E2E User',
        roleIds: [sellerRole.id],
      })
      .expect(201);
    expect(created.body).toMatchObject({ email, name: 'E2E User', active: true });
    expect(created.body.roles).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'seller' })]));
    expect(created.body.passwordHash).toBeUndefined();

    const list = await request(server()).get('/api/v1/users').set(auth()).expect(200);
    const found = (list.body.data as Array<{ email: string; roles: unknown[] }>).find((u) => u.email === email);
    expect(found).toBeDefined();
    expect(found!.roles).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'seller' })]));
  });

  it('deactivating a user blocks login', async () => {
    const email = `inactive-${suffix}@aptifum.dev`;
    const created = await request(server())
      .post('/api/v1/users')
      .set(auth())
      .send({ email, password: 'password123', name: 'To Disable' })
      .expect(201);

    await request(server())
      .patch(`/api/v1/users/${created.body.id as string}`)
      .set(auth())
      .send({ active: false })
      .expect(200);

    await request(server()).post('/api/v1/auth/login').send({ email, password: 'password123' }).expect(401);
  });

  it('enforces users:write for non-admins', async () => {
    const sellerEmail = `seller-${suffix}@aptifum.dev`;
    const reg = await request(server())
      .post('/api/v1/auth/register')
      .send({ email: sellerEmail, password: 'password123' })
      .expect(201);
    const sellerToken = reg.body.accessToken as string;

    await request(server())
      .post('/api/v1/users')
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({ email: `nope-${suffix}@aptifum.dev`, password: 'password123' })
      .expect(403);
  });
});
