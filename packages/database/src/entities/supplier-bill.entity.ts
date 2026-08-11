import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { SupplierBillStatus } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Supplier } from './supplier.entity';
import { SupplierBillItem } from './supplier-bill-item.entity';

@Entity('supplier_bills')
@Unique('UQ_supplier_bills_tenant_number', ['tenantId', 'number'])
export class SupplierBill extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 30, nullable: true })
  number: string | null;

  @Index('IDX_supplier_bills_supplier_id')
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ name: 'receipt_id', type: 'uuid', nullable: true })
  receiptId: string | null;

  @Column({ type: 'enum', enum: SupplierBillStatus, default: SupplierBillStatus.DRAFT })
  status: SupplierBillStatus;

  @Column({ name: 'bill_date', type: 'date', default: () => 'CURRENT_DATE' })
  billDate: string;

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
  tax: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  total: number;

  @Column({
    name: 'paid_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  paidAmount: number;

  @Column({
    name: 'balance_due',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  balanceDue: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id', foreignKeyConstraintName: 'FK_sb_supplier' })
  supplier: Supplier;

  @OneToMany(() => SupplierBillItem, (item) => item.bill, { cascade: true })
  items: SupplierBillItem[];
}
