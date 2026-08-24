import { Relation, Column, Entity, ManyToMany } from 'typeorm';

import { BaseEntity } from '../base/base.entity.js';

import { User } from './user.entity.js';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ unique: true, length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: string[];

  @Column({ name: 'is_system', default: true })
  isSystem: boolean;

  @ManyToMany(() => User, (user) => user.roles)
  users: Relation<User>[];
}
