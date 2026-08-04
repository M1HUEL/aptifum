import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
  create(@Body() dto: CreateRoleDto) {
    return this.rolesRepo.save(
      this.rolesRepo.create({
        name: dto.name,
        description: dto.description ?? null,
        permissions: dto.permissions,
        isSystem: false,
      }),
    );
  }
}
