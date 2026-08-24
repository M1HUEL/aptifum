import path from 'node:path';

import dotenv from 'dotenv';
import { z } from 'zod';

import { resolveWorkspaceRoot } from './workspace';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default(''),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('aptifum'),
  DB_PASSWORD: z.string().default('aptifum_dev'),
  DB_NAME: z.string().default('aptifum'),
  DB_NAME_TEST: z.string().default('aptifum_test'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  PASSWORD_RESET_TTL: z.string().default('15m'),
  INVITE_TTL: z.string().default('72h'),
  APP_URL: z.string().default('http://localhost:5173'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM_EMAIL: z.string().default('no-reply@aptifum.dev'),
  SMTP_FROM_NAME: z.string().default('Aptifum'),
  MAX_ACTIVE_SESSIONS_PER_USER: z.coerce.number().min(1).default(5),
  SESSION_RETENTION_DAYS: z.coerce.number().min(1).default(30),
  LOGIN_THROTTLE_LIMIT: z.coerce.number().min(1).default(10),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | undefined;

export function loadEnv(overrides: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) {
    return cached;
  }
  const root = resolveWorkspaceRoot();
  dotenv.config({ path: path.join(root, '.env') });
  const parsed = EnvSchema.parse({ ...process.env, ...overrides });
  cached = parsed;
  return parsed;
}

export function getEnv(): AppEnv {
  return cached ?? loadEnv();
}

export function resetEnv(): void {
  cached = undefined;
}

export function setEnv(env: AppEnv): AppEnv {
  cached = env;
  return cached;
}

export const Env = EnvSchema;
