import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshSession } from '@aptifum/database';
import { RbacModule } from '../rbac/rbac.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    TypeOrmModule.forFeature([RefreshSession]),
    UsersModule,
    RbacModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
