import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Between, Repository } from 'typeorm';
import { MovementType } from '@aptifum/core';
import {
  applyStockMovement,
  InsufficientStockError,
  Product,
  ProductStock,
  ProductVariant,
  StockMovement,
  Warehouse,
  WarehouseLocation,
} from '@aptifum/database';
import { CreateMovementDto } from './dto/create-movement.dto';

interface ListMovementFilters {
  productId?: string;
  variantId?: string;
  warehouseId?: string;
  movementType?: MovementType;
  from?: string;
  to?: string;
}

@Injectable()
export class StockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ProductStock)
    private readonly stockRepo: Repository<ProductStock>,
    @InjectRepository(StockMovement)
    private readonly movementsRepo: Repository<StockMovement>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepo: Repository<ProductVariant>,
    @InjectRepository(Warehouse) private readonly warehousesRepo: Repository<Warehouse>,
    @InjectRepository(WarehouseLocation)
    private readonly locationsRepo: Repository<WarehouseLocation>,
  ) {}

  async listStock(tenantId: string | null, page: number, limit: number) {
    const where = tenantId ? { tenantId } : {};
    const [rows, total] = await this.stockRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { product: true, warehouse: true, variant: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async stockByProduct(tenantId: string | null, productId: string) {
    const where = tenantId ? { tenantId, productId } : { productId };
    return this.stockRepo.find({
      where,
      order: { createdAt: 'ASC' },
      relations: { product: true, warehouse: true, variant: true },
    });
  }

  async listPosProducts(
    tenantId: string | null,
    warehouseId: string,
    page: number,
    limit: number,
    q?: string,
  ) {
    this.assertTenant(tenantId);
    const warehouse = await this.warehousesRepo.findOneBy({ id: warehouseId, tenantId });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    const [products, variants] = await Promise.all([
      this.posCatalogRows(tenantId, warehouseId, q, false),
      this.posCatalogRows(tenantId, warehouseId, q, true),
    ]);
    const rows = [...products, ...variants].sort((a, b) => a.name.localeCompare(b.name));
    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit).map((row) => ({
      id: row.id,
      variantId: row.variantId ?? null,
      sku: row.sku,
      name: row.name,
      barcode: row.barcode,
      unitOfMeasure: row.unitOfMeasure,
      categoryId: row.categoryId,
      salePrice: Number(row.salePrice),
      availableStock: Number(row.availableStock),
    }));
    return { data, meta: { page, limit, total } };
  }

  private async posCatalogRows(
    tenantId: string,
    warehouseId: string,
    q: string | undefined,
    variantsOnly: boolean,
  ) {
    const builder = this.productsRepo.createQueryBuilder('product');
    builder
      .select('product.id', 'id')
      .addSelect(variantsOnly ? 'variant.id' : 'NULL::uuid', 'variantId')
      .addSelect(variantsOnly ? 'variant.sku' : 'product.sku', 'sku')
      .addSelect(
        variantsOnly
          ? `product.name || COALESCE((SELECT ' (' || string_agg(value, ', ') || ')' FROM jsonb_each_text(variant.attributes)), '')`
          : 'product.name',
        'name',
      )
      .addSelect(variantsOnly ? 'variant.barcode' : 'product.barcode', 'barcode')
      .addSelect('product.unit_of_measure', 'unitOfMeasure')
      .addSelect('product.category_id', 'categoryId')
      .addSelect(variantsOnly ? 'variant.sale_price' : 'product.sale_price', 'salePrice')
      .addSelect(
        '(COALESCE(stock.quantity, 0) - COALESCE(stock.reserved_quantity, 0))',
        'availableStock',
      )
      .leftJoin(
        ProductStock,
        'stock',
        `stock.product_id = product.id ${
          variantsOnly ? 'AND stock.variant_id = variant.id' : 'AND stock.variant_id IS NULL'
        } AND stock.warehouse_id = :warehouseId AND stock.tenant_id = :tenantId`,
        { warehouseId, tenantId },
      )
      .where('product.tenant_id = :tenantId', { tenantId })
      .andWhere('product.enabled = true');
    if (variantsOnly) {
      builder.innerJoin(ProductVariant, 'variant', 'variant.product_id = product.id');
    }
    if (q) {
      const like = `%${q}%`;
      builder.andWhere(
        new Brackets((sub) =>
          variantsOnly
            ? sub
                .where('product.name ILIKE :q', { q: like })
                .orWhere('variant.sku ILIKE :q', { q: like })
                .orWhere('variant.barcode ILIKE :q', { q: like })
            : sub
                .where('product.name ILIKE :q', { q: like })
                .orWhere('product.sku ILIKE :q', { q: like })
                .orWhere('product.barcode ILIKE :q', { q: like }),
        ),
      );
    }
    return builder.getRawMany();
  }

  async listMovements(
    tenantId: string | null,
    page: number,
    limit: number,
    filters?: ListMovementFilters,
  ) {
    const where: Record<string, unknown> = tenantId ? { tenantId } : {};
    if (filters?.productId) {
      where.productId = filters.productId;
    }
    if (filters?.variantId) {
      where.variantId = filters.variantId;
    }
    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }
    if (filters?.movementType) {
      where.movementType = filters.movementType;
    }
    if (filters?.from || filters?.to) {
      const from = filters.from ? new Date(filters.from) : new Date('1970-01-01T00:00:00Z');
      const to = filters.to ? new Date(filters.to) : new Date('9999-12-31T23:59:59Z');
      if (filters.from) from.setHours(0, 0, 0, 0);
      if (filters.to) to.setHours(23, 59, 59, 999);
      where.occurredAt = Between(from, to);
    }
    const [rows, total] = await this.movementsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { occurredAt: 'DESC' },
      relations: { product: true, warehouse: true, variant: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async createMovement(
    tenantId: string | null,
    userId: string | null,
    dto: CreateMovementDto,
  ) {
    this.assertTenant(tenantId);
    await this.assertStockContext(tenantId, dto.productId, dto.warehouseId);
    if (dto.variantId) {
      await this.assertVariant(tenantId, dto.productId, dto.variantId);
    }
    if (dto.locationId) {
      const location = await this.locationsRepo.findOneBy({
        id: dto.locationId,
        tenantId,
      });
      if (!location || location.warehouseId !== dto.warehouseId) {
        throw new BadRequestException('Location does not belong to the warehouse');
      }
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        return applyStockMovement(manager, {
          tenantId,
          movementType: dto.movementType,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId ?? null,
          quantity: dto.quantity,
          unitCost: dto.unitCost ?? 0,
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          userId,
        });
      });
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        throw new BadRequestException('Insufficient stock');
      }
      throw error;
    }
  }

  private async assertVariant(tenantId: string, productId: string, variantId: string) {
    const variant = await this.variantsRepo.findOneBy({
      id: variantId,
      tenantId,
      productId,
    });
    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }
  }

  private async assertStockContext(
    tenantId: string,
    productId: string,
    warehouseId: string,
  ) {
    const where = { tenantId };
    const product = await this.productsRepo.findOneBy({ id: productId, ...where });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const warehouse = await this.warehousesRepo.findOneBy({ id: warehouseId, ...where });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
