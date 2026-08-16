import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DEFAULT_TENANT_ID } from '@aptifum/database';
import { ModuleName, permission } from '@aptifum/core';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.USERS, 'read'))
  @ApiOperation({ summary: 'List users' })
  list(@Query() { page, limit }: PaginationQueryDto) {
    return this.usersService.findAll(Number(page), Math.min(Number(limit), 100));
  }

  @Post()
  @RequirePermissions(permission(ModuleName.USERS, 'write'))
  @ApiOperation({ summary: 'Create a user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      active: dto.active,
      tenantId: DEFAULT_TENANT_ID,
      roleIds: dto.roleIds,
    });
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.USERS, 'write'))
  @ApiOperation({ summary: 'Update a user' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, {
      name: dto.name,
      active: dto.active,
      password: dto.password,
      roleIds: dto.roleIds,
    });
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.USERS, 'read'))
  @ApiOperation({ summary: 'Get user profile by id' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getProfile(id);
  }
}
