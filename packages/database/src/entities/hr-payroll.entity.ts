import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';

import { PayrollStatus } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

import { PayrollLine } from './hr-payroll-line.entity';
import { JournalEntry } from './journal-entry.entity';

@Entity('hr_payrolls')
@Unique('UQ_hr_payrolls_tenant_number', ['tenantId', 'number'])
export class Payroll extends TenantBaseEntity {
  @Index('IDX_hr_payrolls_number')
  @Column({ length: 30 })
  number: string;

  @Index('IDX_hr_payrolls_period')
  @Column({ length: 7 })
  period: string;

  @Index('IDX_hr_payrolls_status')
  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @Column({ name: 'currency', length: 3, default: 'USD' })
  currency: string;

  @Column({
    name: 'total_gross',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalGross: number;

  @Column({
    name: 'total_deductions',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalDeductions: number;

  @Column({
    name: 'total_net',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalNet: number;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'posted_entry_id', type: 'uuid', nullable: true })
  postedEntryId: string | null;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @OneToMany(() => PayrollLine, (line) => line.payroll)
  lines: PayrollLine[];

  @ManyToOne(() => JournalEntry)
  @JoinColumn({ name: 'posted_entry_id', foreignKeyConstraintName: 'FK_hr_payrolls_posted_entry' })
  postedEntry: JournalEntry | null;
}
