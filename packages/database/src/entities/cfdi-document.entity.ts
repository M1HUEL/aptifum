import { Relation, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { CfdiStatus } from '@aptifum/core';

import { TenantBaseEntity } from '../base/tenant-base.entity.js';
import { numericTransformer } from '../base/transformers.js';

import { Invoice } from './invoice.entity.js';

@Entity('cfdi_documents')
@Unique('UQ_cfdi_tenant_invoice', ['tenantId', 'invoiceId'])
@Unique('UQ_cfdi_tenant_uuid', ['tenantId', 'uuid'])
export class CfdiDocument extends TenantBaseEntity {
  @Index('IDX_cfdi_invoice_id')
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Index('IDX_cfdi_uuid')
  @Column({ type: 'uuid' })
  uuid: string;

  @Column({ type: 'varchar', length: 25, nullable: true })
  serie: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  folio: string | null;

  @Column({ length: 3, default: '4.0' })
  version: string;

  @Column({ length: 1 })
  type: string;

  @Index('IDX_cfdi_status')
  @Column({ type: 'enum', enum: CfdiStatus, default: CfdiStatus.PENDING })
  status: CfdiStatus;

  @Column({ name: 'emitter_rfc', length: 13 })
  emitterRfc: string;

  @Column({ name: 'emitter_name', length: 255 })
  emitterName: string;

  @Column({ name: 'emitter_regime', length: 5 })
  emitterRegime: string;

  @Column({ name: 'receiver_rfc', length: 13 })
  receiverRfc: string;

  @Column({ name: 'receiver_name', length: 255 })
  receiverName: string;

  @Column({ name: 'receiver_uso', type: 'varchar', length: 4, nullable: true })
  receiverUso: string | null;

  @Column({ name: 'payment_form', length: 2 })
  paymentForm: string;

  @Column({ name: 'payment_method', length: 3 })
  paymentMethod: string;

  @Column({ length: 2, default: '01' })
  exportacion: string;

  @Column({ name: 'place_of_expedition', length: 5 })
  placeOfExpedition: string;

  @Column({ length: 3 })
  currency: string;

  @Column({
    name: 'exchange_rate',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 1,
    transformer: numericTransformer,
  })
  exchangeRate: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  subtotal: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discount: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  tax: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  total: number;

  @Column({ type: 'text' })
  xml: string;

  @Column({ name: 'cadena_original', type: 'text' })
  cadenaOriginal: string;

  @Column({ type: 'text' })
  sello: string;

  @Column({ name: 'cert_number', length: 40 })
  certNumber: string;

  @Column({ name: 'rfc_prov_certif', length: 13 })
  rfcProvCertif: string;

  @Column({ name: 'cert_sat_number', length: 40 })
  certSatNumber: string;

  @Column({ name: 'stamped_at', type: 'timestamptz', nullable: true })
  stampedAt: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: string | null;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Relation<Invoice>;
}
