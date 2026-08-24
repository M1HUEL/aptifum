import { Relation, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';
import { numericTransformer } from '../base/transformers.js';

import { Product } from './product.entity.js';
import { ProductionBom } from './production-bom.entity.js';

@Entity('production_bom_lines')
export class ProductionBomLine extends TenantBaseEntity {
  @Index('IDX_production_bom_lines_bom_id')
  @Column({ name: 'bom_id', type: 'uuid' })
  bomId: string;

  @Index('IDX_production_bom_lines_product_id')
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
  @JoinColumn({ name: 'bom_id', foreignKeyConstraintName: 'FK_production_bom_lines_bom' })
  bom: Relation<ProductionBom>;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'FK_production_bom_lines_product' })
  product: Relation<Product>;
}
