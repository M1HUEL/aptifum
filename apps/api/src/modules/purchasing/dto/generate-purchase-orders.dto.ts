import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class GeneratePurchaseOrdersDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];
}
