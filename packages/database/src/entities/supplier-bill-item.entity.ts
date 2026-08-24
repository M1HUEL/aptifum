import { Relation, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';
import { numericTransformer } from '../base/transformers.js';

import { Product } from './product.entity.js';
import { SupplierBill } from './supplier-bill.entity.js';

@Entity('supplier_bill_items')
export class SupplierBillItem extends TenantBaseEntity {
  @Index('IDX_sbi_bill_id')
  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ length: 255 })
  description: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 6,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  taxRate: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  lineTotal: number;

  @ManyToOne(() => SupplierBill, (bill) => bill.items)
  @JoinColumn({ name: 'bill_id', foreignKeyConstraintName: 'FK_sbi_bill' })
  bill: Relation<SupplierBill>;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'FK_sbi_product' })
  product: Relation<Product>;
}
