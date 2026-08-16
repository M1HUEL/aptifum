import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { sendCsv, sendPdf, sendXlsx } from '../../common/export/export.util';
import { buildTablePdf, formatMoney, formatNumber, rangeText } from '../../common/pdf/pdf.util';
import { SalesByCustomerQueryDto, SalesByProductQueryDto, SalesSummaryQueryDto } from './dto/reports-query.dto';

@ApiTags('reports')
@Controller('reports/sales')
export class SalesReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Sales summary grouped by period' })
  async summary(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: SalesSummaryQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.salesSummary(user.tenantId, query);
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'sales-summary.pdf', () =>
        buildTablePdf({
          title: 'Sales Summary',
          subtitle: rangeText(query),
          columns: [
            { header: 'Period' },
            { header: 'Invoices', align: 'right' },
            { header: 'Credit notes', align: 'right' },
            { header: 'Revenue', align: 'right' },
            { header: 'Tax', align: 'right' },
            { header: 'Total', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.period,
            formatNumber(row.invoices),
            formatNumber(row.creditNotes),
            formatMoney(row.revenue),
            formatMoney(row.tax),
            formatMoney(row.total),
          ]),
          totalsRow: [
            'Total',
            formatNumber(report.totals.invoices),
            '',
            formatMoney(report.totals.revenue),
            formatMoney(report.totals.tax),
            formatMoney(report.totals.total),
          ],
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'sales-summary.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'sales-summary.xlsx', report.data);
    }
    return report;
  }

  @Get('by-product')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Sales, COGS and gross profit per product' })
  async byProduct(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: SalesByProductQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.salesByProduct(user.tenantId, query);
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'sales-by-product.pdf', () =>
        buildTablePdf({
          title: 'Sales by Product',
          subtitle: rangeText(query),
          columns: [
            { header: 'SKU' },
            { header: 'Product' },
            { header: 'Qty', align: 'right' },
            { header: 'Revenue', align: 'right' },
            { header: 'COGS', align: 'right' },
            { header: 'Gross profit', align: 'right' },
            { header: 'Margin', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.sku,
            row.name,
            formatNumber(row.quantity),
            formatMoney(row.revenue),
            formatMoney(row.cogs),
            formatMoney(row.grossProfit),
            `${(row.margin * 100).toFixed(1)}%`,
          ]),
          totalsRow: [
            '',
            'Total',
            '',
            formatMoney(report.totals.revenue),
            formatMoney(report.totals.cogs),
            formatMoney(report.totals.grossProfit),
            '',
          ],
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'sales-by-product.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'sales-by-product.xlsx', report.data);
    }
    return report;
  }

  @Get('by-customer')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Sales and outstanding balance per customer' })
  async byCustomer(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: SalesByCustomerQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.salesByCustomer(user.tenantId, query);
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'sales-by-customer.pdf', () =>
        buildTablePdf({
          title: 'Sales by Customer',
          subtitle: rangeText(query),
          columns: [
            { header: 'Code' },
            { header: 'Customer' },
            { header: 'Invoices', align: 'right' },
            { header: 'Sold', align: 'right' },
            { header: 'Paid', align: 'right' },
            { header: 'Balance', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.code,
            row.tradeName,
            formatNumber(row.invoices),
            formatMoney(row.totalSold),
            formatMoney(row.totalPaid),
            formatMoney(row.balance),
          ]),
          totalsRow: [
            '',
            'Total',
            '',
            formatMoney(report.totals.totalSold),
            formatMoney(report.totals.totalPaid),
            formatMoney(report.totals.balance),
          ],
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'sales-by-customer.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'sales-by-customer.xlsx', report.data);
    }
    return report;
  }
}
