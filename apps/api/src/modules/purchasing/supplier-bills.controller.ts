import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

import { CreateSupplierBillDto } from './dto/create-supplier-bill.dto';
import { SupplierBillsService } from './supplier-bills.service';

@ApiTags('purchasing')
@Controller('purchasing/bills')
export class SupplierBillsController {
  constructor(private readonly billsService: SupplierBillsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'List supplier bills' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.billsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), supplierId);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'Get a supplier bill' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Create a supplier bill (draft)' })
  create(@CurrentUser() user: { tenantId: string | null; id: string }, @Body() dto: CreateSupplierBillDto) {
    return this.billsService.create(user.tenantId, user.id, dto);
  }

  @Post(':id/issue')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Issue a supplier bill (posts AP and assigns number)' })
  issue(@CurrentUser() user: { tenantId: string | null; id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.issue(user.tenantId, user.id, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Cancel a draft supplier bill' })
  cancel(@CurrentUser() user: { tenantId: string | null }, @Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.cancel(user.tenantId, id);
  }
}
