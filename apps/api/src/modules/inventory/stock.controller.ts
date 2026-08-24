import { Body, Controller, Get, Param, Post, Query, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, MovementType, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CreateMovementDto } from './dto/create-movement.dto.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { StockService } from './stock.service.js';

@ApiTags('inventory')
@Controller('inventory')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('stock')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List current stock' })
  listStock(@CurrentUser() user: { tenantId: string | null }, @Query() { page, limit }: PaginationQueryDto) {
    return this.stockService.listStock(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get('stock/products/:productId')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'Get stock for a product' })
  stockByProduct(
    @CurrentUser() user: { tenantId: string | null },
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.stockService.stockByProduct(user.tenantId, productId);
  }

  @Get('pos-products')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List products with available stock for the point of sale' })
  listPosProducts(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('warehouseId') warehouseId?: string,
    @Query('q') q?: string,
  ) {
    if (!warehouseId) {
      throw new BadRequestException('warehouseId is required');
    }
    return this.stockService.listPosProducts(user.tenantId, warehouseId, Number(page), Math.min(Number(limit), 100), q);
  }

  @Get('lots')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List product lots with expiry status' })
  listLots(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('expiringInDays') expiringInDays?: string,
  ) {
    if (status && !['active', 'expiring', 'expired'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    return this.stockService.listLots(user.tenantId, {
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      warehouseId,
      productId,
      status: status as 'active' | 'expiring' | 'expired' | undefined,
      expiringInDays: expiringInDays ? Number(expiringInDays) : undefined,
    });
  }

  @Get('movements')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List stock movements' })
  listMovements(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('productId') productId?: string,
    @Query('variantId') variantId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('movementType') movementType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (movementType && !Object.values(MovementType).includes(movementType as MovementType)) {
      throw new BadRequestException('Invalid movement type');
    }
    if (from && Number.isNaN(Date.parse(from))) {
      throw new BadRequestException('Invalid from date');
    }
    if (to && Number.isNaN(Date.parse(to))) {
      throw new BadRequestException('Invalid to date');
    }
    return this.stockService.listMovements(user.tenantId, Number(page), Math.min(Number(limit), 100), {
      productId,
      variantId,
      warehouseId,
      movementType: movementType as MovementType | undefined,
      from,
      to,
    });
  }

  @Post('movements')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'adjust'))
  @ApiOperation({ summary: 'Create a stock movement' })
  createMovement(@CurrentUser() user: { tenantId: string | null; id: string }, @Body() dto: CreateMovementDto) {
    return this.stockService.createMovement(user.tenantId, user.id, dto);
  }

  @Post('transfers')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'adjust'))
  @ApiOperation({ summary: 'Transfer stock between warehouses' })
  createTransfer(@CurrentUser() user: { tenantId: string | null; id: string }, @Body() dto: CreateTransferDto) {
    return this.stockService.createTransfer(user.tenantId, user.id, dto);
  }
}
