import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { DocumentSeries } from '@aptifum/database';

import { CreateSeriesDto } from './dto/create-series.dto.js';

@Injectable()
export class DocumentSeriesService {
  constructor(
    @InjectRepository(DocumentSeries)
    private readonly seriesRepo: Repository<DocumentSeries>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<DocumentSeries> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null) {
    return this.seriesRepo.find({ where: this.scoped(tenantId), order: { kind: 'ASC' } });
  }

  async create(tenantId: string | null, dto: CreateSeriesDto) {
    this.assertTenant(tenantId);
    const existing = await this.seriesRepo.findOneBy({
      tenantId: tenantId as string,
      kind: dto.kind,
    });
    if (existing) {
      throw new BadRequestException(`A series for ${dto.kind} already exists`);
    }
    return this.seriesRepo.save(
      this.seriesRepo.create({
        tenantId: tenantId as string,
        kind: dto.kind,
        prefix: dto.prefix,
        nextNumber: dto.nextNumber ?? 1,
        active: dto.active ?? true,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: CreateSeriesDto) {
    const series = await this.seriesRepo.findOne({ where: { id, ...this.scoped(tenantId) } });
    if (!series) {
      throw new NotFoundException('Document series not found');
    }
    series.prefix = dto.prefix;
    series.active = dto.active ?? series.active;
    if (dto.nextNumber !== undefined) {
      series.nextNumber = dto.nextNumber;
    }
    return this.seriesRepo.save(series);
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
