import { Column, Entity, Index, Unique } from 'typeorm';

import { AccountingPeriodStatus } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';

@Entity('accounting_periods')
@Unique('UQ_accounting_periods_tenant_period', ['tenantId', 'period'])
export class AccountingPeriod extends TenantBaseEntity {
  @Index('IDX_accounting_periods_period')
  @Column({ length: 7 })
  period: string;

  @Column({ length: 120 })
  label: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({
    type: 'enum',
    enum: AccountingPeriodStatus,
    default: AccountingPeriodStatus.OPEN,
  })
  status: AccountingPeriodStatus;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy: string | null;
}
