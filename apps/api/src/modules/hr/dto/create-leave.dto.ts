import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { LeaveType } from '@aptifum/core';

export class CreateLeaveDto {
  @IsUUID()
  employeeId: string;

  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
