import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { Role, User } from '@aptifum/database';

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  active?: boolean;
  tenantId?: string;
  roleName?: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  name?: string;
  active?: boolean;
  password?: string;
  roleIds?: string[];
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
      active: input.active ?? true,
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
    if (input.roleIds?.length) {
      const roles = await this.rolesRepo.findBy({ id: In(input.roleIds) });
      await this.usersRepo
        .createQueryBuilder()
        .relation(User, 'roles')
        .of(saved.id)
        .add(roles.map((role) => role.id));
    }
    return this.getProfile(saved.id);
  }

  async update(id: string, input: UpdateUserInput) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (input.name !== undefined) {
      user.name = input.name;
    }
    if (input.active !== undefined) {
      user.active = input.active;
    }
    if (input.password) {
      user.passwordHash = await bcrypt.hash(input.password, 10);
    }
    await this.usersRepo.save(user);
    if (input.roleIds) {
      const roles = input.roleIds.length
        ? await this.rolesRepo.findBy({ id: In(input.roleIds) })
        : [];
      await this.usersRepo
        .createQueryBuilder()
        .relation(User, 'roles')
        .of(id)
        .addAndRemove(
          roles.map((role) => role.id),
          user.roles.map((role) => role.id),
        );
    }
    return this.getProfile(id);
  }

  async updateName(userId: string, name: string) {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.name = name;
    await this.usersRepo.save(user);
    return this.getProfile(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);
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

  async findByEmail(email: string) {
    return this.usersRepo.findOne({
      where: { email },
      select: { id: true, email: true, active: true, defaultTenantId: true },
    });
  }

  async setPassword(userId: string, newPassword: string) {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);
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
      relations: { roles: true },
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
        createdAt: user.createdAt,
        roles: user.roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions: role.permissions,
        })),
      })),
      meta: { page, limit, total },
    };
  }
}
