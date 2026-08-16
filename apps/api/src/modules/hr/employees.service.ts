import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Employee } from '@aptifum/database';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(@InjectRepository(Employee) private readonly employeesRepo: Repository<Employee>) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Employee> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, q?: string, includeSalary = false) {
    const where: FindOptionsWhere<Employee> = this.scoped(tenantId);
    if (q) {
      where.firstName = ILike(`%${q}%`);
    }
    const [rows, total] = await this.employeesRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { lastName: 'ASC', firstName: 'ASC' },
      relations: { department: true },
    });
    return {
      data: rows.map((row) => this.sanitize(row, includeSalary)),
      meta: { page, limit, total },
    };
  }

  async findOne(tenantId: string | null, id: string, includeSalary = false) {
    const employee = await this.employeesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { department: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return this.sanitize(employee, includeSalary);
  }

  async create(tenantId: string | null, dto: CreateEmployeeDto) {
    this.assertTenant(tenantId);
    const employeeNo = dto.employeeNo ?? (await this.nextEmployeeNo(tenantId as string));
    const employee = await this.employeesRepo.save(
      this.employeesRepo.create({
        tenantId: tenantId as string,
        employeeNo,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        departmentId: dto.departmentId ?? null,
        position: dto.position ?? null,
        hireDate: dto.hireDate,
        terminationDate: dto.terminationDate ?? null,
        salary: dto.salary ?? 0,
        salaryFrequency: dto.salaryFrequency ?? 'monthly',
        bankName: dto.bankName ?? null,
        bankAccount: dto.bankAccount ?? null,
        taxId: dto.taxId ?? null,
        address: dto.address ?? null,
        status: dto.status ?? undefined,
      }),
    );
    return this.findOne(tenantId, employee.id, true);
  }

  async update(tenantId: string | null, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.employeesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    Object.assign(employee, {
      employeeNo: dto.employeeNo ?? employee.employeeNo,
      firstName: dto.firstName ?? employee.firstName,
      lastName: dto.lastName ?? employee.lastName,
      email: dto.email === undefined ? employee.email : dto.email,
      phone: dto.phone === undefined ? employee.phone : dto.phone,
      departmentId: dto.departmentId === undefined ? employee.departmentId : dto.departmentId,
      position: dto.position === undefined ? employee.position : dto.position,
      hireDate: dto.hireDate ?? employee.hireDate,
      terminationDate: dto.terminationDate === undefined ? employee.terminationDate : dto.terminationDate,
      salary: dto.salary ?? employee.salary,
      salaryFrequency: dto.salaryFrequency ?? employee.salaryFrequency,
      bankName: dto.bankName === undefined ? employee.bankName : dto.bankName,
      bankAccount: dto.bankAccount === undefined ? employee.bankAccount : dto.bankAccount,
      taxId: dto.taxId === undefined ? employee.taxId : dto.taxId,
      address: dto.address === undefined ? employee.address : dto.address,
      status: dto.status ?? employee.status,
    });
    await this.employeesRepo.save(employee);
    return this.findOne(tenantId, id, true);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.employeesRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private async nextEmployeeNo(tenantId: string): Promise<string> {
    const count = await this.employeesRepo.countBy({ tenantId });
    return `EMP-${String(count + 1).padStart(6, '0')}`;
  }

  private sanitize(employee: Employee, includeSalary: boolean) {
    if (includeSalary) {
      return employee;
    }
    const { salary, salaryFrequency, bankName, bankAccount, ...rest } = employee;
    return rest;
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
