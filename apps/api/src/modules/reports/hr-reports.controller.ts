import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { DateRangeQueryDto } from './dto/reports-query.dto';
import { setCsvHeaders, toCsv } from './csv.util';

@ApiTags('reports')
@Controller('reports/hr')
export class HrReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('payroll')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Payroll summary grouped by period' })
  async payroll(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: DateRangeQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.payrollSummary(user.tenantId, query);
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'payroll-summary.csv');
      return toCsv(report.data);
    }
    return report;
  }
}
