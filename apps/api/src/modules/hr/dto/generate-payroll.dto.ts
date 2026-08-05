import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayrollLineInputDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bonus?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overtime?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deductions?: number;
}

export class GeneratePayrollDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'period must be in YYYY-MM format' })
  period: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PayrollLineInputDto)
  lines: PayrollLineInputDto[];
}
