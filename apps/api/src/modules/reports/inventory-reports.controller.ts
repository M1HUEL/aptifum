import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { setCsvHeaders, toCsv } from './csv.util';
import { setXlsxHeaders, toXlsxBuffer } from './xlsx.util';
import { buildTablePdf, formatMoney, formatNumber, rangeText, setPdfHeaders } from './pdf.util';
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
    if (query.format === 'pdf' && res) {
      setPdfHeaders(res, 'inventory-valuation.pdf');
      const buffer = await buildTablePdf({
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
        totalsRow: [
          '',
          'Total',
          '',
          '',
          formatNumber(report.totals.quantity),
          '',
          formatMoney(report.totals.value),
        ],
      });
      res.send(buffer);
      return;
    }
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'inventory-valuation.csv');
      return toCsv(report.data);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'inventory-valuation.xlsx');
      res.send(await toXlsxBuffer(report.data));
      return;
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
      setPdfHeaders(res, 'stock-movements.pdf');
      const buffer = await buildTablePdf({
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
      });
      res.send(buffer);
      return;
    }
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'stock-movements.csv');
      return toCsv(report.data);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'stock-movements.xlsx');
      res.send(await toXlsxBuffer(report.data));
      return;
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
      setPdfHeaders(res, 'low-stock.pdf');
      const buffer = await buildTablePdf({
        title: 'Low Stock',
        subtitle: `Threshold: ${report.threshold}`,
        columns: [
          { header: 'SKU' },
          { header: 'Product' },
          { header: 'UoM' },
          { header: 'Qty on hand', align: 'right' },
        ],
        rows: report.data.map((row) => [
          row.sku,
          row.name,
          row.unitOfMeasure,
          formatNumber(row.totalQuantity),
        ]),
        totalsRow: ['', 'Total products', '', formatNumber(report.totals.lowStock)],
      });
      res.send(buffer);
      return;
    }
    if (query.format === 'csv' && res) {
      setCsvHeaders(res, 'low-stock.csv');
      return toCsv(report.data);
    }
    if (query.format === 'xlsx' && res) {
      setXlsxHeaders(res, 'low-stock.xlsx');
      res.send(await toXlsxBuffer(report.data));
      return;
    }
    return report;
  }
}
