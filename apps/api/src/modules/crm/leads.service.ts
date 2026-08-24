import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { DocumentSeriesKind, LeadStatus } from '@aptifum/core';
import { Customer, nextDocumentNumber as dbNextDocumentNumber, CrmLead } from '@aptifum/database';

import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(CrmLead) private readonly leadsRepo: Repository<CrmLead>,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<CrmLead> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, status?: string) {
    const where: FindOptionsWhere<CrmLead> = this.scoped(tenantId);
    if (status) {
      where.status = status as LeadStatus;
    }
    const [rows, total] = await this.leadsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { convertedCustomer: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const lead = await this.leadsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { convertedCustomer: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async create(tenantId: string | null, dto: CreateLeadDto) {
    this.assertTenant(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const { number } = await dbNextDocumentNumber(manager, tenantId as string, DocumentSeriesKind.LEAD);
      const lead = manager.getRepository(CrmLead).create({
        tenantId: tenantId as string,
        number,
        source: dto.source ?? null,
        companyName: dto.companyName ?? null,
        contactName: dto.contactName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        status: dto.status ?? LeadStatus.NEW,
        estimatedAmount: dto.estimatedAmount ?? 0,
        currency: dto.currency ?? 'USD',
        assignedUserId: dto.assignedUserId ?? null,
        notes: dto.notes ?? null,
      });
      return manager.getRepository(CrmLead).save(lead);
    });
  }

  async update(tenantId: string | null, id: string, dto: UpdateLeadDto) {
    const lead = await this.findOne(tenantId, id);
    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Converted leads cannot be edited');
    }
    Object.assign(lead, {
      source: dto.source === undefined ? lead.source : dto.source,
      companyName: dto.companyName === undefined ? lead.companyName : dto.companyName,
      contactName: dto.contactName ?? lead.contactName,
      email: dto.email === undefined ? lead.email : dto.email,
      phone: dto.phone === undefined ? lead.phone : dto.phone,
      status: dto.status ?? lead.status,
      estimatedAmount: dto.estimatedAmount ?? lead.estimatedAmount,
      currency: dto.currency ?? lead.currency,
      assignedUserId: dto.assignedUserId === undefined ? lead.assignedUserId : dto.assignedUserId,
      notes: dto.notes === undefined ? lead.notes : dto.notes,
    });
    return this.leadsRepo.save(lead);
  }

  async remove(tenantId: string | null, id: string) {
    const lead = await this.findOne(tenantId, id);
    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Converted leads cannot be deleted');
    }
    await this.leadsRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  async convert(tenantId: string | null, id: string, opts: { customerCode?: string }) {
    this.assertTenant(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const leadsRepo = manager.getRepository(CrmLead);
      const lead = await leadsRepo.findOne({ where: { id, tenantId } });
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }
      if (lead.status === LeadStatus.CONVERTED) {
        throw new BadRequestException('Lead is already converted');
      }
      if (lead.status === LeadStatus.DISQUALIFIED) {
        throw new BadRequestException('Disqualified leads cannot be converted');
      }
      const customersRepo = manager.getRepository(Customer);
      const code = opts.customerCode ?? `CUST-${lead.number.slice(-6)}`;
      const customer = await customersRepo.save(
        customersRepo.create({
          tenantId,
          code,
          tradeName: lead.companyName ?? lead.contactName,
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          currency: lead.currency,
        }),
      );
      lead.status = LeadStatus.CONVERTED;
      lead.convertedCustomerId = customer.id;
      await leadsRepo.save(lead);
      return leadsRepo.findOne({
        where: { id, tenantId },
        relations: { convertedCustomer: true },
      });
    });
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
