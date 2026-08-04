import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse, WarehouseLocation } from '@aptifum/database';
import { CreateLocationDto } from './dto/create-location.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse) private readonly warehousesRepo: Repository<Warehouse>,
    @InjectRepository(WarehouseLocation)
    private readonly locationsRepo: Repository<WarehouseLocation>,
  ) {}

  private scoped(tenantId: string | null): { tenantId?: string } {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number) {
    const [rows, total] = await this.warehousesRepo.findAndCount({
      where: this.scoped(tenantId),
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const warehouse = await this.warehousesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    return warehouse;
  }

  async create(tenantId: string | null, dto: CreateWarehouseDto) {
    this.assertTenant(tenantId);
    return this.warehousesRepo.save(
      this.warehousesRepo.create({
        tenantId: tenantId as string,
        code: dto.code,
        name: dto.name,
        address: dto.address ?? null,
        active: dto.active ?? true,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.findOne(tenantId, id);
    Object.assign(warehouse, {
      code: dto.code ?? warehouse.code,
      name: dto.name ?? warehouse.name,
      address: dto.address === undefined ? warehouse.address : dto.address,
      active: dto.active ?? warehouse.active,
    });
    return this.warehousesRepo.save(warehouse);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.warehousesRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  async listLocations(tenantId: string | null, warehouseId: string) {
    await this.findOne(tenantId, warehouseId);
    return this.locationsRepo.find({
      where: { warehouseId, ...this.scoped(tenantId) },
      order: { name: 'ASC' },
    });
  }

  async addLocation(tenantId: string | null, warehouseId: string, dto: CreateLocationDto) {
    this.assertTenant(tenantId);
    await this.findOne(tenantId, warehouseId);
    return this.locationsRepo.save(
      this.locationsRepo.create({
        tenantId: tenantId as string,
        warehouseId,
        code: dto.code,
        name: dto.name,
        active: dto.active ?? true,
      }),
    );
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
