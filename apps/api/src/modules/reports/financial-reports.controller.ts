import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { CsvSection, setCsvHeaders, sectionsToCsv, toCsv } from './csv.util';
import { sectionsToXlsxBuffer, setXlsxHeaders, toXlsxBuffer } from './xlsx.util';
import {
  buildFinancialPdf,
  buildTablePdf,
  formatMoney,
  PdfFinancialSection,
  rangeText,
  setPdfHeaders,
} from './pdf.util';
import {
  BalanceSheetQueryDto,
  DateRangeQueryDto,
  IncomeStatementQueryDto,
} from './dto/reports-query.dto';

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
    if (query.format === 'pdf' && res) {
      setPdfHeaders(res, 'income-statement.pdf');
      const buffer = await buildFinancialPdf({
        title: 'Income Statement',
        subtitle: rangeText(query),
        sections: [
          this.toFinancialSection('Revenue', report.revenue),
          this.toFinancialSection('Cost of sales', report.costOfSales),
          this.toFinancialSection('Operating expenses', report.operatingExpenses),
          {
            name: 'Net income',
            rows: [{ code: '', name: 'Net income', balance: report.netIncome }],
            total: report.netIncome,
          },
        ],
      });
      res.send(buffer);
      return;
    }
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'income-statement.csv');
      return sectionsToCsv([
        this.toSection('Revenue', report.revenue),
        this.toSection('Cost of sales', report.costOfSales),
        this.toSection('Operating expenses', report.operatingExpenses),
        {
          section: 'Net income',
          rows: [{ code: '', name: 'Net income', balance: report.netIncome }],
        },
      ]);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'income-statement.xlsx');
      res.send(
        await sectionsToXlsxBuffer([
          this.toSection('Revenue', report.revenue),
          this.toSection('Cost of sales', report.costOfSales),
          this.toSection('Operating expenses', report.operatingExpenses),
          {
            section: 'Net income',
            rows: [{ code: '', name: 'Net income', balance: report.netIncome }],
          },
        ]),
      );
      return;
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
    if (query.format === 'pdf' && res) {
      setPdfHeaders(res, 'balance-sheet.pdf');
      const buffer = await buildFinancialPdf({
        title: 'Balance Sheet',
        subtitle: `As of ${report.asOf}`,
        sections: [
          this.toFinancialSection('Assets', report.assets),
          this.toFinancialSection('Liabilities', report.liabilities),
          this.toFinancialSection('Equity', report.equity),
          {
            name: 'Totals',
            rows: [
              { code: '', name: 'Total assets', balance: report.totalAssets },
              {
                code: '',
                name: 'Total liabilities and equity',
                balance: report.totalLiabilitiesAndEquity,
              },
            ],
            total: report.totalLiabilitiesAndEquity,
          },
        ],
      });
      res.send(buffer);
      return;
    }
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'balance-sheet.csv');
      return sectionsToCsv([
        this.toSection('Assets', report.assets),
        this.toSection('Liabilities', report.liabilities),
        this.toSection('Equity', report.equity),
        {
          section: 'Totals',
          rows: [
            { code: '', name: 'Total assets', balance: report.totalAssets },
            {
              code: '',
              name: 'Total liabilities and equity',
              balance: report.totalLiabilitiesAndEquity,
            },
          ],
        },
      ]);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'balance-sheet.xlsx');
      res.send(
        await sectionsToXlsxBuffer([
          this.toSection('Assets', report.assets),
          this.toSection('Liabilities', report.liabilities),
          this.toSection('Equity', report.equity),
          {
            section: 'Totals',
            rows: [
              { code: '', name: 'Total assets', balance: report.totalAssets },
              {
                code: '',
                name: 'Total liabilities and equity',
                balance: report.totalLiabilitiesAndEquity,
              },
            ],
          },
        ]),
      );
      return;
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
      setPdfHeaders(res, 'cash-flow.pdf');
      const buffer = await buildTablePdf({
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
      });
      res.send(buffer);
      return;
    }
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'cash-flow.csv');
      return toCsv(report.data);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'cash-flow.xlsx');
      res.send(await toXlsxBuffer(report.data));
      return;
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
