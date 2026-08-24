import { Relation, Column, Entity, OneToMany, Unique } from 'typeorm';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';

import { ProductLot } from './product-lot.entity.js';
import { ProductStock } from './product-stock.entity.js';
import { WarehouseLocation } from './warehouse-location.entity.js';

@Entity('warehouses')
@Unique(['tenantId', 'code'])
export class Warehouse extends TenantBaseEntity {
  @Column({ length: 40 })
  code: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => WarehouseLocation, (location) => location.warehouse)
  locations: Relation<WarehouseLocation>[];

  @OneToMany(() => ProductStock, (stock) => stock.warehouse)
  stocks: Relation<ProductStock>[];

  @OneToMany(() => ProductLot, (lot) => lot.warehouse)
  lots: Relation<ProductLot>[];
}
