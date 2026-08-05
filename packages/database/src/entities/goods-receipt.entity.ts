import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { Supplier } from './supplier.entity';
import { Warehouse } from './warehouse.entity';

@Entity('goods_receipts')
@Unique(['tenantId', 'number'])
export class GoodsReceipt extends TenantBaseEntity {
  @Column({ length: 30 })
  number: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'order_id' })
  order: PurchaseOrder;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @OneToMany(() => GoodsReceiptItem, (item) => item.receipt, { cascade: true })
  items: GoodsReceiptItem[];
}
