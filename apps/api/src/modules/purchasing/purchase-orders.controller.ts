import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchasing')
@Controller('purchasing')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get('receipts')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'List goods receipts' })
  listReceipts(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.purchaseOrdersService.listReceipts(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get('receipts/:id')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'Get goods receipt by id' })
  getReceipt(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.purchaseOrdersService.findReceipt(user.tenantId, id);
  }

  @Get('purchase-orders')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'List purchase orders' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.purchaseOrdersService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get('purchase-orders/:id')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'Get purchase order by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.purchaseOrdersService.findOne(user.tenantId, id);
  }

  @Post('purchase-orders')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Create a purchase order' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(user.tenantId, dto);
  }

  @Post('purchase-orders/:id/approve')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Approve a purchase order' })
  approve(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.purchaseOrdersService.approve(user.tenantId, id);
  }

  @Post('purchase-orders/:id/cancel')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Cancel a purchase order' })
  cancel(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.purchaseOrdersService.cancel(user.tenantId, id);
  }

  @Post('purchase-orders/:id/receipts')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Receive goods against a purchase order' })
  receive(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.purchaseOrdersService.receive(user.tenantId, user.id, id, dto);
  }
}
