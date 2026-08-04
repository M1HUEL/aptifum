import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, User } from '@aptifum/database';
import { RolesController } from './rbac.controller';
import { PermissionsService } from './rbac.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User])],
  controllers: [RolesController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class RbacModule {}
