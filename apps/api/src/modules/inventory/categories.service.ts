import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { Category } from '@aptifum/database';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private readonly categoriesRepo: Repository<Category>) {}

  private scoped(tenantId: string | null): { tenantId?: string } {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number) {
    const [rows, total] = await this.categoriesRepo.findAndCount({
      where: { ...this.scoped(tenantId), parentId: IsNull() },
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const category = await this.categoriesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(tenantId: string | null, dto: CreateCategoryDto) {
    this.assertTenant(tenantId);
    if (dto.parentId) {
      await this.findOne(tenantId, dto.parentId);
    }
    return this.categoriesRepo.save(
      this.categoriesRepo.create({
        tenantId: tenantId as string,
        name: dto.name,
        parentId: dto.parentId ?? null,
        active: dto.active ?? true,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(tenantId, id);
    if (dto.parentId) {
      await this.findOne(tenantId, dto.parentId);
    }
    Object.assign(category, {
      name: dto.name ?? category.name,
      parentId: dto.parentId === undefined ? category.parentId : dto.parentId,
      active: dto.active ?? category.active,
    });
    return this.categoriesRepo.save(category);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.categoriesRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
