import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { PurchaseOrderStatus } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Supplier } from './supplier.entity';
import { Warehouse } from './warehouse.entity';

@Entity('purchase_orders')
@Unique(['tenantId', 'number'])
export class PurchaseOrder extends TenantBaseEntity {
  @Column({ length: 30 })
  number: string;

  @Column({ type: 'enum', enum: PurchaseOrderStatus, default: PurchaseOrderStatus.DRAFT })
  status: PurchaseOrderStatus;

  @Index()
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({ name: 'issue_date', type: 'date', default: () => 'CURRENT_DATE' })
  issueDate: string;

  @Column({ name: 'expected_at', type: 'date', nullable: true })
  expectedAt: string | null;

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

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @OneToMany(() => PurchaseOrderItem, (item) => item.order, { cascade: true })
  items: PurchaseOrderItem[];
}
