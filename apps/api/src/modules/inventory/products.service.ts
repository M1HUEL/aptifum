import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

import { Category, Product } from '@aptifum/database';

import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    @InjectRepository(Category) private readonly categoriesRepo: Repository<Category>,
  ) {}

  private scoped(tenantId: string | null): { tenantId?: string } {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, q?: string) {
    const where: FindOptionsWhere<Product> = this.scoped(tenantId);
    if (q) {
      where.name = ILike(`%${q}%`);
    }
    const [rows, total] = await this.productsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { category: true, variants: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const product = await this.productsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { category: true, variants: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(tenantId: string | null, dto: CreateProductDto) {
    this.assertTenant(tenantId);
    if (dto.categoryId) {
      await this.ensureCategory(tenantId, dto.categoryId);
    }
    return this.productsRepo.save(
      this.productsRepo.create({
        tenantId: tenantId as string,
        sku: dto.sku,
        name: dto.name,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        brand: dto.brand ?? null,
        unitOfMeasure: dto.unitOfMeasure ?? 'unit',
        barcode: dto.barcode ?? null,
        imageUrl: dto.imageUrl ?? null,
        purchasePrice: dto.purchasePrice ?? 0,
        salePrice: dto.salePrice ?? 0,
        enabled: dto.enabled ?? true,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateProductDto) {
    const product = await this.findOne(tenantId, id);
    if (dto.categoryId) {
      await this.ensureCategory(tenantId, dto.categoryId);
    }
    Object.assign(product, {
      sku: dto.sku ?? product.sku,
      name: dto.name ?? product.name,
      description: dto.description === undefined ? product.description : dto.description,
      categoryId: dto.categoryId === undefined ? product.categoryId : dto.categoryId,
      brand: dto.brand === undefined ? product.brand : dto.brand,
      unitOfMeasure: dto.unitOfMeasure ?? product.unitOfMeasure,
      barcode: dto.barcode === undefined ? product.barcode : dto.barcode,
      imageUrl: dto.imageUrl === undefined ? product.imageUrl : dto.imageUrl,
      purchasePrice: dto.purchasePrice ?? product.purchasePrice,
      salePrice: dto.salePrice ?? product.salePrice,
      enabled: dto.enabled ?? product.enabled,
    });
    return this.productsRepo.save(product);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.productsRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private async ensureCategory(tenantId: string | null, categoryId: string) {
    const category = await this.categoriesRepo.findOne({
      where: { id: categoryId, ...this.scoped(tenantId) },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
