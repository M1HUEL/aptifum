import { IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductVariantDto {
  @IsString()
  @MaxLength(60)
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;
}
