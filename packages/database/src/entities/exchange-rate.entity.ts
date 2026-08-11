import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';

@Entity('exchange_rates')
@Unique('UQ_exchange_rates_tenant_pair_date', [
  'tenantId',
  'baseCurrency',
  'quoteCurrency',
  'rateDate',
])
export class ExchangeRate extends TenantBaseEntity {
  @Index('IDX_exchange_rates_tenant_pair_date')
  @Column({ name: 'base_currency', length: 3 })
  baseCurrency: string;

  @Column({ name: 'quote_currency', length: 3 })
  quoteCurrency: string;

  @Column({ name: 'rate_date', type: 'date', default: () => 'CURRENT_DATE' })
  rateDate: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    transformer: numericTransformer,
  })
  rate: number;
}
