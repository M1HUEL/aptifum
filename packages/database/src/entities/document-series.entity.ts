import { Column, Entity, Unique } from 'typeorm';

import { DocumentSeriesKind } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

@Entity('document_series')
@Unique(['tenantId', 'kind'])
export class DocumentSeries extends TenantBaseEntity {
  @Column({ type: 'enum', enum: DocumentSeriesKind })
  kind: DocumentSeriesKind;

  @Column({ length: 10 })
  prefix: string;

  @Column({
    name: 'next_number',
    type: 'bigint',
    default: 1,
    transformer: numericTransformer,
  })
  nextNumber: number;

  @Column({ default: true })
  active: boolean;
}
