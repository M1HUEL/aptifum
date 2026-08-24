import { Relation, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';

import { Product } from './product.entity.js';

@Entity('categories')
export class Category extends TenantBaseEntity {
  @Column({ length: 120 })
  name: string;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => Category, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Relation<Category> | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Relation<Category>[];

  @OneToMany(() => Product, (product) => product.category)
  products: Relation<Product>[];
}
