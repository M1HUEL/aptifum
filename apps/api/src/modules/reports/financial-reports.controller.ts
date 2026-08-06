import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { CsvSection, setCsvHeaders, sectionsToCsv } from './csv.util';

@ApiTags('reports')
@Controller('reports/financial')
export class FinancialReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('income-statement')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Profit and loss statement for a period' })
  async incomeStatement(
    @CurrentUser() user: { tenantId: string | null },
    @Query('periodId') periodId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.incomeStatement(user.tenantId, { periodId, from, to });
    if (format === 'csv' && res) {
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
    return report;
  }

  @Get('balance-sheet')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Balance sheet as of a date' })
  async balanceSheet(
    @CurrentUser() user: { tenantId: string | null },
    @Query('asOf') asOf?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.balanceSheet(user.tenantId, { asOf });
    if (format === 'csv' && res) {
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
}
