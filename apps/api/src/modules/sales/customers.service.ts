import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Customer, Tenant } from '@aptifum/database';
import { normalizeRfc, validateEin, validateRfc } from '@aptifum/core';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Customer> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, q?: string) {
    const where: FindOptionsWhere<Customer> = this.scoped(tenantId);
    if (q) {
      where.tradeName = ILike(`%${q}%`);
    }
    const [rows, total] = await this.customersRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { tradeName: 'ASC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const customer = await this.customersRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async create(tenantId: string | null, dto: CreateCustomerDto) {
    this.assertTenant(tenantId);
    const taxId = await this.normalizeTaxId(tenantId as string, dto.taxId);
    return this.customersRepo.save(
      this.customersRepo.create({
        tenantId: tenantId as string,
        code: dto.code,
        tradeName: dto.tradeName,
        legalName: dto.legalName ?? null,
        taxId,
        usoCfdi: dto.usoCfdi ?? null,
        regimenFiscal: dto.regimenFiscal ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        currency: dto.currency ?? 'USD',
        creditLimit: dto.creditLimit ?? 0,
        priceCategory: dto.priceCategory ?? null,
        state: dto.state ?? null,
        taxExempt: dto.taxExempt ?? false,
        active: dto.active ?? true,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(tenantId, id);
    const taxId =
      dto.taxId === undefined ? customer.taxId : await this.normalizeTaxId(tenantId, dto.taxId);
    Object.assign(customer, {
      code: dto.code ?? customer.code,
      tradeName: dto.tradeName ?? customer.tradeName,
      legalName: dto.legalName === undefined ? customer.legalName : dto.legalName,
      taxId,
      usoCfdi: dto.usoCfdi === undefined ? customer.usoCfdi : (dto.usoCfdi ?? null),
      regimenFiscal:
        dto.regimenFiscal === undefined ? customer.regimenFiscal : (dto.regimenFiscal ?? null),
      email: dto.email === undefined ? customer.email : dto.email,
      phone: dto.phone === undefined ? customer.phone : dto.phone,
      address: dto.address === undefined ? customer.address : dto.address,
      currency: dto.currency ?? customer.currency,
      creditLimit: dto.creditLimit ?? customer.creditLimit,
      priceCategory:
        dto.priceCategory === undefined ? customer.priceCategory : dto.priceCategory,
      state: dto.state === undefined ? customer.state : (dto.state ?? null),
      taxExempt: dto.taxExempt ?? customer.taxExempt,
      active: dto.active ?? customer.active,
    });
    return this.customersRepo.save(customer);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.customersRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }

  private async normalizeTaxId(tenantId: string | null, value?: string): Promise<string | null> {
    if (!value || value.trim() === '') {
      return null;
    }
    const tenant = tenantId
      ? await this.tenantsRepo.findOneBy({ id: tenantId })
      : null;
    const country = tenant?.country ?? 'US';
    if (country === 'MX') {
      if (!validateRfc(value)) {
        throw new BadRequestException('Invalid Mexican RFC');
      }
      return normalizeRfc(value);
    }
    if (country === 'US') {
      if (!validateEin(value)) {
        throw new BadRequestException('Invalid US EIN: expected 9 digits (XX-XXXXXXX)');
      }
      return value.replace(/[\s\-]/g, '');
    }
    return value.trim();
  }
}
