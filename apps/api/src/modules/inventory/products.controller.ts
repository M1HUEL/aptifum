import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('inventory')
@Controller('inventory/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List products' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('q') q?: string,
  ) {
    return this.productsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), q);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'Get product by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Create a product' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Update a product' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Deactivate a product' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.remove(user.tenantId, id);
  }
}
