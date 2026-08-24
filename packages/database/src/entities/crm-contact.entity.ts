import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity';

import { Customer } from './customer.entity';

@Entity('crm_contacts')
export class CrmContact extends TenantBaseEntity {
  @Index()
  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;
}
