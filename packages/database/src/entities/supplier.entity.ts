import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

@Entity('suppliers')
@Unique(['tenantId', 'code'])
export class Supplier extends TenantBaseEntity {
  @Column({ length: 40 })
  code: string;

  @Column({ name: 'trade_name', length: 255 })
  tradeName: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 255, nullable: true })
  legalName: string | null;

  @Index()
  @Column({ name: 'tax_id', type: 'varchar', length: 40, nullable: true })
  taxId: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'payment_terms', type: 'varchar', length: 60, nullable: true })
  paymentTerms: string | null;

  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  creditLimit: number;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;
}
