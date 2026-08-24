import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ModuleName, permission } from '@aptifum/core';
import { Tenant } from '@aptifum/database';

import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(@InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>) {}

  @Get()
  @RequirePermissions(permission(ModuleName.TENANTS, 'read'))
  @ApiOperation({ summary: 'List tenants' })
  list() {
    return this.tenantsRepo.find({ order: { name: 'ASC' } });
  }
}
