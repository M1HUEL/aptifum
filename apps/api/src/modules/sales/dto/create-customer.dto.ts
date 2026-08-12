import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { FISCAL_REGIMES, USO_CFDI } from '@aptifum/core';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(40)
  code: string;

  @IsString()
  @MaxLength(255)
  tradeName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.keys(USO_CFDI))
  usoCfdi?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.keys(FISCAL_REGIMES))
  regimenFiscal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  priceCategory?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
