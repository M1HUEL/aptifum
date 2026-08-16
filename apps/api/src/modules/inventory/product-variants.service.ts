import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductVariant } from '@aptifum/database';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant) private readonly variantsRepo: Repository<ProductVariant>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
  ) {}

  private scoped(tenantId: string | null): { tenantId?: string } {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, productId: string) {
    await this.ensureProduct(tenantId, productId);
    return this.variantsRepo.find({
      where: { productId, ...this.scoped(tenantId) },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(tenantId: string | null, productId: string, id: string) {
    const variant = await this.variantsRepo.findOne({
      where: { id, productId, ...this.scoped(tenantId) },
    });
    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }
    return variant;
  }

  async create(tenantId: string | null, productId: string, dto: CreateProductVariantDto) {
    this.assertTenant(tenantId);
    await this.ensureProduct(tenantId, productId);
    await this.assertSkuAvailable(tenantId, productId, dto.sku);
    return this.variantsRepo.save(
      this.variantsRepo.create({
        tenantId: tenantId as string,
        productId,
        sku: dto.sku,
        barcode: dto.barcode ?? null,
        attributes: dto.attributes ?? {},
        purchasePrice: dto.purchasePrice ?? 0,
        salePrice: dto.salePrice ?? 0,
      }),
    );
  }

  async update(tenantId: string | null, productId: string, id: string, dto: UpdateProductVariantDto) {
    const variant = await this.findOne(tenantId, productId, id);
    if (dto.sku && dto.sku !== variant.sku) {
      await this.assertSkuAvailable(tenantId, productId, dto.sku, id);
    }
    Object.assign(variant, {
      sku: dto.sku ?? variant.sku,
      barcode: dto.barcode === undefined ? variant.barcode : dto.barcode,
      attributes: dto.attributes === undefined ? variant.attributes : dto.attributes,
      purchasePrice: dto.purchasePrice ?? variant.purchasePrice,
      salePrice: dto.salePrice ?? variant.salePrice,
    });
    return this.variantsRepo.save(variant);
  }

  async remove(tenantId: string | null, productId: string, id: string) {
    await this.findOne(tenantId, productId, id);
    await this.variantsRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private async ensureProduct(tenantId: string | null, productId: string) {
    const product = await this.productsRepo.findOne({
      where: { id: productId, ...this.scoped(tenantId) },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async assertSkuAvailable(tenantId: string | null, productId: string, sku: string, excludeId?: string) {
    const product = await this.productsRepo.findOne({
      where: { id: productId, ...this.scoped(tenantId) },
    });
    if (product && product.sku === sku) {
      throw new BadRequestException('SKU conflicts with the product SKU');
    }
    const existing = await this.variantsRepo.findOne({
      where: { tenantId: tenantId ?? undefined, sku },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('SKU already in use by another variant');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
