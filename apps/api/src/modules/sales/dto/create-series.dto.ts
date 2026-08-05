import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DocumentSeriesKind } from '@aptifum/core';

export class CreateSeriesDto {
  @IsEnum(DocumentSeriesKind)
  kind: DocumentSeriesKind;

  @IsString()
  @MaxLength(10)
  prefix: string;

  @IsOptional()
  @Min(1)
  nextNumber?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
