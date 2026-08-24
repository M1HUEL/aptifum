import 'reflect-metadata';

import { fileURLToPath } from 'node:url';

import { DataSource, DataSourceOptions } from 'typeorm';

import { loadEnv } from '@aptifum/config';

import { entities } from './entities/index.js';

export interface DataSourceOverrides {
  database?: string;
}

export function createDataSource(overrides: DataSourceOverrides = {}): DataSource {
  const env = loadEnv();
  const options: DataSourceOptions = {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: overrides.database ?? env.DB_NAME,
    entities,
    migrations: [fileURLToPath(new URL('./migrations/*{.ts,.js}', import.meta.url))],
    synchronize: false,
    logging: env.NODE_ENV === 'development',
  };
  return new DataSource(options);
}

export const appDataSource = createDataSource();
