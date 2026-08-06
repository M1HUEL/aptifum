import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { setCsvHeaders, toCsv } from './csv.util';

@ApiTags('reports')
@Controller('reports/aging')
export class AgingReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('ar')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Accounts receivable aging per customer' })
  async ar(
    @CurrentUser() user: { tenantId: string | null },
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.arAging(user.tenantId);
    if (format === 'csv' && res) {
      setCsvHeaders(res, 'aging-ar.csv');
      return toCsv(report.data);
    }
    return report;
  }

  @Get('ap')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Accounts payable aging per supplier' })
  async ap(
    @CurrentUser() user: { tenantId: string | null },
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.apAging(user.tenantId);
    if (format === 'csv' && res) {
      setCsvHeaders(res, 'aging-ap.csv');
      return toCsv(report.data);
    }
    return report;
  }
}
