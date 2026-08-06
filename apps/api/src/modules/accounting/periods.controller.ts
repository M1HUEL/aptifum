import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { PeriodsService } from './periods.service';

@ApiTags('accounting')
@Controller('accounting/periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'List accounting periods' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('status') status?: string,
  ) {
    return this.periodsService.findAll(
      user.tenantId,
      Number(page),
      Math.min(Number(limit), 100),
      status,
    );
  }

  @Post(':id/close')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Close an accounting period' })
  close(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.periodsService.close(user.tenantId, user.id, id);
  }
}
