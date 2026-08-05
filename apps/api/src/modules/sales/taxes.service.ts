import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Tax } from '@aptifum/database';
import { TaxKind } from '@aptifum/core';
import { CreateTaxDto } from './dto/create-tax.dto';

@Injectable()
export class TaxesService {
  constructor(@InjectRepository(Tax) private readonly taxesRepo: Repository<Tax>) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Tax> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null) {
    return this.taxesRepo.find({ where: this.scoped(tenantId), order: { name: 'ASC' } });
  }

  async create(tenantId: string | null, dto: CreateTaxDto) {
    this.assertTenant(tenantId);
    return this.taxesRepo.save(
      this.taxesRepo.create({
        tenantId: tenantId as string,
        name: dto.name,
        rate: dto.rate,
        kind: dto.kind ?? TaxKind.SALES,
        active: dto.active ?? true,
      }),
    );
  }

  async remove(tenantId: string | null, id: string) {
    const tax = await this.taxesRepo.findOne({ where: { id, ...this.scoped(tenantId) } });
    if (!tax) {
      throw new NotFoundException('Tax not found');
    }
    tax.active = false;
    await this.taxesRepo.save(tax);
    return { id };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
