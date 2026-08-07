import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { GoodsReceipt } from './goods-receipt.entity';
import { Product } from './product.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity('goods_receipt_items')
export class GoodsReceiptItem extends TenantBaseEntity {
  @Index('IDX_gri_receipt_id')
  @Column({ name: 'receipt_id', type: 'uuid' })
  receiptId: string;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @Index('IDX_goods_receipt_items_product_id')
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
  @JoinColumn({ name: 'receipt_id', foreignKeyConstraintName: 'FK_gri_receipt' })
  receipt: GoodsReceipt;

  @ManyToOne(() => PurchaseOrderItem)
  @JoinColumn({ name: 'order_item_id', foreignKeyConstraintName: 'FK_gri_order_item' })
  orderItem: PurchaseOrderItem;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'FK_gri_product' })
  product: Product;
}
