import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { AccountType } from '@aptifum/core';
import { ChartAccount } from '@aptifum/database';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(ChartAccount)
    private readonly accountsRepo: Repository<ChartAccount>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<ChartAccount> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, type?: AccountType, q?: string) {
    const where: FindOptionsWhere<ChartAccount> = this.scoped(tenantId);
    if (type) {
      where.type = type;
    }
    if (q) {
      where.name = ILike(`%${q}%`);
    }
    const [rows, total] = await this.accountsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { code: 'ASC' },
      relations: { parent: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const account = await this.accountsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { parent: true },
    });
    if (!account) {
      throw new NotFoundException('Chart account not found');
    }
    return account;
  }

  async create(tenantId: string | null, dto: CreateAccountDto) {
    this.assertTenant(tenantId);
    if (dto.parentId) {
      await this.ensureParent(tenantId, dto.parentId);
    }
    const duplicate = await this.accountsRepo.findOneBy({
      tenantId,
      code: dto.code,
    });
    if (duplicate) {
      throw new BadRequestException(`Account code ${dto.code} already exists`);
    }
    return this.accountsRepo.save(
      this.accountsRepo.create({
        tenantId: tenantId as string,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        normalBalance: dto.normalBalance,
        parentId: dto.parentId ?? null,
        active: dto.active ?? true,
        description: dto.description ?? null,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateAccountDto) {
    this.assertTenant(tenantId);
    const account = await this.findOne(tenantId, id);
    if (dto.parentId) {
      await this.ensureParent(tenantId, dto.parentId);
    }
    Object.assign(account, {
      name: dto.name ?? account.name,
      type: dto.type ?? account.type,
      normalBalance: dto.normalBalance ?? account.normalBalance,
      parentId: dto.parentId === undefined ? account.parentId : dto.parentId,
      active: dto.active ?? account.active,
      description: dto.description === undefined ? account.description : dto.description,
    });
    return this.accountsRepo.save(account);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.accountsRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private async ensureParent(tenantId: string, parentId: string) {
    const parent = await this.accountsRepo.findOneBy({
      id: parentId,
      tenantId,
    });
    if (!parent) {
      throw new NotFoundException('Parent account not found');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
