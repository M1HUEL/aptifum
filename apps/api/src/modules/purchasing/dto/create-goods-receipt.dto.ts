import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateGoodsReceiptItemDto {
  @IsUUID()
  orderItemId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

export class CreateGoodsReceiptDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  @ArrayMinSize(1)
  items: CreateGoodsReceiptItemDto[];
}
