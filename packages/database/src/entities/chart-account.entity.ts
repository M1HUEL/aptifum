import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AccountNormalBalance, AccountType } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';

@Entity('chart_accounts')
@Unique(['tenantId', 'code'])
export class ChartAccount extends TenantBaseEntity {
  @Index()
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
  @JoinColumn({ name: 'parent_id' })
  parent: ChartAccount | null;
}
