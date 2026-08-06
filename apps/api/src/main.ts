import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { getEnv } from '@aptifum/config';
import { createLogger, LoggerAdapter } from '@aptifum/logger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './errors/api-exception.filter';

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const pino = createLogger();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new LoggerAdapter(pino));
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aptifum ERP API')
    .setDescription('Multi-module ERP API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(env.PORT);
  pino.info(`API listening on http://localhost:${env.PORT} (Swagger: /docs)`);
}

void bootstrap();
