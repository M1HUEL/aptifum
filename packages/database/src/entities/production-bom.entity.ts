import { Relation, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';
import { numericTransformer } from '../base/transformers.js';

import { Product } from './product.entity.js';
import { ProductionBomLine } from './production-bom-line.entity.js';

@Entity('production_boms')
export class ProductionBom extends TenantBaseEntity {
  @Index('IDX_production_boms_name')
  @Column({ length: 120 })
  name: string;

  @Index('IDX_production_boms_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({
    name: 'output_quantity',
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: 1,
    transformer: numericTransformer,
  })
  outputQuantity: number;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'FK_production_boms_product' })
  product: Relation<Product>;

  @OneToMany(() => ProductionBomLine, (line) => line.bom)
  lines: Relation<ProductionBomLine>[];
}
