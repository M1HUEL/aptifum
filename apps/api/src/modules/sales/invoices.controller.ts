import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Tenant } from '@aptifum/database';
import type { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { sendPdf } from '../../common/export/export.util';
import { buildInvoicePdf } from './invoice-pdf.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('sales')
@Controller('sales/invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    @InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  @Get()
  @RequirePermissions(permission(ModuleName.INVOICING, 'read'))
  @ApiOperation({ summary: 'List invoices and credit notes' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.invoicesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), {
      q,
      status,
      type,
    });
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.INVOICING, 'read'))
  @ApiOperation({ summary: 'Get invoice by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invoicesService.findOne(user.tenantId, id);
  }

  @Get(':id/pdf')
  @RequirePermissions(permission(ModuleName.INVOICING, 'read'))
  @ApiOperation({ summary: 'Download invoice as PDF' })
  async downloadPdf(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const invoice = await this.invoicesService.findOne(user.tenantId, id);
    const tenant = user.tenantId ? await this.tenantsRepo.findOneBy({ id: user.tenantId }) : null;
    if (res) {
      return sendPdf(res, `invoice-${invoice.number}.pdf`, () => buildInvoicePdf({ tenant, invoice }));
    }
    return buildInvoicePdf({ tenant, invoice });
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
