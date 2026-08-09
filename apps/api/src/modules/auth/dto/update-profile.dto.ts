import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword?: string;
}
