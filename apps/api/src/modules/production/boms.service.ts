import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';

import { Product, ProductionBom, ProductionBomLine } from '@aptifum/database';

import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@Injectable()
export class BomsService {
  constructor(
    @InjectRepository(ProductionBom)
    private readonly bomsRepo: Repository<ProductionBom>,
    @InjectRepository(ProductionBomLine)
    private readonly bomLinesRepo: Repository<ProductionBomLine>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<ProductionBom> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number) {
    const [rows, total] = await this.bomsRepo.findAndCount({
      where: this.scoped(tenantId),
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { product: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const bom = await this.bomsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { product: true, lines: { product: true } },
    });
    if (!bom) {
      throw new NotFoundException('BOM not found');
    }
    return bom;
  }

  async create(tenantId: string | null, dto: CreateBomDto) {
    this.assertTenant(tenantId);
    await this.validateLines(tenantId as string, dto.productId, dto.lines);
    return this.dataSource.transaction(async (manager) => {
      const bomsRepo = manager.getRepository(ProductionBom);
      const bom = await bomsRepo.save(
        bomsRepo.create({
          tenantId,
          name: dto.name,
          productId: dto.productId,
          outputQuantity: dto.outputQuantity ?? 1,
          active: dto.active ?? true,
        }),
      );
      await manager.getRepository(ProductionBomLine).save(
        dto.lines.map((line) =>
          manager.getRepository(ProductionBomLine).create({
            tenantId,
            bomId: bom.id,
            productId: line.productId,
            quantity: line.quantity,
            wasteRate: line.wasteRate ?? 0,
          }),
        ),
      );
      return bom;
    });
  }

  async update(tenantId: string | null, id: string, dto: UpdateBomDto) {
    this.assertTenant(tenantId);
    const bom = await this.findOne(tenantId, id);
    const productId = dto.productId ?? bom.productId;
    if (dto.lines) {
      await this.validateLines(tenantId as string, productId, dto.lines);
    }
    await this.dataSource.transaction(async (manager) => {
      const bomsRepo = manager.getRepository(ProductionBom);
      Object.assign(bom, {
        name: dto.name ?? bom.name,
        productId: dto.productId ?? bom.productId,
        outputQuantity: dto.outputQuantity ?? bom.outputQuantity,
        active: dto.active ?? bom.active,
      });
      await bomsRepo.save(bom);
      if (dto.lines) {
        const linesRepo = manager.getRepository(ProductionBomLine);
        await linesRepo.softDelete({ bomId: id, tenantId: tenantId as string });
        await linesRepo.save(
          dto.lines.map((line) =>
            linesRepo.create({
              tenantId,
              bomId: id,
              productId: line.productId,
              quantity: line.quantity,
              wasteRate: line.wasteRate ?? 0,
            }),
          ),
        );
      }
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.bomsRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private async validateLines(tenantId: string, finishedProductId: string, lines: Array<{ productId: string }>) {
    if (lines.some((line) => line.productId === finishedProductId)) {
      throw new BadRequestException('A BOM component cannot be the finished product itself');
    }
    const uniqueIds = [...new Set(lines.map((line) => line.productId))];
    const products = await this.productsRepo.findBy({ id: In(uniqueIds), tenantId });
    if (products.length !== uniqueIds.length) {
      throw new NotFoundException('One or more component products were not found');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
