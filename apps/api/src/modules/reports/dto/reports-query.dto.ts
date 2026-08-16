import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MovementType } from '@aptifum/core';

export class FormatQueryDto {
  @IsOptional()
  @IsIn(['csv', 'pdf', 'xlsx'])
  format?: 'csv' | 'pdf' | 'xlsx';
}

export class DateRangeQueryDto extends FormatQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class SalesSummaryQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsIn(['day', 'month', 'quarter', 'year'])
  groupBy?: 'day' | 'month' | 'quarter' | 'year';

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class SalesByProductQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class SalesByCustomerQueryDto extends DateRangeQueryDto {}

export class DashboardQueryDto extends DateRangeQueryDto {}

export class InventoryValuationQueryDto extends FormatQueryDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class StockMovementsQueryDto extends FormatQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsIn(Object.values(MovementType))
  movementType?: MovementType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class LowStockQueryDto extends FormatQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold?: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class IncomeStatementQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  periodId?: string;
}

export class BalanceSheetQueryDto extends FormatQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
