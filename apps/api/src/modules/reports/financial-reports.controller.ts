import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ModuleName, permission } from '@aptifum/core';

import type { CsvSection } from '../../common/export/csv.util';
import { sendCsv, sendPdf, sendSectionsCsv, sendSectionsXlsx, sendXlsx } from '../../common/export/export.util';
import {
  buildFinancialPdf,
  buildTablePdf,
  formatMoney,
  PdfFinancialSection,
  rangeText,
} from '../../common/pdf/pdf.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

import { BalanceSheetQueryDto, DateRangeQueryDto, IncomeStatementQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports/financial')
export class FinancialReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('income-statement')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Profit and loss statement for a period' })
  async incomeStatement(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: IncomeStatementQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.incomeStatement(user.tenantId, query);
    const netIncomeRow = { code: '', name: 'Net income', balance: report.netIncome };
    const sections = [
      this.toSection('Revenue', report.revenue),
      this.toSection('Cost of sales', report.costOfSales),
      this.toSection('Operating expenses', report.operatingExpenses),
      { section: 'Net income', rows: [netIncomeRow] },
    ];
    const pdfSections = [
      this.toFinancialSection('Revenue', report.revenue),
      this.toFinancialSection('Cost of sales', report.costOfSales),
      this.toFinancialSection('Operating expenses', report.operatingExpenses),
      { name: 'Net income', rows: [netIncomeRow], total: report.netIncome },
    ];
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'income-statement.pdf', () =>
        buildFinancialPdf({
          title: 'Income Statement',
          subtitle: rangeText(query),
          sections: pdfSections,
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendSectionsCsv(res, 'income-statement.csv', sections);
    }
    if (query.format === 'xlsx' && res) {
      return sendSectionsXlsx(res, 'income-statement.xlsx', sections);
    }
    return report;
  }

  @Get('balance-sheet')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Balance sheet as of a date' })
  async balanceSheet(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: BalanceSheetQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.balanceSheet(user.tenantId, query);
    const totalRows = [
      { code: '', name: 'Total assets', balance: report.totalAssets },
      {
        code: '',
        name: 'Total liabilities and equity',
        balance: report.totalLiabilitiesAndEquity,
      },
    ];
    const sections = [
      this.toSection('Assets', report.assets),
      this.toSection('Liabilities', report.liabilities),
      this.toSection('Equity', report.equity),
      { section: 'Totals', rows: totalRows },
    ];
    const pdfSections = [
      this.toFinancialSection('Assets', report.assets),
      this.toFinancialSection('Liabilities', report.liabilities),
      this.toFinancialSection('Equity', report.equity),
      { name: 'Totals', rows: totalRows, total: report.totalLiabilitiesAndEquity },
    ];
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'balance-sheet.pdf', () =>
        buildFinancialPdf({
          title: 'Balance Sheet',
          subtitle: `As of ${report.asOf}`,
          sections: pdfSections,
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendSectionsCsv(res, 'balance-sheet.csv', sections);
    }
    if (query.format === 'xlsx' && res) {
      return sendSectionsXlsx(res, 'balance-sheet.xlsx', sections);
    }
    return report;
  }

  @Get('cash-flow')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Cash flow statement grouped by month' })
  async cashFlow(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: DateRangeQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.cashFlow(user.tenantId, query);
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'cash-flow.pdf', () =>
        buildTablePdf({
          title: 'Cash Flow',
          subtitle: rangeText(query),
          columns: [
            { header: 'Period' },
            { header: 'Inflows', align: 'right' },
            { header: 'Outflows', align: 'right' },
            { header: 'Net', align: 'right' },
            { header: 'Cash balance', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.period,
            formatMoney(row.inflows),
            formatMoney(row.outflows),
            formatMoney(row.net),
            formatMoney(row.balance),
          ]),
          totalsRow: [
            'Total',
            formatMoney(report.totals.inflows),
            formatMoney(report.totals.outflows),
            formatMoney(report.totals.net),
            formatMoney(report.closingBalance),
          ],
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'cash-flow.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'cash-flow.xlsx', report.data);
    }
    return report;
  }

  private toSection(
    section: string,
    data: { accounts: Array<{ code: string; name: string; balance: number }>; total: number },
  ): CsvSection {
    const rows: Array<Record<string, unknown>> = data.accounts.map((account) => ({
      code: account.code,
      name: account.name,
      balance: account.balance,
    }));
    rows.push({ code: '', name: `Total ${section.toLowerCase()}`, balance: data.total });
    return { section, rows };
  }

  private toFinancialSection(
    section: string,
    data: { accounts: Array<{ code: string; name: string; balance: number }>; total: number },
  ): PdfFinancialSection {
    return {
      name: section,
      rows: data.accounts.map((account) => ({
        code: account.code,
        name: account.name,
        balance: account.balance,
      })),
      total: data.total,
    };
  }
}
