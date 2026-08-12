import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshSession } from '@aptifum/database';
import { RbacModule } from '../rbac/rbac.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionCleanupService } from './session-cleanup.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    TypeOrmModule.forFeature([RefreshSession]),
    UsersModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionCleanupService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
