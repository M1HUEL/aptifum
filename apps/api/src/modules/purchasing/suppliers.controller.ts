import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('purchasing')
@Controller('purchasing/suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'List suppliers' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
  ) {
    return this.suppliersService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), q);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'Get supplier by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id') id: string) {
    return this.suppliersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Create a supplier' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Update a supplier' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Deactivate a supplier' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id') id: string) {
    return this.suppliersService.remove(user.tenantId, id);
  }
}
