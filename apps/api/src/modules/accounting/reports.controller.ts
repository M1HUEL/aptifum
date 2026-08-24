import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { ReportsService } from './reports.service.js';

@ApiTags('accounting')
@Controller('accounting/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('trial-balance')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'Trial balance by account (period or date range)' })
  trialBalance(
    @CurrentUser() user: { tenantId: string | null },
    @Query('periodId') periodId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.trialBalance(user.tenantId, { periodId, from, to });
  }

  @Get('ledger/:accountId')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'General ledger for a single account' })
  ledger(
    @CurrentUser() user: { tenantId: string | null },
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.ledger(user.tenantId, accountId, { from, to });
  }
}
