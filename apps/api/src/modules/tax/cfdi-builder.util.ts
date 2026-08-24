import { createSign, randomUUID } from 'node:crypto';

import {
  CFDI_PAYMENT_FORMS,
  CFDI_PAYMENT_METHODS,
  GENERIC_RFC_FISICA,
  GENERIC_RFC_MORAL,
  satUnitForKey,
} from '@aptifum/core';

import { certificateBase64 } from './certificate.util';
import type { DemoCertificate } from './certificate.util';

export interface CfdiInvoiceInput {
  number: string;
  type: 'invoice' | 'credit_note';
  currency: string;
  exchangeRate: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  issueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
    discount?: number;
    sku?: string | null;
    uom?: string | null;
  }>;
}

export interface CfdiTenantInput {
  name: string;
  rfc: string;
  fiscalRegime: string | null;
  fiscalAddress: { zip?: string } | null;
}

export interface CfdiCustomerInput {
  name: string;
  rfc: string;
  usoCfdi: string | null;
  regimenFiscal: string | null;
}

export interface CfdiBuilderOptions {
  paymentForm?: string;
  paymentMethod?: string;
  issuedAt?: Date;
}

export interface BuiltCfdi {
  uuid: string;
  serie: string | null;
  folio: string | null;
  xml: string;
  cadenaOriginal: string;
  sello: string;
  certNumber: string;
  certNumberSat: string;
  rfcProvCertif: string;
  fechaTimbrado: string;
  stampedAt: string;
}

const CFDI_NAMESPACE = 'http://www.sat.gob.mx/cfd/4';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd';

const SAT_SCHEMA_LOCATION =
  'http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd';

export function buildCfdi(
  invoice: CfdiInvoiceInput,
  tenant: CfdiTenantInput,
  customer: CfdiCustomerInput,
  emisorCert: DemoCertificate,
  pacCert: DemoCertificate,
  options: CfdiBuilderOptions = {},
): BuiltCfdi {
  const { serie, folio } = splitDocumentNumber(invoice.number);
  const issuedAt = options.issuedAt ?? new Date();
  const fecha = toSatDate(issuedAt);
  const uuid = randomUUID().toUpperCase();
  const exportacion = '01';
  const currency = invoice.currency || 'MXN';
  const exchangeRate = currency === 'MXN' ? 1 : invoice.exchangeRate || 1;
  const paymentForm = options.paymentForm ?? '99';
  const paymentMethod = options.paymentMethod ?? 'PUE';
  if (!CFDI_PAYMENT_FORMS[paymentForm]) {
    throw new Error(`Invalid CFDI payment form: ${paymentForm}`);
  }
  if (!CFDI_PAYMENT_METHODS[paymentMethod]) {
    throw new Error(`Invalid CFDI payment method: ${paymentMethod}`);
  }

  const emitterRfc = tenant.rfc || GENERIC_RFC_MORAL;
  const emitterRegime = tenant.fiscalRegime ?? '601';
  const placeOfExpedition = tenant.fiscalAddress?.zip ?? '00000';
  const receiverRfc = customer.rfc || GENERIC_RFC_FISICA;
  const receiverUso = customer.usoCfdi ?? 'G03';
  const isGenericRfc = receiverRfc === GENERIC_RFC_FISICA || receiverRfc === GENERIC_RFC_MORAL;
  const receiverRegime = isGenericRfc ? null : (customer.regimenFiscal ?? '616');

  const conceptoNodes = invoice.items.map((item) => {
    const importe = round2(item.unitPrice * item.quantity);
    const discount = round2(item.discount ?? 0);
    return `  <cfdi:Concepto ClaveProdServ="01010101"${skuAttr(item.sku)} Cantidad="${fmtQty(item.quantity)}" ClaveUnidad="${satUnitForKey(item.uom)}" Descripcion="${xmlEscape(item.description)}" ValorUnitario="${fmtAmount(item.unitPrice)}" Importe="${fmtAmount(importe)}"${discount > 0 ? ` Descuento="${fmtAmount(discount)}"` : ''}/>`;
  });

  const conceptos = `  <cfdi:Conceptos>\n${conceptoNodes.join('\n')}\n  </cfdi:Conceptos>`;

  const impuestos = buildImpuestosNode(invoice.items, invoice.tax);

  const certificado = certificateBase64(emisorCert.certificatePem);

  const baseAttributes: Record<string, string | null> = {
    Version: '4.0',
    Serie: serie,
    Folio: folio,
    Fecha: fecha,
    Sello: '',
    FormaPago: paymentForm,
    NoCertificado: emisorCert.serialNumber,
    Certificado: certificado,
    SubTotal: fmtAmount(invoice.subtotal),
    Descuento: invoice.discount > 0 ? fmtAmount(invoice.discount) : null,
    Moneda: currency,
    TipoCambio: exchangeRate !== 1 ? fmtExchangeRate(exchangeRate) : null,
    Total: fmtAmount(invoice.total),
    TipoDeComprobante: invoice.type === 'credit_note' ? 'E' : 'I',
    Exportacion: exportacion,
    MetodoPago: paymentMethod,
    LugarExpedicion: placeOfExpedition,
    Confirmacion: null,
  };

  const cadenaOriginal = buildCadena([
    baseAttributes.Version,
    baseAttributes.Serie,
    baseAttributes.Folio,
    baseAttributes.Fecha,
    baseAttributes.Sello,
    baseAttributes.FormaPago,
    baseAttributes.NoCertificado,
    baseAttributes.Certificado,
    baseAttributes.SubTotal,
    baseAttributes.Descuento,
    baseAttributes.Moneda,
    baseAttributes.TipoCambio,
    baseAttributes.Total,
    baseAttributes.TipoDeComprobante,
    baseAttributes.Exportacion,
    baseAttributes.MetodoPago,
    baseAttributes.LugarExpedicion,
    baseAttributes.Confirmacion,
  ]);

  const sello = signCadena(cadenaOriginal, emisorCert.privateKeyPem);

  const fechaTimbrado = toSatDate(issuedAt);
  const tfdCadena = buildTfdCadena({
    version: '1.1',
    uuid,
    fechaTimbrado,
    rfcProvCertif: pacCert.rfc,
    selloCfd: sello,
    noCertificadoSat: pacCert.serialNumber,
    selloSat: '',
  });

  const selloSat = signCadena(tfdCadena, pacCert.privateKeyPem);

  const tfdNode = buildTfdNode({
    version: '1.1',
    uuid,
    fechaTimbrado,
    rfcProvCertif: pacCert.rfc,
    selloCfd: sello,
    noCertificadoSat: pacCert.serialNumber,
    selloSat,
  });

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<cfdi:Comprobante xmlns:cfdi="${CFDI_NAMESPACE}" xmlns:xsi="${XSI_NAMESPACE}" xsi:schemaLocation="${SCHEMA_LOCATION}" ${attributesToString({ ...baseAttributes, Sello: sello })}>`,
    `  <cfdi:Emisor Rfc="${emitterRfc}" Nombre="${xmlEscape(trimName(tenant.name))}" RegimenFiscal="${emitterRegime}"/>`,
    `  <cfdi:Receptor Rfc="${receiverRfc}" Nombre="${xmlEscape(trimName(customer.name))}"${receiverRegime ? ` RegimenFiscalReceptor="${receiverRegime}"` : ''} UsoCFDI="${receiverUso}"/>`,
    conceptos,
    impuestos,
    `  <cfdi:Complemento>${tfdNode}</cfdi:Complemento>`,
    `</cfdi:Comprobante>`,
  ].join('\n');

  return {
    uuid,
    serie,
    folio,
    xml,
    cadenaOriginal,
    sello,
    certNumber: emisorCert.serialNumber,
    certNumberSat: pacCert.serialNumber,
    rfcProvCertif: pacCert.rfc,
    fechaTimbrado,
    stampedAt: fechaTimbrado,
  };
}

function splitDocumentNumber(number: string): { serie: string | null; folio: string | null } {
  const match = /^([A-Za-z0-9]+)-(\d+)$/.exec(number ?? '');
  if (!match) {
    return { serie: null, folio: number ?? null };
  }
  return { serie: match[1], folio: match[2] };
}

function buildImpuestosNode(items: CfdiInvoiceInput['items'], taxTotal: number): string {
  const byRate = new Map<number, { base: number; importe: number }>();
  for (const item of items) {
    if (!item.taxRate) {
      continue;
    }
    const base = round2(item.quantity * item.unitPrice);
    const current = byRate.get(item.taxRate) ?? { base: 0, importe: 0 };
    current.base = round2(current.base + base);
    current.importe = round2(current.importe + item.taxAmount);
    byRate.set(item.taxRate, current);
  }
  if (byRate.size === 0) {
    return '';
  }
  const traslados = [...byRate.entries()]
    .map(([rate, { base, importe }]) => {
      return `  <cfdi:Traslado Base="${fmtAmount(base)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="${fmtRate(rate)}" Importe="${fmtAmount(importe)}"/>`;
    })
    .join('\n');
  return `  <cfdi:Impuestos TotalImpuestosTrasladados="${fmtAmount(taxTotal)}">\n${traslados}\n  </cfdi:Impuestos>`;
}

function buildTfdNode(tfd: {
  version: string;
  uuid: string;
  fechaTimbrado: string;
  rfcProvCertif: string;
  selloCfd: string;
  noCertificadoSat: string;
  selloSat: string;
}): string {
  return `<tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" xsi:schemaLocation="${SAT_SCHEMA_LOCATION}" Version="${tfd.version}" UUID="${tfd.uuid}" FechaTimbrado="${tfd.fechaTimbrado}" RfcProvCertif="${tfd.rfcProvCertif}" SelloCFD="${tfd.selloCfd}" NoCertificadoSAT="${tfd.noCertificadoSat}" SelloSAT="${tfd.selloSat}"/>`;
}

function buildTfdCadena(tfd: {
  version: string;
  uuid: string;
  fechaTimbrado: string;
  rfcProvCertif: string;
  selloCfd: string;
  noCertificadoSat: string;
  selloSat: string;
}): string {
  return buildCadena(
    [tfd.version, tfd.uuid, tfd.fechaTimbrado, tfd.rfcProvCertif, tfd.selloCfd, tfd.noCertificadoSat, tfd.selloSat],
    true,
  );
}

function buildCadena(attributes: Array<string | null>, doubleBars = false): string {
  const joined = attributes.map((value) => (value === null || value === undefined ? '' : cadenaClean(value))).join('|');
  return doubleBars ? `||${joined}||` : `${joined}|`;
}

function cadenaClean(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '||')
    .replace(/[\r\n\t]/g, '');
}

function signCadena(cadena: string, privateKeyPem: string): string {
  const signer = createSign('RSA-SHA256');
  signer.update(cadena, 'utf8');
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

function attributesToString(attributes: Record<string, string | null>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}="${xmlEscape(value as string)}"`)
    .join(' ');
}

function xmlEscape(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function skuAttr(sku: string | null | undefined): string {
  return sku ? ` NoIdentificacion="${xmlEscape(sku)}"` : '';
}

function trimName(name: string): string {
  return (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 254);
}

function toSatDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fmtAmount(value: number): string {
  return (value ?? 0).toFixed(2);
}

function fmtQty(value: number): string {
  return Number(value ?? 0).toFixed(4);
}

function fmtExchangeRate(value: number): string {
  return Number(value ?? 1).toFixed(4);
}

function fmtRate(value: number): string {
  return Number(value ?? 0).toFixed(4);
}
