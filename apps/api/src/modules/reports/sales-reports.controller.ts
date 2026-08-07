import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { setCsvHeaders, toCsv } from './csv.util';
import {
  SalesByCustomerQueryDto,
  SalesByProductQueryDto,
  SalesSummaryQueryDto,
} from './dto/reports-query.dto';

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
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'sales-summary.csv');
      return toCsv(report.data);
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
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'sales-by-product.csv');
      return toCsv(report.data);
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
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'sales-by-customer.csv');
      return toCsv(report.data);
    }
    return report;
  }
}
