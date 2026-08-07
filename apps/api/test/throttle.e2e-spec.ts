import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource } from '@aptifum/database';
import { AppModule } from '../src/app.module';

describe('Auth throttling (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    resetEnv();
    const base = getEnv();
    setEnv({ ...base, DB_NAME: base.DB_NAME_TEST });

    const dataSource = createDataSource();
    await dataSource.initialize();
    await dataSource.destroy();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects register requests beyond the per-IP limit', async () => {
    const server = app.getHttpServer();
    const stamp = `${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/api/v1/auth/register')
        .send({ email: `throttle-${stamp}-${i}@aptifum.dev`, password: 'password123' })
        .expect(201);
    }
    await request(server)
      .post('/api/v1/auth/register')
      .send({ email: `throttle-${stamp}-over@aptifum.dev`, password: 'password123' })
      .expect(429);
  });
});
