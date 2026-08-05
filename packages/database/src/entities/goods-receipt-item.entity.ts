import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { GoodsReceipt } from './goods-receipt.entity';
import { Product } from './product.entity';

@Entity('goods_receipt_items')
export class GoodsReceiptItem extends TenantBaseEntity {
  @Index()
  @Column({ name: 'receipt_id', type: 'uuid' })
  receiptId: string;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

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

  @ManyToOne(() => GoodsReceipt, (receipt) => receipt.items)
  @JoinColumn({ name: 'receipt_id' })
  receipt: GoodsReceipt;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
