import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateMovementDto } from './dto/create-movement.dto';
import { StockService } from './stock.service';

@ApiTags('inventory')
@Controller('inventory')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('stock')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List current stock' })
  listStock(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
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

  @Get('movements')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List stock movements' })
  listMovements(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('productId') productId?: string,
  ) {
    return this.stockService.listMovements(
      user.tenantId,
      Number(page),
      Math.min(Number(limit), 100),
      productId,
    );
  }

  @Post('movements')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'adjust'))
  @ApiOperation({ summary: 'Create a stock movement' })
  createMovement(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @Body() dto: CreateMovementDto,
  ) {
    return this.stockService.createMovement(user.tenantId, user.id, dto);
  }
}
