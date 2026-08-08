import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, MovementType, permission } from '@aptifum/core';
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
    @Query() { page, limit }: PaginationQueryDto,
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
    @Query() { page, limit }: PaginationQueryDto,
    @Query('productId') productId?: string,
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
    return this.stockService.listMovements(
      user.tenantId,
      Number(page),
      Math.min(Number(limit), 100),
      {
        productId,
        warehouseId,
        movementType: movementType as MovementType | undefined,
        from,
        to,
      },
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
