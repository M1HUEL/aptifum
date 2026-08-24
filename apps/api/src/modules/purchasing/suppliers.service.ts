import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

import { Supplier } from '@aptifum/database';

import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';

@Injectable()
export class SuppliersService {
  constructor(@InjectRepository(Supplier) private readonly suppliersRepo: Repository<Supplier>) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Supplier> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, q?: string) {
    const where: FindOptionsWhere<Supplier> = this.scoped(tenantId);
    if (q) {
      where.tradeName = ILike(`%${q}%`);
    }
    const [rows, total] = await this.suppliersRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { tradeName: 'ASC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const supplier = await this.suppliersRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async create(tenantId: string | null, dto: CreateSupplierDto) {
    this.assertTenant(tenantId);
    return this.suppliersRepo.save(
      this.suppliersRepo.create({
        tenantId: tenantId as string,
        code: dto.code,
        tradeName: dto.tradeName,
        legalName: dto.legalName ?? null,
        taxId: dto.taxId ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        currency: dto.currency ?? 'USD',
        paymentTerms: dto.paymentTerms ?? null,
        creditLimit: dto.creditLimit ?? 0,
        active: dto.active ?? true,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.findOne(tenantId, id);
    Object.assign(supplier, {
      code: dto.code ?? supplier.code,
      tradeName: dto.tradeName ?? supplier.tradeName,
      legalName: dto.legalName === undefined ? supplier.legalName : dto.legalName,
      taxId: dto.taxId === undefined ? supplier.taxId : dto.taxId,
      email: dto.email === undefined ? supplier.email : dto.email,
      phone: dto.phone === undefined ? supplier.phone : dto.phone,
      address: dto.address === undefined ? supplier.address : dto.address,
      currency: dto.currency ?? supplier.currency,
      paymentTerms: dto.paymentTerms === undefined ? supplier.paymentTerms : dto.paymentTerms,
      creditLimit: dto.creditLimit ?? supplier.creditLimit,
      active: dto.active ?? supplier.active,
    });
    return this.suppliersRepo.save(supplier);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.suppliersRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
