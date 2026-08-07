import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { Product } from './product.entity';
import { ProductionOrder } from './production-order.entity';

@Entity('production_order_lines')
@Unique('UQ_production_order_lines_tenant_order_product', ['tenantId', 'orderId', 'productId'])
export class ProductionOrderLine extends TenantBaseEntity {
  @Index('IDX_production_order_lines_order_id')
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Index('IDX_production_order_lines_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({
    name: 'planned_quantity',
    type: 'numeric',
    precision: 18,
    scale: 4,
    transformer: numericTransformer,
  })
  plannedQuantity: number;

  @Column({
    name: 'consumed_quantity',
    type: 'numeric',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: numericTransformer,
  })
  consumedQuantity: number;

  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  unitCost: number;

  @Column({
    name: 'line_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  lineCost: number;

  @ManyToOne(() => ProductionOrder, (order) => order.lines)
  @JoinColumn({ name: 'order_id', foreignKeyConstraintName: 'FK_production_order_lines_order' })
  order: ProductionOrder;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'FK_production_order_lines_product' })
  product: Product;
}
