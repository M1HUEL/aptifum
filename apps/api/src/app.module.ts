import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule, ConfigService } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { AccountingModule } from './modules/accounting/accounting.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module.js';
import { HrModule } from './modules/hr/hr.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ProductionModule } from './modules/production/production.module.js';
import { PurchasingModule } from './modules/purchasing/purchasing.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { RemindersModule } from './modules/reminders/reminders.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { TaxModule } from './modules/tax/tax.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RequestIdMiddleware } from './request-id.middleware.js';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 300,
      },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.env.DB_HOST,
        port: config.env.DB_PORT,
        username: config.env.DB_USER,
        password: config.env.DB_PASSWORD,
        database: config.env.DB_NAME,
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    HealthModule,
    EmailModule,
    ExchangeRatesModule,
    OutboxModule,
    AuthModule,
    UsersModule,
    RbacModule,
    TenantsModule,
    AuditModule,
    InventoryModule,
    ImportsModule,
    SalesModule,
    PurchasingModule,
    AccountingModule,
    CrmModule,
    HrModule,
    ProductionModule,
    PaymentsModule,
    TaxModule,
    RemindersModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
