import { createHash } from 'node:crypto';
import { X509Certificate } from 'node:crypto';
import selfsigned from 'selfsigned';

export interface DemoCertificate {
  certificatePem: string;
  privateKeyPem: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  rfc: string;
  name: string;
}

const SERIAL_LENGTH = 20;

export async function generateDemoCertificate(options: {
  rfc: string;
  name: string;
  days?: number;
}): Promise<DemoCertificate> {
  const { rfc, name, days = 3650 } = options;
  const cert = await selfsigned.generate(
    [
      { name: 'commonName', value: rfc },
      { name: 'organizationName', value: name },
    ],
    {
      keySize: 2048,
      days,
      algorithm: 'sha256',
      extensions: [
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, dataEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      ],
    },
  );
  const x509 = new X509Certificate(cert.cert);
  const serialNumber = normalizeSerialNumber(x509.serialNumber);
  return {
    certificatePem: cert.cert,
    privateKeyPem: cert.private,
    serialNumber,
    validFrom: toDateOnly(x509.validFrom),
    validTo: toDateOnly(x509.validTo),
    rfc,
    name,
  };
}

function toDateOnly(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : date.toISOString().slice(0, 10);
}

export function certificateBase64(certificatePem: string): string {
  return certificatePem
    .replace(/-----(BEGIN|END) [^-]*-----/g, '')
    .replace(/\s+/g, '');
}

export function certificateThumbprintSha256(certificatePem: string): string {
  return createHash('sha256').update(Buffer.from(certificatePem, 'utf8')).digest('hex');
}

function normalizeSerialNumber(hex: string): string {
  const upper = hex.toUpperCase().replace(/[^0-9A-F]/g, '');
  return upper.padStart(SERIAL_LENGTH, '0').slice(0, SERIAL_LENGTH);
}
