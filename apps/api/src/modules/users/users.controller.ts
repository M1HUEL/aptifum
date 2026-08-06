import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
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

  @Get(':id')
  @RequirePermissions(permission(ModuleName.USERS, 'read'))
  @ApiOperation({ summary: 'Get user profile by id' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getProfile(id);
  }
}
