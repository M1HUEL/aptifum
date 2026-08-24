import { Relation, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';
import { numericTransformer } from '../base/transformers.js';

import { Employee } from './hr-employee.entity.js';
import { Payroll } from './hr-payroll.entity.js';

@Entity('hr_payroll_lines')
@Unique('UQ_hr_payroll_lines_tenant_payroll_employee', ['tenantId', 'payrollId', 'employeeId'])
export class PayrollLine extends TenantBaseEntity {
  @Index('IDX_hr_payroll_lines_payroll_id')
  @Column({ name: 'payroll_id', type: 'uuid' })
  payrollId: string;

  @Index('IDX_hr_payroll_lines_employee_id')
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  gross: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  bonus: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  overtime: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  deductions: number;

  @Column({ name: 'net', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  net: number;

  @ManyToOne(() => Payroll, (payroll) => payroll.lines)
  @JoinColumn({ name: 'payroll_id', foreignKeyConstraintName: 'FK_hr_payroll_lines_payroll' })
  payroll: Relation<Payroll> | null;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id', foreignKeyConstraintName: 'FK_hr_payroll_lines_employee' })
  employee: Relation<Employee> | null;
}
