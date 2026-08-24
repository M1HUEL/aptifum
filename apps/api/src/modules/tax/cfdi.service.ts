import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { CfdiStatus } from '@aptifum/core';
import { CfdiCertificate, CfdiDocument, Customer, Invoice, InvoiceItem, OutboxEvent, Tenant } from '@aptifum/database';

import { DemoCertificate, generateDemoCertificate } from './certificate.util';
import { buildCfdi, CfdiInvoiceInput } from './cfdi-builder.util';
import type { UpdateCfdiSettingsDto } from './dto/update-cfdi-settings.dto';

export const DEMO_PAC_RFC = 'XND000000000';
const DEMO_PAC_NAME = 'Aptifum Demo PAC';

export interface CfdiSettings {
  enabled: boolean;
  paymentForm: string;
  paymentMethod: string;
  placeOfExpedition: string;
}

const DEFAULT_SETTINGS: CfdiSettings = {
  enabled: true,
  paymentForm: '99',
  paymentMethod: 'PUE',
  placeOfExpedition: '00000',
};

@Injectable()
export class CfdiService {
  private readonly logger = new Logger(CfdiService.name);

  constructor(
    @InjectRepository(CfdiDocument) private readonly cfdiRepo: Repository<CfdiDocument>,
    @InjectRepository(CfdiCertificate)
    private readonly certRepo: Repository<CfdiCertificate>,
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private readonly itemsRepo: Repository<InvoiceItem>,
    @InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (event.eventType !== 'invoice.issued' && event.eventType !== 'credit_note.issued') {
      return;
    }
    const invoiceId = (event.payload.invoiceId as string | undefined) ?? event.aggregateId;
    try {
      await this.generateForInvoice(event.tenantId, invoiceId, event.userId);
    } catch (error) {
      this.logger.error(
        `Failed to generate CFDI for invoice ${invoiceId} (tenant ${event.tenantId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async generateForInvoice(tenantId: string, invoiceId: string, _userId?: string | null) {
    const tenant = await this.tenantsRepo.findOneBy({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (tenant.country !== 'MX') {
      return null;
    }
    const settings = this.readSettings(tenant);
    if (!settings.enabled) {
      return null;
    }
    const existing = await this.cfdiRepo.findOneBy({ tenantId, invoiceId });
    if (existing) {
      return existing;
    }
    const invoice = await this.invoicesRepo.findOne({
      where: { id: invoiceId, tenantId },
      relations: { items: { product: true } },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const customer = await this.customersRepo.findOneBy({
      id: invoice.customerId,
      tenantId,
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const [emisorCert, pacCert] = await this.ensureCertificates(tenant);

    const built = buildCfdi(
      this.toInvoiceInput(invoice),
      {
        name: tenant.name,
        rfc: tenant.taxId ?? '',
        fiscalRegime: tenant.fiscalRegime,
        fiscalAddress: tenant.fiscalAddress,
      },
      {
        name: customer.legalName ?? customer.tradeName ?? 'Receptor',
        rfc: customer.taxId ?? '',
        usoCfdi: customer.usoCfdi,
        regimenFiscal: customer.regimenFiscal,
      },
      emisorCert,
      pacCert,
      { paymentForm: settings.paymentForm, paymentMethod: settings.paymentMethod },
    );

    const record = this.cfdiRepo.create({
      tenantId,
      invoiceId,
      uuid: built.uuid,
      serie: built.serie,
      folio: built.folio,
      version: '4.0',
      type: invoice.type === 'credit_note' ? 'E' : 'I',
      status: CfdiStatus.STAMPED,
      emitterRfc: tenant.taxId ?? '',
      emitterName: tenant.name,
      emitterRegime: tenant.fiscalRegime ?? '601',
      receiverRfc: customer.taxId ?? '',
      receiverName: customer.legalName ?? customer.tradeName ?? 'Receptor',
      receiverUso: customer.usoCfdi ?? 'G03',
      paymentForm: settings.paymentForm,
      paymentMethod: settings.paymentMethod,
      exportacion: '01',
      placeOfExpedition: settings.placeOfExpedition,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
      xml: built.xml,
      cadenaOriginal: built.cadenaOriginal,
      sello: built.sello,
      certNumber: built.certNumber,
      rfcProvCertif: built.rfcProvCertif,
      certSatNumber: built.certNumberSat,
      stampedAt: new Date().toISOString(),
    });
    try {
      return await this.cfdiRepo.save(record);
    } catch (error) {
      const race = await this.cfdiRepo.findOneBy({ tenantId, invoiceId });
      if (race) {
        return race;
      }
      throw error;
    }
  }

  async list(tenantId: string | null, page: number, limit: number, status?: CfdiStatus) {
    const where: FindOptionsWhere<CfdiDocument> = tenantId ? { tenantId } : {};
    if (status) {
      where.status = status;
    }
    const [rows, total] = await this.cfdiRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const cfdi = await this.cfdiRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!cfdi) {
      throw new NotFoundException('CFDI not found');
    }
    return cfdi;
  }

  async getByInvoice(tenantId: string | null, invoiceId: string) {
    const cfdi = await this.cfdiRepo.findOne({
      where: { invoiceId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!cfdi) {
      throw new NotFoundException('CFDI not found for invoice');
    }
    return cfdi;
  }

  async getXml(tenantId: string | null, id: string) {
    const cfdi = await this.findOne(tenantId, id);
    return {
      id: cfdi.id,
      number: cfdi.serie && cfdi.folio ? `${cfdi.serie}-${cfdi.folio}` : cfdi.uuid,
      uuid: cfdi.uuid,
      xml: cfdi.xml,
    };
  }

  async cancel(tenantId: string | null, userId: string | null, id: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    const cfdi = await this.findOne(tenantId, id);
    if (cfdi.status === CfdiStatus.CANCELLED) {
      return cfdi;
    }
    cfdi.status = CfdiStatus.CANCELLED;
    cfdi.cancelledAt = new Date().toISOString();
    return this.cfdiRepo.save(cfdi);
  }

  async settings(tenantId: string | null) {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    const tenant = await this.tenantsRepo.findOneBy({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return {
      ...DEFAULT_SETTINGS,
      ...this.readSettings(tenant),
      rfc: tenant.taxId ?? null,
      regime: tenant.fiscalRegime ?? '601',
      country: tenant.country,
    };
  }

  async updateSettings(tenantId: string | null, dto: UpdateCfdiSettingsDto) {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    const tenant = await this.tenantsRepo.findOneBy({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const current = this.readSettings(tenant);
    const merged: CfdiSettings = {
      ...current,
      enabled: dto.enabled ?? current.enabled,
      paymentForm: dto.paymentForm ?? current.paymentForm,
      paymentMethod: dto.paymentMethod ?? current.paymentMethod,
      placeOfExpedition: dto.placeOfExpedition ?? current.placeOfExpedition,
    };
    tenant.config = { ...tenant.config, cfdi: merged };
    await this.tenantsRepo.save(tenant);
    return this.settings(tenantId);
  }

  private async ensureCertificates(tenant: Tenant): Promise<[DemoCertificate, DemoCertificate]> {
    const rfc = tenant.taxId ?? '';
    const emisor = await this.loadOrCreateCert(tenant.id, 'emisor', rfc, tenant.name);
    const pac = await this.loadOrCreateCert(tenant.id, 'pac', DEMO_PAC_RFC, DEMO_PAC_NAME);
    return [toDemo(emisor), toDemo(pac)];
  }

  private async loadOrCreateCert(tenantId: string, kind: string, rfc: string, name: string): Promise<CfdiCertificate> {
    const existing = await this.certRepo.findOneBy({ tenantId, kind, active: true });
    if (existing) {
      return existing;
    }
    const generated = await generateDemoCertificate({ rfc, name });
    const saved = await this.certRepo.save(
      this.certRepo.create({
        tenantId,
        kind,
        rfc,
        name,
        serialNumber: generated.serialNumber,
        validFrom: generated.validFrom,
        validTo: generated.validTo,
        certificatePem: generated.certificatePem,
        privateKeyPem: generated.privateKeyPem,
        active: true,
      }),
    );
    return saved;
  }

  private readSettings(tenant: Tenant): CfdiSettings {
    const stored = (tenant.config?.cfdi ?? {}) as Partial<CfdiSettings>;
    return {
      enabled: stored.enabled ?? DEFAULT_SETTINGS.enabled,
      paymentForm: stored.paymentForm ?? DEFAULT_SETTINGS.paymentForm,
      paymentMethod: stored.paymentMethod ?? DEFAULT_SETTINGS.paymentMethod,
      placeOfExpedition: stored.placeOfExpedition ?? tenant.fiscalAddress?.zip ?? DEFAULT_SETTINGS.placeOfExpedition,
    };
  }

  private toInvoiceInput(invoice: Invoice): CfdiInvoiceInput {
    const items = (invoice.items ?? []).map(
      (item: InvoiceItem & { product?: { sku?: string; unitOfMeasure?: string } }) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
        sku: item.product?.sku ?? null,
        uom: item.product?.unitOfMeasure ?? null,
      }),
    );
    return {
      number: invoice.number,
      type: invoice.type,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
      issueDate: invoice.issueDate,
      items,
    };
  }
}

function toDemo(cert: CfdiCertificate): DemoCertificate {
  return {
    certificatePem: cert.certificatePem,
    privateKeyPem: cert.privateKeyPem,
    serialNumber: cert.serialNumber,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    rfc: cert.rfc,
    name: cert.name,
  };
}
