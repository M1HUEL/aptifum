import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { LeaveType } from '@aptifum/core';

export class UpdateLeaveDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
