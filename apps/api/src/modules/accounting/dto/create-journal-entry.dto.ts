import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateJournalEntryLineDto {
  @IsString()
  @MaxLength(20)
  accountCode: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class CreateJournalEntryDto {
  @IsDateString()
  entryDate: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  lines: CreateJournalEntryLineDto[];
}
