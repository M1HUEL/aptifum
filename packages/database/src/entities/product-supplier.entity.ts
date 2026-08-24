import { Relation, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';
import { numericTransformer } from '../base/transformers.js';

import { Product } from './product.entity.js';
import { Supplier } from './supplier.entity.js';

@Entity('product_suppliers')
@Unique(['tenantId', 'productId', 'supplierId'])
export class ProductSupplier extends TenantBaseEntity {
  @Index('IDX_product_suppliers_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Index('IDX_product_suppliers_supplier_id')
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'supplier_sku', type: 'varchar', length: 60, nullable: true })
  supplierSku: string | null;

  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  unitCost: number | null;

  @Column({ name: 'lead_time_days', type: 'int', nullable: true })
  leadTimeDays: number | null;

  @Column({ name: 'is_preferred', type: 'boolean', default: false })
  isPreferred: boolean;

  @ManyToOne(() => Product, (product) => product.suppliers)
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Relation<Supplier>;
}
