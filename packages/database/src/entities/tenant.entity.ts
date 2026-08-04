import { Column, Entity, ManyToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { User } from './user.entity';

@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ length: 120 })
  name: string;

  @Column({ name: 'tax_id', type: 'varchar', length: 40, nullable: true })
  taxId: string | null;

  @Column({ name: 'default_currency', length: 3, default: 'USD' })
  defaultCurrency: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config: Record<string, unknown>;

  @ManyToMany(() => User, (user) => user.tenants)
  users: User[];
}
