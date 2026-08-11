import { IsDateString, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateExchangeRateDto {
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'baseCurrency must be a 3-letter ISO code' })
  baseCurrency: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'quoteCurrency must be a 3-letter ISO code' })
  quoteCurrency: string;

  @IsNumber()
  @Min(0.000001)
  rate: number;

  @IsOptional()
  @IsDateString()
  rateDate?: string;
}
