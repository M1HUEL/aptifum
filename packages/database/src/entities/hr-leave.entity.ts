import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { LeaveStatus, LeaveType } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { Employee } from './hr-employee.entity';

@Entity('hr_leaves')
export class Leave extends TenantBaseEntity {
  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Index()
  @Column({ name: 'leave_type', type: 'enum', enum: LeaveType })
  leaveType: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'int', default: 1 })
  days: number;

  @Index()
  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;
}
