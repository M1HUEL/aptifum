import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Role, User } from '@aptifum/database';

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  tenantId?: string;
  roleName?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
  ) {}

  async create(input: CreateUserInput) {
    const existing = await this.usersRepo.findOneBy({ email: input.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = this.usersRepo.create({
      email: input.email,
      passwordHash,
      name: input.name ?? null,
      active: true,
      defaultTenantId: input.tenantId ?? null,
    });
    const saved = await this.usersRepo.save(user);
    if (input.tenantId) {
      await this.usersRepo
        .createQueryBuilder()
        .relation(User, 'tenants')
        .of(saved.id)
        .add(input.tenantId);
    }
    if (input.roleName) {
      const role = await this.rolesRepo.findOneBy({ name: input.roleName });
      if (role) {
        await this.usersRepo
          .createQueryBuilder()
          .relation(User, 'roles')
          .of(saved.id)
          .add(role.id);
      }
    }
    return saved;
  }

  async findByEmailWithPassword(email: string) {
    return this.usersRepo.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        active: true,
        defaultTenantId: true,
      },
    });
  }

  async getProfile(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: { roles: true },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        defaultTenantId: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      active: user.active,
      tenantId: user.defaultTenantId,
      roles: user.roles.map((role) => ({ name: role.name, permissions: role.permissions })),
    };
  }

  async findAll(page: number, limit: number) {
    const [rows, total] = await this.usersRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        defaultTenantId: true,
        createdAt: true,
      },
    });
    return {
      data: rows.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        active: user.active,
        tenantId: user.defaultTenantId,
        roles: [],
      })),
      meta: { page, limit, total },
    };
  }
}
