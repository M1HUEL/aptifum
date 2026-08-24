import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto.js';
import { SupplierPaymentsService } from './supplier-payments.service.js';

@ApiTags('purchasing')
@Controller('purchasing/payments')
export class SupplierPaymentsController {
  constructor(private readonly paymentsService: SupplierPaymentsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.PURCHASING, 'read'))
  @ApiOperation({ summary: 'List supplier payments' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.paymentsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), supplierId);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @ApiOperation({ summary: 'Record a supplier payment (AP)' })
  record(@CurrentUser() user: { tenantId: string | null; id: string }, @Body() dto: CreateSupplierPaymentDto) {
    return this.paymentsService.record(user.tenantId, user.id, dto);
  }
}
