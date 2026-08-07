import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { MovementType } from '@aptifum/core';
import { BaseEntity } from '../base/base.entity';
import { numericTransformer } from '../base/transformers';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';

@Entity('stock_movements')
export class StockMovement extends BaseEntity {
  @Index()
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'movement_type', type: 'enum', enum: MovementType })
  movementType: MovementType;

  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Index()
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Index('IDX_stock_movements_tenant_occurred_at', ['tenantId', 'occurredAt'])
  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  unitCost: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 120, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Product, (product) => product.movements)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;
}
