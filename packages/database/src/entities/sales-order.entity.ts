import { Relation, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';

import { SalesOrderKind, SalesOrderStatus } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';
import { numericTransformer } from '../base/transformers.js';

import { Customer } from './customer.entity.js';
import { SalesOrderItem } from './sales-order-item.entity.js';
import { Warehouse } from './warehouse.entity.js';

@Entity('sales_orders')
@Unique(['tenantId', 'number'])
@Index('IDX_sales_orders_tenant_status', ['tenantId', 'status'])
export class SalesOrder extends TenantBaseEntity {
  @Column({ length: 30 })
  number: string;

  @Column({ type: 'enum', enum: SalesOrderKind, default: SalesOrderKind.ORDER })
  kind: SalesOrderKind;

  @Column({ type: 'enum', enum: SalesOrderStatus, default: SalesOrderStatus.DRAFT })
  status: SalesOrderStatus;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({ name: 'issue_date', type: 'date', default: () => 'CURRENT_DATE' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  subtotal: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discount: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  tax: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  total: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Relation<Customer>;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Relation<Warehouse>;

  @OneToMany(() => SalesOrderItem, (item) => item.order, { cascade: true })
  items: Relation<SalesOrderItem>[];
}
