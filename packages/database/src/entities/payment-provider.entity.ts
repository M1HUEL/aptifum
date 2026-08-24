import { Column, Entity, Index, Unique } from 'typeorm';

import { PaymentProvider, PaymentProviderEnvironment } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';

@Entity('payment_providers')
@Unique('UQ_pp_tenant_provider', ['tenantId', 'provider'])
export class PaymentProviderConfig extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 30 })
  provider: PaymentProvider;

  @Column({ type: 'varchar', length: 10, default: 'test' })
  environment: PaymentProviderEnvironment;

  @Column({ name: 'secret_key', type: 'text' })
  secretKey: string;

  @Column({ name: 'webhook_secret', type: 'text' })
  webhookSecret: string;

  @Index()
  @Column({ name: 'is_enabled', type: 'boolean', default: false })
  isEnabled: boolean;
}
