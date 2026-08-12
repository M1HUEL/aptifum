import {
  ArrayMaxSize,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateUsSalesTaxDto {
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(60)
  nexusStates?: string[];

  @IsOptional()
  @IsObject()
  rates?: Record<string, number>;
}
