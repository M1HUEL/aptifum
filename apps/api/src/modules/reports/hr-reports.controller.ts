import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { DateRangeQueryDto } from './dto/reports-query.dto';
import { setCsvHeaders, toCsv } from './csv.util';
import { setXlsxHeaders, toXlsxBuffer } from './xlsx.util';
import {
  buildTablePdf,
  formatMoney,
  formatNumber,
  rangeText,
  setPdfHeaders,
} from './pdf.util';

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
      setPdfHeaders(res, 'payroll-summary.pdf');
      const buffer = await buildTablePdf({
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
      });
      res.send(buffer);
      return;
    }
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'payroll-summary.csv');
      return toCsv(report.data);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'payroll-summary.xlsx');
      res.send(await toXlsxBuffer(report.data));
      return;
    }
    return report;
  }
}
