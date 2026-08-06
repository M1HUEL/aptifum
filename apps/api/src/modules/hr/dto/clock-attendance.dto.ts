import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ClockAttendanceDto {
  @IsUUID()
  employeeId: string;

  @IsEnum(['in', 'out'])
  action: 'in' | 'out';

  @IsOptional()
  @IsISO8601()
  at?: string;
}
