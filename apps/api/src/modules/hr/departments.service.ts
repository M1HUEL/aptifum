import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Department } from '@aptifum/database';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department) private readonly departmentsRepo: Repository<Department>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Department> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number) {
    const [rows, total] = await this.departmentsRepo.findAndCount({
      where: this.scoped(tenantId),
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const department = await this.departmentsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  async create(tenantId: string | null, dto: CreateDepartmentDto) {
    this.assertTenant(tenantId);
    return this.departmentsRepo.save(
      this.departmentsRepo.create({
        tenantId: tenantId as string,
        code: dto.code,
        name: dto.name,
        managerEmployeeId: dto.managerEmployeeId ?? null,
        active: dto.active ?? true,
      }),
    );
  }

  async update(tenantId: string | null, id: string, dto: UpdateDepartmentDto) {
    const department = await this.findOne(tenantId, id);
    Object.assign(department, {
      code: dto.code ?? department.code,
      name: dto.name ?? department.name,
      managerEmployeeId:
        dto.managerEmployeeId === undefined ? department.managerEmployeeId : dto.managerEmployeeId,
      active: dto.active ?? department.active,
    });
    return this.departmentsRepo.save(department);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.departmentsRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
