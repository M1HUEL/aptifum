import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Product } from './product.entity';
import { PurchaseOrder } from './purchase-order.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem extends TenantBaseEntity {
  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Index('IDX_purchase_order_items_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

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
    name: 'unit_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  unitCost: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discount: number;

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
    name: 'tax_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  taxAmount: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  lineTotal: number;

  @Column({
    name: 'received_quantity',
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  receivedQuantity: number;

  @ManyToOne(() => PurchaseOrder, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: PurchaseOrder;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
