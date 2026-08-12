import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';

@Entity('cfdi_certificates')
@Unique('UQ_cfdi_cert_tenant_kind', ['tenantId', 'kind'])
export class CfdiCertificate extends TenantBaseEntity {
  @Column({ length: 10 })
  kind: string;

  @Column({ length: 13 })
  rfc: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'serial_number', length: 40 })
  serialNumber: string;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: string;

  @Column({ name: 'valid_to', type: 'date' })
  validTo: string;

  @Column({ name: 'certificate_pem', type: 'text' })
  certificatePem: string;

  @Column({ name: 'private_key_pem', type: 'text' })
  privateKeyPem: string;

  @Column({ default: true })
  active: boolean;
}
