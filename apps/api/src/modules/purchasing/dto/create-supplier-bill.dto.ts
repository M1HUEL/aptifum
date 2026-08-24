import { Type } from 'class-transformer';
import { ArrayMinSize, IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { CreateSupplierBillItemDto } from './create-supplier-bill-item.dto';

export class CreateSupplierBillDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  receiptId?: string;

  @IsOptional()
  @IsDateString()
  billDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateSupplierBillItemDto)
  @ArrayMinSize(1)
  items: CreateSupplierBillItemDto[];
}
