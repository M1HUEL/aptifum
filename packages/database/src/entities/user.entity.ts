import { Relation, Column, Entity, JoinTable, ManyToMany } from 'typeorm';

import { BaseEntity } from '../base/base.entity.js';

import { Role } from './role.entity.js';
import { Tenant } from './tenant.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true, length: 190 })
  email: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'default_tenant_id', type: 'uuid', nullable: true })
  defaultTenantId: string | null;

  @ManyToMany(() => Tenant, (tenant) => tenant.users)
  @JoinTable({
    name: 'user_tenants',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tenant_id', referencedColumnName: 'id' },
  })
  tenants: Relation<Tenant>[];

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Relation<Role>[];
}
