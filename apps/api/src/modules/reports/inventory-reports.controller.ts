import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { setCsvHeaders, toCsv } from './csv.util';

@ApiTags('reports')
@Controller('reports/inventory')
export class InventoryReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('valuation')
  @RequirePermissions(permission(ModuleName.REPORTING, 'read'))
  @ApiOperation({ summary: 'Inventory valuation by product and warehouse' })
  async valuation(
    @CurrentUser() user: { tenantId: string | null },
    @Query('warehouseId') warehouseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.inventoryValuation(user.tenantId, { warehouseId });
    if (format === 'csv' && res) {
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
    @Query('productId') productId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('movementType') movementType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.stockMovements(user.tenantId, {
      productId,
      warehouseId,
      movementType,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    if (format === 'csv' && res) {
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
    @Query('threshold') threshold?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const report = await this.reportsService.lowStock(user.tenantId, {
      threshold: threshold ? Number(threshold) : undefined,
      warehouseId,
    });
    if (format === 'csv' && res) {
      setCsvHeaders(res, 'low-stock.csv');
      return toCsv(report.data);
    }
    return report;
  }
}
