import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { CrmContact, Customer } from '@aptifum/database';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(CrmContact) private readonly contactsRepo: Repository<CrmContact>,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<CrmContact> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, q?: string) {
    const where: FindOptionsWhere<CrmContact> = this.scoped(tenantId);
    if (q) {
      where.fullName = ILike(`%${q}%`);
    }
    const [rows, total] = await this.contactsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { fullName: 'ASC' },
      relations: { customer: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const contact = await this.contactsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { customer: true },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async create(tenantId: string | null, dto: CreateContactDto) {
    this.assertTenant(tenantId);
    if (dto.customerId) {
      await this.ensureCustomer(tenantId, dto.customerId);
    }
    const contact = await this.contactsRepo.save(
      this.contactsRepo.create({
        tenantId: tenantId as string,
        fullName: dto.fullName,
        customerId: dto.customerId ?? null,
        title: dto.title ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        mobile: dto.mobile ?? null,
        address: dto.address ?? null,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
      }),
    );
    return this.findOne(tenantId, contact.id);
  }

  async update(tenantId: string | null, id: string, dto: UpdateContactDto) {
    const contact = await this.findOne(tenantId, id);
    if (dto.customerId) {
      await this.ensureCustomer(tenantId as string, dto.customerId);
    }
    Object.assign(contact, {
      fullName: dto.fullName ?? contact.fullName,
      customerId: dto.customerId === undefined ? contact.customerId : dto.customerId,
      title: dto.title === undefined ? contact.title : dto.title,
      email: dto.email === undefined ? contact.email : dto.email,
      phone: dto.phone === undefined ? contact.phone : dto.phone,
      mobile: dto.mobile === undefined ? contact.mobile : dto.mobile,
      address: dto.address === undefined ? contact.address : dto.address,
      notes: dto.notes === undefined ? contact.notes : dto.notes,
      active: dto.active ?? contact.active,
    });
    await this.contactsRepo.save(contact);
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string | null, id: string) {
    await this.findOne(tenantId, id);
    await this.contactsRepo.softDelete({ id, ...this.scoped(tenantId) });
    return { id };
  }

  private async ensureCustomer(tenantId: string, customerId: string) {
    const customer = await this.customersRepo.findOneBy({ id: customerId, tenantId });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
