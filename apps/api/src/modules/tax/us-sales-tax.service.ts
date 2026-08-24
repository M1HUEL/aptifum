import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { resolveUsSalesTaxRate, US_STATES, UsSalesTaxConfig } from '@aptifum/core';
import { Tenant } from '@aptifum/database';

import type { UpdateUsSalesTaxDto } from './dto/update-us-sales-tax.dto.js';

export interface UsSalesTaxView {
  nexusStates: string[];
  rates: Record<string, number>;
}

@Injectable()
export class UsSalesTaxService {
  constructor(@InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>) {}

  async getConfig(tenantId: string | null): Promise<UsSalesTaxView & { country: string }> {
    const tenant = await this.requireTenant(tenantId);
    const config = this.read(tenant);
    return {
      nexusStates: config.nexusStates,
      rates: config.rates ?? {},
      country: tenant.country,
    };
  }

  async updateConfig(tenantId: string | null, dto: UpdateUsSalesTaxDto): Promise<UsSalesTaxView> {
    const tenant = await this.requireTenant(tenantId);
    const current = this.read(tenant);
    const nexusStates = this.normalizeStates(dto.nexusStates ?? current.nexusStates);
    const rates = dto.rates ? this.normalizeRates(dto.rates, nexusStates) : (current.rates ?? {});
    tenant.config = { ...tenant.config, usSalesTax: { nexusStates, rates } };
    await this.tenantsRepo.save(tenant);
    return { nexusStates, rates };
  }

  states() {
    return US_STATES;
  }

  async resolveRate(
    tenantId: string | null,
    customerState: string | null | undefined,
    taxExempt = false,
  ): Promise<number> {
    if (!tenantId) {
      return 0;
    }
    const tenant = await this.tenantsRepo.findOneBy({ id: tenantId });
    if (!tenant || tenant.country !== 'US') {
      return 0;
    }
    return resolveUsSalesTaxRate(this.read(tenant), customerState, taxExempt);
  }

  private read(tenant: Tenant): UsSalesTaxConfig {
    const stored = (tenant.config?.usSalesTax ?? {}) as Partial<UsSalesTaxConfig>;
    return {
      nexusStates: Array.isArray(stored.nexusStates) ? stored.nexusStates : [],
      rates: stored.rates ?? {},
    };
  }

  private async requireTenant(tenantId: string | null): Promise<Tenant> {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    const tenant = await this.tenantsRepo.findOneBy({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  private normalizeStates(states: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const state of states) {
      const code = state.trim().toUpperCase();
      if (!US_STATES[code]) {
        throw new BadRequestException(`Unknown US state: ${state}`);
      }
      if (!seen.has(code)) {
        seen.add(code);
        normalized.push(code);
      }
    }
    return normalized;
  }

  private normalizeRates(rates: Record<string, number>, nexusStates: string[]): Record<string, number> {
    const nexus = new Set(nexusStates.map((s) => s.toUpperCase()));
    const normalized: Record<string, number> = {};
    for (const [state, rate] of Object.entries(rates)) {
      const code = state.trim().toUpperCase();
      if (!US_STATES[code]) {
        throw new BadRequestException(`Unknown US state: ${state}`);
      }
      if (rate < 0 || rate > 0.5) {
        throw new BadRequestException(`Invalid rate for ${code}: expected 0..0.5`);
      }
      if (nexus.has(code)) {
        normalized[code] = Math.round(rate * 10000) / 10000;
      }
    }
    return normalized;
  }
}
