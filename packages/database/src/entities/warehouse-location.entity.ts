import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity';

import { Warehouse } from './warehouse.entity';

@Entity('warehouse_locations')
@Unique(['tenantId', 'warehouseId', 'code'])
export class WarehouseLocation extends TenantBaseEntity {
  @Index()
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId: string;

  @Column({ length: 40 })
  code: string;

  @Column({ length: 120 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.locations)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;
}
