import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TaxKind } from '@aptifum/core';

export class CreateTaxDto {
  @IsString()
  @MaxLength(60)
  name: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsEnum(TaxKind)
  kind?: TaxKind;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
