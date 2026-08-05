import { Column, Entity } from 'typeorm';
import { TaxKind } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

@Entity('taxes')
export class Tax extends TenantBaseEntity {
  @Column({ length: 60 })
  name: string;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 4,
    transformer: numericTransformer,
  })
  rate: number;

  @Column({ type: 'enum', enum: TaxKind, default: TaxKind.SALES })
  kind: TaxKind;

  @Column({ default: true })
  active: boolean;
}
