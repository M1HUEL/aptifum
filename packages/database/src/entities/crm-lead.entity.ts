import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { LeadStatus } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

import { Customer } from './customer.entity';

@Entity('crm_leads')
@Unique(['tenantId', 'number'])
export class CrmLead extends TenantBaseEntity {
  @Index()
  @Column({ length: 30 })
  number: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  source: string | null;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 255 })
  contactName: string;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: LeadStatus,
    default: LeadStatus.NEW,
  })
  status: LeadStatus;

  @Column({
    name: 'estimated_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  estimatedAmount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'converted_customer_id', type: 'uuid', nullable: true })
  convertedCustomerId: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'converted_customer_id' })
  convertedCustomer: Customer | null;
}
