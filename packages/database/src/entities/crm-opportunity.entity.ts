import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { OpportunityStage } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Customer } from './customer.entity';
import { CrmLead } from './crm-lead.entity';

@Entity('crm_opportunities')
export class CrmOpportunity extends TenantBaseEntity {
  @Index()
  @Column({ length: 255 })
  name: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ name: 'lead_id', type: 'uuid', nullable: true })
  leadId: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: OpportunityStage,
    default: OpportunityStage.PROSPECTING,
  })
  stage: OpportunityStage;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  probability: number;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate: string | null;

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId: string | null;

  @Column({ name: 'won_at', type: 'timestamptz', nullable: true })
  wonAt: Date | null;

  @Column({ name: 'lost_at', type: 'timestamptz', nullable: true })
  lostAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => CrmLead)
  @JoinColumn({ name: 'lead_id' })
  lead: CrmLead | null;
}
