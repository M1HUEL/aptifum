import 'reflect-metadata';
import path from 'node:path';

import { DataSource, DataSourceOptions } from 'typeorm';

import { loadEnv } from '@aptifum/config';

import { entities } from './entities';

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
    migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],
    synchronize: false,
    logging: env.NODE_ENV === 'development',
  };
  return new DataSource(options);
}

export const appDataSource = createDataSource();
