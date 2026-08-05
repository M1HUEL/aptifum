import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(40)
  code: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
