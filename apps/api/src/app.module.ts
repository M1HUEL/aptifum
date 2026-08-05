import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from './config/config.module';
import { RequestIdMiddleware } from './request-id.middleware';
import { HealthModule } from './health/health.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SalesModule } from './modules/sales/sales.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule,
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
    AuthModule,
    UsersModule,
    RbacModule,
    TenantsModule,
    AuditModule,
    InventoryModule,
    SalesModule,
    PurchasingModule,
    AccountingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
