import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductVariantsService } from './product-variants.service';

@ApiTags('inventory')
@Controller('inventory/products/:productId/variants')
export class ProductVariantsController {
  constructor(private readonly productVariantsService: ProductVariantsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List product variants' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.productVariantsService.findAll(user.tenantId, productId);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'Get a product variant by id' })
  get(
    @CurrentUser() user: { tenantId: string | null },
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.productVariantsService.findOne(user.tenantId, productId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Create a product variant' })
  create(
    @CurrentUser() user: { tenantId: string | null },
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.productVariantsService.create(user.tenantId, productId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Update a product variant' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productVariantsService.update(user.tenantId, productId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Deactivate a product variant' })
  remove(
    @CurrentUser() user: { tenantId: string | null },
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.productVariantsService.remove(user.tenantId, productId, id);
  }
}
