import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';

@Entity('product_stock')
@Unique(['tenantId', 'productId', 'warehouseId'])
export class ProductStock extends TenantBaseEntity {
  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Index()
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    name: 'reserved_quantity',
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  reservedQuantity: number;

  @Column({
    name: 'average_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  averageCost: number;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Product, (product) => product.stocks)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.stocks)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;
}
