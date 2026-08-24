import { Body, Controller, Delete, Get, Param, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CreateTaxDto } from './dto/create-tax.dto.js';
import { TaxesService } from './taxes.service.js';

@ApiTags('sales')
@Controller('sales/taxes')
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.SALES, 'read'))
  @ApiOperation({ summary: 'List taxes' })
  list(@CurrentUser() user: { tenantId: string | null }) {
    return this.taxesService.findAll(user.tenantId);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Create a tax' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateTaxDto) {
    return this.taxesService.create(user.tenantId, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Deactivate a tax' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.taxesService.remove(user.tenantId, id);
  }
}
