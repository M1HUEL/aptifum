import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { EmployeeStatus } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

import { Department } from './hr-department.entity';

@Entity('hr_employees')
@Unique('UQ_hr_employees_tenant_employee_no', ['tenantId', 'employeeNo'])
export class Employee extends TenantBaseEntity {
  @Index('IDX_hr_employees_employee_no')
  @Column({ name: 'employee_no', type: 'varchar', length: 30 })
  employeeNo: string;

  @Column({ name: 'first_name', type: 'varchar', length: 120 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 120 })
  lastName: string;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Index('IDX_hr_employees_department_id')
  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  position: string | null;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate: string;

  @Column({ name: 'termination_date', type: 'date', nullable: true })
  terminationDate: string | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  salary: number;

  @Column({ name: 'salary_frequency', type: 'varchar', length: 20, default: 'monthly' })
  salaryFrequency: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 120, nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_account', type: 'varchar', length: 60, nullable: true })
  bankAccount: string | null;

  @Column({ name: 'tax_id', type: 'varchar', length: 60, nullable: true })
  taxId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Index('IDX_hr_employees_status')
  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'FK_hr_employees_department' })
  department: Department | null;
}
