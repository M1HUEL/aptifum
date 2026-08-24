import { Relation, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { AccountNormalBalance, AccountType } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';

@Entity('chart_accounts')
@Unique('UQ_chart_accounts_tenant_code', ['tenantId', 'code'])
export class ChartAccount extends TenantBaseEntity {
  @Index('IDX_chart_accounts_code')
  @Column({ length: 20 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({
    name: 'normal_balance',
    type: 'enum',
    enum: AccountNormalBalance,
  })
  normalBalance: AccountNormalBalance;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => ChartAccount)
  @JoinColumn({ name: 'parent_id', foreignKeyConstraintName: 'FK_chart_accounts_parent' })
  parent: Relation<ChartAccount> | null;
}
