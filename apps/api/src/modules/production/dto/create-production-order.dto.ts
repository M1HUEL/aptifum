import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateProductionOrderDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  bomId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overhead?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
