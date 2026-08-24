import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThanOrEqual, Repository } from 'typeorm';

import { ExchangeRate } from '@aptifum/database';

import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';

@Injectable()
export class ExchangeRatesService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly ratesRepo: Repository<ExchangeRate>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<ExchangeRate> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, opts: { base?: string; quote?: string } = {}) {
    const where: FindOptionsWhere<ExchangeRate> = this.scoped(tenantId);
    if (opts.base) where.baseCurrency = opts.base;
    if (opts.quote) where.quoteCurrency = opts.quote;
    const [rows, total] = await this.ratesRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { rateDate: 'DESC', createdAt: 'DESC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async latest(tenantId: string | null, base: string, quote: string, date?: string): Promise<ExchangeRate | null> {
    const where: FindOptionsWhere<ExchangeRate> = {
      tenantId: tenantId ?? undefined,
      baseCurrency: base,
      quoteCurrency: quote,
      ...(date ? { rateDate: LessThanOrEqual(date) } : {}),
    };
    return this.ratesRepo.findOne({ where, order: { rateDate: 'DESC', createdAt: 'DESC' } });
  }

  async create(tenantId: string | null, dto: CreateExchangeRateDto) {
    this.assertTenant(tenantId);
    if (dto.baseCurrency === dto.quoteCurrency) {
      throw new BadRequestException('Base and quote currency must differ');
    }
    const existing = await this.ratesRepo.findOneBy({
      tenantId,
      baseCurrency: dto.baseCurrency,
      quoteCurrency: dto.quoteCurrency,
      rateDate: dto.rateDate ?? this.today(),
    });
    if (existing) {
      throw new ConflictException('An exchange rate already exists for this pair and date');
    }
    return this.ratesRepo.save(this.ratesRepo.create({ tenantId, ...dto, rateDate: dto.rateDate ?? this.today() }));
  }

  async remove(tenantId: string | null, id: string) {
    await this.ratesRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  async resolveRate(tenantId: string, base: string, quote: string, date: string): Promise<number> {
    if (base === quote) {
      return 1;
    }
    const rate = await this.latest(tenantId, base, quote, date);
    if (!rate) {
      throw new BadRequestException(`No exchange rate for ${quote} on ${date}`);
    }
    return rate.rate;
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
