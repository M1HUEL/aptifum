import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateCfdiSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^\d{2}$/)
  paymentForm?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  @Matches(/^\d{5}$/)
  placeOfExpedition?: string;
}
