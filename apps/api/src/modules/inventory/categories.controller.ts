import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('inventory')
@Controller('inventory/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List categories' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
  ) {
    return this.categoriesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'Get category by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.categoriesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Create a category' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Update a category' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Deactivate a category' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.categoriesService.remove(user.tenantId, id);
  }
}
