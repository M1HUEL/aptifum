import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RefreshSession } from '@aptifum/database';

import { AuditModule } from '../audit/audit.module.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { UsersModule } from '../users/users.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { SessionCleanupService } from './session-cleanup.service.js';

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
