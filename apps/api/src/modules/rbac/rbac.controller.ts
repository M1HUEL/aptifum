import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Repository } from 'typeorm';
import { ModuleName, permission } from '@aptifum/core';
import { Role } from '@aptifum/database';
import { RequirePermissions } from './decorators/require-permissions.decorator';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
  ) {}

  @Get()
  @RequirePermissions(permission(ModuleName.RBAC, 'read'))
  @ApiOperation({ summary: 'List roles' })
  list() {
    return this.rolesRepo.find({ order: { name: 'ASC' } });
  }

  @Post()
  @RequirePermissions(permission(ModuleName.RBAC, 'write'))
  @ApiOperation({ summary: 'Create a role' })
  async create(@Body() dto: CreateRoleDto) {
    const existing = await this.rolesRepo.findOneBy({ name: dto.name });
    if (existing) {
      throw new ConflictException('Role name already exists');
    }
    return this.rolesRepo.save(
      this.rolesRepo.create({
        name: dto.name,
        description: dto.description ?? null,
        permissions: dto.permissions,
        isSystem: false,
      }),
    );
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.RBAC, 'write'))
  @ApiOperation({ summary: 'Update a role' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const role = await this.rolesRepo.findOneBy({ id });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (dto.name !== undefined) {
      const existing = await this.rolesRepo.findOneBy({ name: dto.name });
      if (existing && existing.id !== id) {
        throw new ConflictException('Role name already exists');
      }
      role.name = dto.name;
    }
    if (dto.description !== undefined) {
      role.description = dto.description ?? null;
    }
    if (dto.permissions !== undefined) {
      role.permissions = dto.permissions;
    }
    return this.rolesRepo.save(role);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.RBAC, 'write'))
  @ApiOperation({ summary: 'Delete a role' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const role = await this.rolesRepo.findOneBy({ id });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }
    await this.rolesRepo.softDelete(id);
    return { id };
  }
}
