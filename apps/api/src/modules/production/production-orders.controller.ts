import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ProductionOrdersService } from './production-orders.service';

@ApiTags('production')
@Controller('production/orders')
export class ProductionOrdersController {
  constructor(private readonly ordersService: ProductionOrdersService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'read'))
  @ApiOperation({ summary: 'List production orders' })
  list(@CurrentUser() user: { tenantId: string | null }, @Query() { page, limit }: PaginationQueryDto) {
    return this.ordersService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'read'))
  @ApiOperation({ summary: 'Get production order by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Create a production order' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateProductionOrderDto) {
    return this.ordersService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Update a production order' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductionOrderDto,
  ) {
    return this.ordersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Delete a production order' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.remove(user.tenantId, id);
  }

  @Post(':id/start')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Start a production order' })
  start(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.start(user.tenantId, id);
  }

  @Post(':id/complete')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Complete a production order (consume materials, receive finished goods)' })
  complete(
    @CurrentUser() user: { tenantId: string | null; id: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ordersService.complete(user.tenantId, user.id, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Cancel a production order' })
  cancel(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.cancel(user.tenantId, id);
  }
}
