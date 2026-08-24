import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../app.module';

async function exportSwagger(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Aptifum ERP API')
      .setDescription('Multi-module ERP API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  const outPath = join(process.cwd(), 'swagger.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`Swagger exported to ${outPath}`);
  await app.close();
  process.exit(0);
}

exportSwagger().catch((error: unknown) => {
  console.error('Failed to export OpenAPI document.');
  console.error(error);
  process.exit(1);
});
