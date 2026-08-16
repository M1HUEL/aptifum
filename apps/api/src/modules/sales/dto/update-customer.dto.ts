import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { FISCAL_REGIMES, USO_CFDI, US_STATES } from '@aptifum/core';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string;

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
  @MaxLength(2)
  @IsIn(Object.keys(US_STATES))
  state?: string;

  @IsOptional()
  @IsBoolean()
  taxExempt?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  priceCategory?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
