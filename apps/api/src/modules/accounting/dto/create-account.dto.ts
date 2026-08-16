import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AccountNormalBalance, AccountType } from '@aptifum/core';

export class CreateAccountDto {
  @IsString()
  @MaxLength(20)
  code: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsEnum(AccountNormalBalance)
  normalBalance: AccountNormalBalance;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
