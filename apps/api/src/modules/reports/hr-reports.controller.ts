import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { DateRangeQueryDto } from './dto/reports-query.dto';
import { sendCsv, sendPdf, sendXlsx } from './export.util';
import { buildTablePdf, formatMoney, formatNumber, rangeText } from './pdf.util';

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
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'payroll-summary.pdf', () =>
        buildTablePdf({
          title: 'Payroll Summary',
          subtitle: rangeText(query),
          columns: [
            { header: 'Period' },
            { header: 'Payrolls', align: 'right' },
            { header: 'Gross', align: 'right' },
            { header: 'Deductions', align: 'right' },
            { header: 'Net', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.period,
            formatNumber(row.payrolls),
            formatMoney(row.totalGross),
            formatMoney(row.totalDeductions),
            formatMoney(row.totalNet),
          ]),
          totalsRow: [
            'Total',
            formatNumber(report.totals.payrolls),
            formatMoney(report.totals.totalGross),
            formatMoney(report.totals.totalDeductions),
            formatMoney(report.totals.totalNet),
          ],
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'payroll-summary.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'payroll-summary.xlsx', report.data);
    }
    return report;
  }
}
