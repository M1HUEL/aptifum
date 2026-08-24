import { Relation, Column, Entity, ManyToMany } from 'typeorm';

import { FiscalAddress } from '@aptifum/core';

import { BaseEntity } from '../base/base.entity.js';

import { User } from './user.entity.js';

@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ length: 120 })
  name: string;

  @Column({ name: 'tax_id', type: 'varchar', length: 40, nullable: true })
  taxId: string | null;

  @Column({ name: 'default_currency', length: 3, default: 'USD' })
  defaultCurrency: string;

  @Column({ length: 2, default: 'US' })
  country: string;

  @Column({ name: 'fiscal_regime', type: 'varchar', length: 5, nullable: true })
  fiscalRegime: string | null;

  @Column({ name: 'fiscal_address', type: 'jsonb', nullable: true })
  fiscalAddress: FiscalAddress | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config: Record<string, unknown>;

  @ManyToMany(() => User, (user) => user.tenants)
  users: Relation<User>[];
}
