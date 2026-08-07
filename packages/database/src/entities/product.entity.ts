import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Category } from './category.entity';
import { ProductStock } from './product-stock.entity';
import { StockMovement } from './stock-movement.entity';

@Entity('products')
@Unique(['tenantId', 'sku'])
export class Product extends TenantBaseEntity {
  @Column({ length: 60 })
  sku: string;

  @Index()
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index('IDX_products_category_id')
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  brand: string | null;

  @Column({ name: 'unit_of_measure', length: 20, default: 'unit' })
  unitOfMeasure: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

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

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Category, (category) => category.products, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @OneToMany(() => ProductStock, (stock) => stock.product)
  stocks: ProductStock[];

  @OneToMany(() => StockMovement, (movement) => movement.product)
  movements: StockMovement[];
}
