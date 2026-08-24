import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';

@Entity('product_stock')
@Index('UQ_product_stock_tenant_product_warehouse', ['tenantId', 'productId', 'warehouseId'], {
  unique: true,
  where: `"variant_id" IS NULL`,
})
@Index('UQ_product_stock_tenant_variant_warehouse', ['tenantId', 'productId', 'variantId', 'warehouseId'], {
  unique: true,
  where: `"variant_id" IS NOT NULL`,
})
export class ProductStock extends TenantBaseEntity {
  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Index('IDX_product_stock_variant_id')
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

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

  @ManyToOne(() => ProductVariant, (variant) => variant.stocks)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.stocks)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;
}
