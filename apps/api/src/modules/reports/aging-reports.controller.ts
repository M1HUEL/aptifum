import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ModuleName, permission } from '@aptifum/core';

import { sendCsv, sendPdf, sendXlsx } from '../../common/export/export.util.js';
import { buildTablePdf, formatMoney } from '../../common/pdf/pdf.util.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { ReportsService } from './reports.service.js';

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
    if (format === 'pdf' && res) {
      return sendPdf(res, 'aging-ar.pdf', () =>
        buildTablePdf({
          title: 'Accounts Receivable Aging',
          subtitle: `As of ${report.asOf}`,
          columns: [
            { header: 'Code' },
            { header: 'Customer' },
            { header: 'Credit notes', align: 'right' },
            { header: 'Current', align: 'right' },
            { header: '1-30', align: 'right' },
            { header: '31-60', align: 'right' },
            { header: '61-90', align: 'right' },
            { header: '90+', align: 'right' },
            { header: 'Outstanding', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.code,
            row.tradeName,
            formatMoney(row.creditNotes),
            formatMoney(row.current),
            formatMoney(row.days1to30),
            formatMoney(row.days31to60),
            formatMoney(row.days61to90),
            formatMoney(row.days90plus),
            formatMoney(row.totalOutstanding),
          ]),
          totalsRow: [
            '',
            'Total',
            '',
            formatMoney(report.totals.current),
            formatMoney(report.totals.days1to30),
            formatMoney(report.totals.days31to60),
            formatMoney(report.totals.days61to90),
            formatMoney(report.totals.days90plus),
            formatMoney(report.totals.totalOutstanding),
          ],
        }),
      );
    }
    if (format === 'csv' && res) {
      return sendCsv(res, 'aging-ar.csv', report.data);
    }
    if (format === 'xlsx' && res) {
      return sendXlsx(res, 'aging-ar.xlsx', report.data);
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
    if (format === 'pdf' && res) {
      return sendPdf(res, 'aging-ap.pdf', () =>
        buildTablePdf({
          title: 'Accounts Payable Aging',
          subtitle: `As of ${report.asOf}`,
          columns: [
            { header: 'Code' },
            { header: 'Supplier' },
            { header: 'Current', align: 'right' },
            { header: '31-60', align: 'right' },
            { header: '61-90', align: 'right' },
            { header: '90+', align: 'right' },
            { header: 'Outstanding', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.code,
            row.tradeName,
            formatMoney(row.current),
            formatMoney(row.days31to60),
            formatMoney(row.days61to90),
            formatMoney(row.days90plus),
            formatMoney(row.totalOutstanding),
          ]),
          totalsRow: [
            '',
            'Total',
            formatMoney(report.totals.current),
            formatMoney(report.totals.days31to60),
            formatMoney(report.totals.days61to90),
            formatMoney(report.totals.days90plus),
            formatMoney(report.totals.totalOutstanding),
          ],
        }),
      );
    }
    if (format === 'csv' && res) {
      return sendCsv(res, 'aging-ap.csv', report.data);
    }
    if (format === 'xlsx' && res) {
      return sendXlsx(res, 'aging-ap.xlsx', report.data);
    }
    return report;
  }
}
