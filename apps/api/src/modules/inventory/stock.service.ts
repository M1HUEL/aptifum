import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  applyStockMovement,
  InsufficientStockError,
  Product,
  ProductStock,
  StockMovement,
  Warehouse,
} from '@aptifum/database';
import { CreateMovementDto } from './dto/create-movement.dto';

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

  async listMovements(
    tenantId: string | null,
    page: number,
    limit: number,
    productId?: string,
  ) {
    const where: { tenantId?: string; productId?: string } = tenantId
      ? { tenantId }
      : {};
    if (productId) {
      where.productId = productId;
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

    try {
      return await this.dataSource.transaction(async (manager) => {
        return applyStockMovement(manager, {
          tenantId,
          movementType: dto.movementType,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
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
