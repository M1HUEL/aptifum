import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Between, Repository } from 'typeorm';
import { MovementType } from '@aptifum/core';
import {
  applyStockMovement,
  InsufficientStockError,
  Product,
  ProductStock,
  StockMovement,
  Warehouse,
  WarehouseLocation,
} from '@aptifum/database';
import { CreateMovementDto } from './dto/create-movement.dto';

interface ListMovementFilters {
  productId?: string;
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
      relations: { product: true, warehouse: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async stockByProduct(tenantId: string | null, productId: string) {
    const where = tenantId ? { tenantId, productId } : { productId };
    return this.stockRepo.find({
      where,
      order: { createdAt: 'ASC' },
      relations: { product: true, warehouse: true },
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
    const qb = this.productsRepo
      .createQueryBuilder('product')
      .leftJoin(
        ProductStock,
        'stock',
        'stock.product_id = product.id AND stock.warehouse_id = :warehouseId AND stock.tenant_id = :tenantId',
        { warehouseId, tenantId },
      )
      .select('product.id', 'id')
      .addSelect('product.sku', 'sku')
      .addSelect('product.name', 'name')
      .addSelect('product.barcode', 'barcode')
      .addSelect('product.unit_of_measure', 'unitOfMeasure')
      .addSelect('product.category_id', 'categoryId')
      .addSelect('product.sale_price', 'salePrice')
      .addSelect(
        '(COALESCE(stock.quantity, 0) - COALESCE(stock.reserved_quantity, 0))',
        'availableStock',
      )
      .where('product.tenant_id = :tenantId', { tenantId })
      .andWhere('product.enabled = true');
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('product.name ILIKE :q', { q: like })
            .orWhere('product.sku ILIKE :q', { q: like })
            .orWhere('product.barcode ILIKE :q', { q: like }),
        ),
      );
    }
    qb.orderBy('product.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    const rows = await qb.getRawMany();
    const total = await qb.getCount();
    const data = rows.map((row: Record<string, string>) => ({
      id: row.id,
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
      relations: { product: true, warehouse: true },
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
