import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { setCsvHeaders, toCsv } from './csv.util';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Executive dashboard key metrics' })
  async dashboard(
    @CurrentUser() user: { tenantId: string | null },
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.dashboard(user.tenantId);
    if (format === 'csv' && res) {
      setCsvHeaders(res, 'dashboard.csv');
      return toCsv([report]);
    }
    return report;
  }
}
