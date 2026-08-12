import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Warehouse } from './warehouse.entity';

@Entity('product_lots')
@Index(
  'UQ_product_lots_tenant_product_warehouse_lot',
  ['tenantId', 'productId', 'warehouseId', 'lotNumber'],
  { unique: true, where: `"variant_id" IS NULL` },
)
@Index(
  'UQ_product_lots_tenant_variant_warehouse_lot',
  ['tenantId', 'productId', 'variantId', 'warehouseId', 'lotNumber'],
  { unique: true, where: `"variant_id" IS NOT NULL` },
)
export class ProductLot extends TenantBaseEntity {
  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Index('IDX_product_lots_variant_id')
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  @Index()
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Index()
  @Column({ name: 'lot_number', type: 'varchar', length: 80 })
  lotNumber: string;

  @Index()
  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  quantity: number;

  @ManyToOne(() => Product, (product) => product.lots)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => ProductVariant, (variant) => variant.lots)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.lots)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;
}
