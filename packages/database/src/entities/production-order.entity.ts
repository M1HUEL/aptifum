import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';

import { ProductionOrderStatus } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

import { Product } from './product.entity';
import { ProductionBom } from './production-bom.entity';
import { ProductionOrderLine } from './production-order-line.entity';
import { Warehouse } from './warehouse.entity';

@Entity('production_orders')
@Unique('UQ_production_orders_tenant_number', ['tenantId', 'number'])
export class ProductionOrder extends TenantBaseEntity {
  @Index('IDX_production_orders_number')
  @Column({ length: 30 })
  number: string;

  @Index('IDX_production_orders_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Index('IDX_production_orders_bom_id')
  @Column({ name: 'bom_id', type: 'uuid', nullable: true })
  bomId: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    transformer: numericTransformer,
  })
  quantity: number;

  @Index('IDX_production_orders_status')
  @Column({
    type: 'enum',
    enum: ProductionOrderStatus,
    default: ProductionOrderStatus.PLANNED,
  })
  status: ProductionOrderStatus;

  @Index('IDX_production_orders_warehouse_id')
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({
    name: 'labor_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  laborCost: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  overhead: number;

  @Column({
    name: 'material_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  materialCost: number;

  @Column({
    name: 'total_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalCost: number;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id', foreignKeyConstraintName: 'FK_production_orders_product' })
  product: Product;

  @ManyToOne(() => ProductionBom, { nullable: true })
  @JoinColumn({ name: 'bom_id', foreignKeyConstraintName: 'FK_production_orders_bom' })
  bom: ProductionBom | null;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id', foreignKeyConstraintName: 'FK_production_orders_warehouse' })
  warehouse: Warehouse;

  @OneToMany(() => ProductionOrderLine, (line) => line.order)
  lines: ProductionOrderLine[];
}
