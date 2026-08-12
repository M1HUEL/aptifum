import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class CreateRevaluationDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;
}
