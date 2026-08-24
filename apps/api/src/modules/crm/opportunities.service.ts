import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { OpportunityStage } from '@aptifum/core';
import { CrmLead, CrmOpportunity, Customer } from '@aptifum/database';

import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectRepository(CrmOpportunity)
    private readonly opportunitiesRepo: Repository<CrmOpportunity>,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectRepository(CrmLead) private readonly leadsRepo: Repository<CrmLead>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<CrmOpportunity> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, stage?: string) {
    const where: FindOptionsWhere<CrmOpportunity> = this.scoped(tenantId);
    if (stage) {
      where.stage = stage as OpportunityStage;
    }
    const [rows, total] = await this.opportunitiesRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { customer: true, lead: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const opportunity = await this.opportunitiesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { customer: true, lead: true },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    return opportunity;
  }

  async create(tenantId: string | null, dto: CreateOpportunityDto) {
    this.assertTenant(tenantId);
    if (dto.customerId) {
      await this.ensureCustomer(tenantId, dto.customerId);
    }
    if (dto.leadId) {
      await this.ensureLead(tenantId, dto.leadId);
    }
    return this.opportunitiesRepo.save(
      this.opportunitiesRepo.create({
        tenantId: tenantId as string,
        name: dto.name,
        customerId: dto.customerId ?? null,
        leadId: dto.leadId ?? null,
        stage: dto.stage ?? OpportunityStage.PROSPECTING,
        amount: dto.amount ?? 0,
        currency: dto.currency ?? 'USD',
        probability: dto.probability ?? 0,
        expectedCloseDate: dto.expectedCloseDate ?? null,
        assignedUserId: dto.assignedUserId ?? null,
        notes: dto.notes ?? null,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateOpportunityDto) {
    const opportunity = await this.findOne(tenantId, id);
    if (opportunity.stage === OpportunityStage.WON || opportunity.stage === OpportunityStage.LOST) {
      throw new BadRequestException('Won or lost opportunities cannot be edited');
    }
    if (dto.customerId) {
      await this.ensureCustomer(tenantId as string, dto.customerId);
    }
    if (dto.leadId) {
      await this.ensureLead(tenantId as string, dto.leadId);
    }
    Object.assign(opportunity, {
      name: dto.name ?? opportunity.name,
      customerId: dto.customerId === undefined ? opportunity.customerId : dto.customerId,
      leadId: dto.leadId === undefined ? opportunity.leadId : dto.leadId,
      stage: dto.stage ?? opportunity.stage,
      amount: dto.amount ?? opportunity.amount,
      currency: dto.currency ?? opportunity.currency,
      probability: dto.probability ?? opportunity.probability,
      expectedCloseDate: dto.expectedCloseDate === undefined ? opportunity.expectedCloseDate : dto.expectedCloseDate,
      assignedUserId: dto.assignedUserId === undefined ? opportunity.assignedUserId : dto.assignedUserId,
      notes: dto.notes === undefined ? opportunity.notes : dto.notes,
    });
    return this.opportunitiesRepo.save(opportunity);
  }

  async markWon(tenantId: string | null, id: string) {
    const opportunity = await this.findOne(tenantId, id);
    if (opportunity.stage === OpportunityStage.WON) {
      throw new BadRequestException('Opportunity is already won');
    }
    if (opportunity.stage === OpportunityStage.LOST) {
      throw new BadRequestException('Lost opportunities cannot be reopened as won');
    }
    this.assertTenant(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const opportunitiesRepo = manager.getRepository(CrmOpportunity);
      const opp = await opportunitiesRepo.findOne({
        where: { id, tenantId },
        relations: { lead: true, customer: true },
      });
      if (!opp) {
        throw new NotFoundException('Opportunity not found');
      }
      if (!opp.customerId && opp.lead) {
        const customersRepo = manager.getRepository(Customer);
        const customer = await customersRepo.save(
          customersRepo.create({
            tenantId,
            code: `CUST-${opp.lead.number.slice(-6)}`,
            tradeName: opp.lead.companyName ?? opp.lead.contactName,
            email: opp.lead.email ?? null,
            phone: opp.lead.phone ?? null,
            currency: opp.lead.currency,
          }),
        );
        opp.customerId = customer.id;
        opp.customer = customer;
      }
      opp.stage = OpportunityStage.WON;
      opp.probability = 100;
      opp.wonAt = new Date();
      opp.lostAt = null;
      await opportunitiesRepo.save(opp);
      return opportunitiesRepo.findOne({
        where: { id, tenantId },
        relations: { lead: true, customer: true },
      });
    });
  }

  async markLost(tenantId: string | null, id: string) {
    const opportunity = await this.findOne(tenantId, id);
    if (opportunity.stage === OpportunityStage.LOST) {
      throw new BadRequestException('Opportunity is already lost');
    }
    if (opportunity.stage === OpportunityStage.WON) {
      throw new BadRequestException('Won opportunities cannot be reopened as lost');
    }
    opportunity.stage = OpportunityStage.LOST;
    opportunity.lostAt = new Date();
    opportunity.wonAt = null;
    return this.opportunitiesRepo.save(opportunity);
  }

  async remove(tenantId: string | null, id: string) {
    const opportunity = await this.findOne(tenantId, id);
    if (opportunity.stage === OpportunityStage.WON) {
      throw new BadRequestException('Won opportunities cannot be deleted');
    }
    await this.opportunitiesRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private async ensureCustomer(tenantId: string, customerId: string) {
    const customer = await this.customersRepo.findOneBy({ id: customerId, tenantId });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }

  private async ensureLead(tenantId: string, leadId: string) {
    const lead = await this.leadsRepo.findOneBy({ id: leadId, tenantId });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
