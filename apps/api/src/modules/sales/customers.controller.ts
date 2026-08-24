import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

@ApiTags('sales')
@Controller('sales/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.SALES, 'read'))
  @ApiOperation({ summary: 'List customers' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('q') q?: string,
  ) {
    return this.customersService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), q);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.SALES, 'read'))
  @ApiOperation({ summary: 'Get customer by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.customersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Create a customer' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Update a customer' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Deactivate a customer' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.customersService.remove(user.tenantId, id);
  }
}
