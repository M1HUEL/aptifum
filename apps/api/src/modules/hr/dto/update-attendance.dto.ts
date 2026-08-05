import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { AttendanceStatus } from '@aptifum/core';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsISO8601()
  clockInAt?: string;

  @IsOptional()
  @IsISO8601()
  clockOutAt?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
