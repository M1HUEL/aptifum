import 'reflect-metadata';
import { createDataSource, seed } from '@aptifum/database';

async function main(): Promise<void> {
  const dataSource = createDataSource();
  await dataSource.initialize();
  console.log('Applying database migrations...');
  await dataSource.runMigrations();
  await dataSource.destroy();

  console.log('Seeding database...');
  await seed();

  console.log('Starting API...');
  await import('./main.js');
}

main().catch((error) => {
  console.error('Production bootstrap failed', error);
  process.exit(1);
});
