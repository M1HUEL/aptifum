import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

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
