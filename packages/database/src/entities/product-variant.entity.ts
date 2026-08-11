import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Product } from './product.entity';
import { ProductStock } from './product-stock.entity';
import { StockMovement } from './stock-movement.entity';

@Entity('product_variants')
@Unique(['tenantId', 'sku'])
export class ProductVariant extends TenantBaseEntity {
  @Index('IDX_product_variants_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ length: 60 })
  sku: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, string>;

  @Column({
    name: 'purchase_price',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  purchasePrice: number;

  @Column({
    name: 'sale_price',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  salePrice: number;

  @ManyToOne(() => Product, (product) => product.variants)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => ProductStock, (stock) => stock.variant)
  stocks: ProductStock[];

  @OneToMany(() => StockMovement, (movement) => movement.variant)
  movements: StockMovement[];
}
