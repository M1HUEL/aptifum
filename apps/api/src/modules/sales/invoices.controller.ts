import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('sales')
@Controller('sales/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.INVOICING, 'read'))
  @ApiOperation({ summary: 'List invoices and credit notes' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.invoicesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.INVOICING, 'read'))
  @ApiOperation({ summary: 'Get invoice by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invoicesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.INVOICING, 'write'))
  @ApiOperation({ summary: 'Issue an invoice (from order or direct)' })
  create(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @Body() dto: CreateInvoiceDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.invoicesService.create(user.tenantId, user.id, dto, idempotencyKey);
  }

  @Post(':id/payments')
  @RequirePermissions(permission(ModuleName.INVOICING, 'write'))
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  recordPayment(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.invoicesService.recordPayment(user.tenantId, user.id, id, dto, idempotencyKey);
  }

  @Post(':id/credit-note')
  @RequirePermissions(permission(ModuleName.INVOICING, 'write'))
  @ApiOperation({ summary: 'Issue a credit note for an invoice' })
  createCreditNote(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.invoicesService.createCreditNote(user.tenantId, user.id, id, idempotencyKey);
  }
}
