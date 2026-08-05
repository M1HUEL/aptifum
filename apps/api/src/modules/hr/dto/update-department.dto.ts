import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
