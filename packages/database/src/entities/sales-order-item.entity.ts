import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';
import { SalesOrder } from './sales-order.entity';

@Entity('sales_order_items')
export class SalesOrderItem extends TenantBaseEntity {
  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Index('IDX_sales_order_items_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Index('IDX_sales_order_items_variant_id')
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

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
    default: 0,
    transformer: numericTransformer,
  })
  unitPrice: number;

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

  @ManyToOne(() => SalesOrder, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: SalesOrder;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;
}
