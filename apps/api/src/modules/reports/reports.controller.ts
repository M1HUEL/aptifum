import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { setCsvHeaders, toCsv } from './csv.util';
import { setXlsxHeaders, toXlsxBuffer } from './xlsx.util';
import { buildTablePdf, formatMoney, rangeText, setPdfHeaders } from './pdf.util';
import { DashboardQueryDto } from './dto/reports-query.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('alerts')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Actionable alerts: low stock, overdue receivables and payables' })
  async alerts(
    @CurrentUser() user: { tenantId: string | null },
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.alerts(user.tenantId, { limit: limit ? Number(limit) : undefined });
  }

  @Get('dashboard')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Executive dashboard key metrics' })
  async dashboard(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: DashboardQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.dashboard(user.tenantId, query);
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'dashboard.csv');
      return toCsv([report]);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'dashboard.xlsx');
      res.send(await toXlsxBuffer([report]));
      return;
    }
    if (query.format === 'pdf' && res) {
      setPdfHeaders(res, 'dashboard.pdf');
      const rows: string[][] = [
        ['Sales today', formatMoney(report.salesToday)],
        ['Sales this month', formatMoney(report.salesMonth)],
        ['Net income (period)', formatMoney(report.netIncomeRange)],
        ['Net income (month)', formatMoney(report.netIncomeMonth)],
        ['Receivables', formatMoney(report.receivables)],
        ['Payables', formatMoney(report.payables)],
        ['Inventory value', formatMoney(report.inventoryValue)],
        ['Low stock products', String(report.lowStockProducts)],
        ['Open purchase orders', String(report.openPurchaseOrders)],
        ['Production in progress', String(report.productionInProgress)],
        ['Invoices this month', String(report.monthInvoices)],
        ['Invoices in period', String(report.rangeInvoices)],
      ];
      const buffer = await buildTablePdf({
        title: 'Executive Dashboard',
        subtitle: rangeText({ from: query.from, to: query.to }),
        columns: [
          { header: 'Metric' },
          { header: 'Value', align: 'right' },
        ],
        rows,
      });
      res.send(buffer);
      return;
    }
    return report;
  }
}
