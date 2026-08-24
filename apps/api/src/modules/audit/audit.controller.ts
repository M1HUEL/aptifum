import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { AuditService } from './audit.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.AUDIT, 'read'))
  @ApiOperation({ summary: 'List audit log entries with filters' })
  list(@CurrentUser() user: { tenantId: string | null }, @Query() query: AuditQueryDto) {
    return this.auditService.findAll(user.tenantId, query);
  }
}
