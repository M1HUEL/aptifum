import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AttendanceStatus } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { Employee } from './hr-employee.entity';

@Entity('hr_attendance')
@Unique(['tenantId', 'employeeId', 'workDate'])
export class AttendanceRecord extends TenantBaseEntity {
  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'clock_in_at', type: 'timestamptz', nullable: true })
  clockInAt: Date | null;

  @Column({ name: 'clock_out_at', type: 'timestamptz', nullable: true })
  clockOutAt: Date | null;

  @Column({ name: 'worked_minutes', type: 'int', default: 0 })
  workedMinutes: number;

  @Index()
  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;
}
