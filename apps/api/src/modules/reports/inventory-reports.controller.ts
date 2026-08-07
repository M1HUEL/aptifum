import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { setCsvHeaders, toCsv } from './csv.util';
import {
  InventoryValuationQueryDto,
  LowStockQueryDto,
  StockMovementsQueryDto,
} from './dto/reports-query.dto';

@ApiTags('reports')
@Controller('reports/inventory')
export class InventoryReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('valuation')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Inventory valuation by product and warehouse' })
  async valuation(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: InventoryValuationQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.inventoryValuation(user.tenantId, query);
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'inventory-valuation.csv');
      return toCsv(report.data);
    }
    return report;
  }

  @Get('movements')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Stock movements with filters' })
  async movements(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: StockMovementsQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.stockMovements(user.tenantId, query);
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'stock-movements.csv');
      return toCsv(report.data);
    }
    return report;
  }

  @Get('low-stock')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Products at or below a stock threshold' })
  async lowStock(
    @CurrentUser() user: { tenantId: string | null },
    @Query() query: LowStockQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.lowStock(user.tenantId, query);
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'low-stock.csv');
      return toCsv(report.data);
    }
    return report;
  }
}
