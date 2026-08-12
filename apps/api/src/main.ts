import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { getEnv } from '@aptifum/config';
import { createLogger, LoggerAdapter } from '@aptifum/logger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './errors/api-exception.filter';

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const pino = createLogger();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.use((req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
    if (!req.url.startsWith('/api/v1/webhooks/')) {
      return next();
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      req.rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.useLogger(new LoggerAdapter(pino));
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableShutdownHooks();
  const corsOrigin = env.NODE_ENV === 'production' ? env.CORS_ORIGIN || false : true;
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.getHttpAdapter().get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aptifum ERP API')
    .setDescription('Multi-module ERP API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.security = [{ bearer: [] }];
  SwaggerModule.setup('docs', app, document);

  await app.listen(env.PORT);
  pino.info(`API listening on http://localhost:${env.PORT} (Swagger: /docs)`);
}

void bootstrap();
