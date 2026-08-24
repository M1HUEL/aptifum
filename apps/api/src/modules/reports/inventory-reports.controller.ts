import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ModuleName, permission } from '@aptifum/core';

import { sendCsv, sendPdf, sendXlsx } from '../../common/export/export.util.js';
import { buildTablePdf, formatMoney, formatNumber, rangeText } from '../../common/pdf/pdf.util.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { InventoryValuationQueryDto, LowStockQueryDto, StockMovementsQueryDto } from './dto/reports-query.dto.js';
import { ReportsService } from './reports.service.js';

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
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'inventory-valuation.pdf', () =>
        buildTablePdf({
          title: 'Inventory Valuation',
          columns: [
            { header: 'SKU' },
            { header: 'Product' },
            { header: 'UoM' },
            { header: 'Warehouse' },
            { header: 'Qty', align: 'right' },
            { header: 'Avg cost', align: 'right' },
            { header: 'Value', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.sku,
            row.name,
            row.unitOfMeasure,
            row.warehouseCode,
            formatNumber(row.quantity),
            formatMoney(row.averageCost),
            formatMoney(row.value),
          ]),
          totalsRow: ['', 'Total', '', '', formatNumber(report.totals.quantity), '', formatMoney(report.totals.value)],
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'inventory-valuation.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'inventory-valuation.xlsx', report.data);
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
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'stock-movements.pdf', () =>
        buildTablePdf({
          title: 'Stock Movements',
          subtitle: rangeText(query),
          columns: [
            { header: 'Date' },
            { header: 'Type' },
            { header: 'Product' },
            { header: 'Warehouse' },
            { header: 'Qty', align: 'right' },
            { header: 'Unit cost', align: 'right' },
          ],
          rows: report.data.map((row) => [
            row.occurredAt,
            row.movementType,
            row.productName,
            row.warehouseCode ?? '',
            formatNumber(row.quantity),
            formatMoney(row.unitCost),
          ]),
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'stock-movements.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'stock-movements.xlsx', report.data);
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
    if (query.format === 'pdf' && res) {
      return sendPdf(res, 'low-stock.pdf', () =>
        buildTablePdf({
          title: 'Low Stock',
          subtitle: `Threshold: ${report.threshold}`,
          columns: [
            { header: 'SKU' },
            { header: 'Product' },
            { header: 'UoM' },
            { header: 'Qty on hand', align: 'right' },
          ],
          rows: report.data.map((row) => [row.sku, row.name, row.unitOfMeasure, formatNumber(row.totalQuantity)]),
          totalsRow: ['', 'Total products', '', formatNumber(report.totals.lowStock)],
        }),
      );
    }
    if (query.format === 'csv' && res) {
      return sendCsv(res, 'low-stock.csv', report.data);
    }
    if (query.format === 'xlsx' && res) {
      return sendXlsx(res, 'low-stock.xlsx', report.data);
    }
    return report;
  }
}
