import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { ActivityType } from '@aptifum/core';

export class CreateActivityDto {
  @IsEnum(ActivityType)
  activityType: ActivityType;

  @IsString()
  @MaxLength(255)
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceType?: string;

  @IsOptional()
  @IsUUID()
  referenceId?: string;
}
