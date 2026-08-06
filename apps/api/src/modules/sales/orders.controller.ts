import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('sales')
@Controller('sales/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.SALES, 'read'))
  @ApiOperation({ summary: 'List quotes and orders' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
  ) {
    return this.ordersService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.SALES, 'read'))
  @ApiOperation({ summary: 'Get order by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Create a quote or order' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.tenantId, dto);
  }

  @Post(':id/confirm')
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Confirm a draft order' })
  confirm(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.confirm(user.tenantId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Cancel an order' })
  cancel(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.cancel(user.tenantId, id);
  }

  @Post(':id/convert')
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @ApiOperation({ summary: 'Convert a quote to an order' })
  convert(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordersService.convertToOrder(user.tenantId, id);
  }
}
