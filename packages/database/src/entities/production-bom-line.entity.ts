import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Product } from './product.entity';
import { ProductionBom } from './production-bom.entity';

@Entity('production_bom_lines')
export class ProductionBomLine extends TenantBaseEntity {
  @Index()
  @Column({ name: 'bom_id', type: 'uuid' })
  bomId: string;

  @Index()
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
    name: 'waste_rate',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  wasteRate: number;

  @ManyToOne(() => ProductionBom, (bom) => bom.lines)
  @JoinColumn({ name: 'bom_id' })
  bom: ProductionBom;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
