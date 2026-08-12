import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum PaymentProviderEnvironment {
  TEST = 'test',
  LIVE = 'live',
}

export class UpsertPaymentProviderDto {
  @IsEnum(PaymentProviderEnvironment)
  environment: PaymentProviderEnvironment;

  @IsString()
  @MinLength(8)
  secretKey: string;

  @IsString()
  @MinLength(8)
  webhookSecret: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
