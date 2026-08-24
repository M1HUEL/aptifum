import { createPublicKey, verify } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { generateDemoCertificate } from '../src/modules/tax/certificate.util.js';
import { buildCfdi, CfdiInvoiceInput } from '../src/modules/tax/cfdi-builder.util.js';

const invoice: CfdiInvoiceInput = {
  number: 'INV-000001',
  type: 'invoice',
  currency: 'MXN',
  exchangeRate: 1,
  subtotal: 100,
  discount: 0,
  tax: 16,
  total: 116,
  issueDate: '2026-08-11',
  items: [
    {
      description: 'Consulting services',
      quantity: 1,
      unitPrice: 100,
      taxRate: 0.16,
      taxAmount: 16,
      lineTotal: 116,
      sku: 'SRV-001',
      uom: 'service',
    },
  ],
};

const tenant = {
  name: 'Aptifum MX SA de CV',
  rfc: 'XND160713M46',
  fiscalRegime: '601',
  fiscalAddress: { zip: '06600' },
};

const customer = {
  name: 'Cliente Demo SA',
  rfc: 'CND070823MTA',
  usoCfdi: 'G03',
  regimenFiscal: '601',
};

let emisorCert: Awaited<ReturnType<typeof generateDemoCertificate>>;
let pacCert: Awaited<ReturnType<typeof generateDemoCertificate>>;

beforeAll(async () => {
  emisorCert = await generateDemoCertificate({ rfc: 'XND160713M46', name: 'Aptifum MX SA de CV' });
  pacCert = await generateDemoCertificate({ rfc: 'XND000000000', name: 'Aptifum Demo PAC' });
});

describe('buildCfdi', () => {
  it('produces a CFDI 4.0 XML with sello and TFD', () => {
    const built = buildCfdi(invoice, tenant, customer, emisorCert, pacCert, {
      paymentForm: '99',
      paymentMethod: 'PUE',
    });

    expect(built.uuid).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i);
    expect(built.serie).toBe('INV');
    expect(built.folio).toBe('000001');
    expect(built.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(built.xml).toContain('<cfdi:Comprobante');
    expect(built.xml).toContain('Version="4.0"');
    expect(built.xml).toContain('TipoDeComprobante="I"');
    expect(built.xml).toContain('MetodoPago="PUE"');
    expect(built.xml).toContain('FormaPago="99"');
    expect(built.xml).toContain(`Sello="${built.sello}"`);
    expect(built.xml).toContain('<cfdi:Emisor Rfc="XND160713M46"');
    expect(built.xml).toContain('<cfdi:Receptor Rfc="CND070823MTA"');
    expect(built.xml).toContain('UsoCFDI="G03"');
    expect(built.xml).toContain('ClaveProdServ="01010101"');
    expect(built.xml).toContain('ClaveUnidad="E48"');
    expect(built.xml).toContain('<cfdi:Impuestos TotalImpuestosTrasladados="16.00"');
    expect(built.xml).toContain('Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.1600" Importe="16.00"');
    expect(built.xml).toContain('<tfd:TimbreFiscalDigital');
    expect(built.xml).toContain(`UUID="${built.uuid}"`);
    expect(built.xml).toContain('RfcProvCertif="XND000000000"');
    expect(built.xml).toContain('NoCertificadoSAT="');
    const selloSatMatch = built.xml.match(/SelloSAT="([^"]+)"/);
    expect(selloSatMatch).not.toBeNull();
    expect(selloSatMatch![1]!.length).toBeGreaterThan(50);
    expect(selloSatMatch![1]).not.toBe(built.sello);
  });

  it('builds the cadena original in CFDI 4.0 attribute order', () => {
    const built = buildCfdi(invoice, tenant, customer, emisorCert, pacCert);
    const certBase64 = emisorCert.certificatePem.replace(/-----(BEGIN|END) [^-]*-----/g, '').replace(/\s+/g, '');
    const expected =
      [
        '4.0',
        'INV',
        '000001',
        built.xml.match(/Fecha="([^"]+)"/)?.[1] ?? '',
        '',
        '99',
        emisorCert.serialNumber,
        certBase64,
        '100.00',
        '',
        'MXN',
        '',
        '116.00',
        'I',
        '01',
        'PUE',
        '06600',
        '',
      ].join('|') + '|';
    expect(built.cadenaOriginal).toBe(expected);
  });

  it('produces a verifiable Sello over the cadena original', () => {
    const built = buildCfdi(invoice, tenant, customer, emisorCert, pacCert);
    const verifier = verify(
      'RSA-SHA256',
      Buffer.from(built.cadenaOriginal, 'utf8'),
      createPublicKey(emisorCert.certificatePem),
      Buffer.from(built.sello, 'base64'),
    );
    expect(verifier).toBe(true);
  });

  it('uses TipoDeComprobante E for credit notes', () => {
    const built = buildCfdi(
      { ...invoice, type: 'credit_note', number: 'NC-000001' },
      tenant,
      customer,
      emisorCert,
      pacCert,
    );
    expect(built.serie).toBe('NC');
    expect(built.xml).toContain('TipoDeComprobante="E"');
  });

  it('omits Descuento and TipoCambio when not applicable', () => {
    const built = buildCfdi(invoice, tenant, customer, emisorCert, pacCert);
    expect(built.cadenaOriginal).not.toContain('|0.00|');
  });

  it('includes exchange rate when currency is not MXN', () => {
    const built = buildCfdi({ ...invoice, currency: 'USD', exchangeRate: 17.5 }, tenant, customer, emisorCert, pacCert);
    expect(built.xml).toContain('Moneda="USD"');
    expect(built.xml).toContain('TipoCambio="17.5000"');
  });

  it('falls back to generic RFCs when missing', () => {
    const built = buildCfdi(invoice, { ...tenant, rfc: '' }, { ...customer, rfc: '' }, emisorCert, pacCert);
    expect(built.xml).toContain('Rfc="XEXX010101000"');
    expect(built.xml).toContain('Rfc="XAXX010101000"');
    expect(built.xml).toContain('UsoCFDI="G03"');
  });
});
