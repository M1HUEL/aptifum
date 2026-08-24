import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import {
  CfdiStatus,
  CFDI_PAYMENT_FORMS,
  CFDI_PAYMENT_METHODS,
  FISCAL_REGIMES,
  ModuleName,
  AuthUser,
  permission,
  SAT_PRODUCT_KEYS,
  USO_CFDI,
} from '@aptifum/core';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CfdiService } from './cfdi.service.js';
import { UpdateCfdiSettingsDto } from './dto/update-cfdi-settings.dto.js';
import { UpdateUsSalesTaxDto } from './dto/update-us-sales-tax.dto.js';
import { UsSalesTaxService } from './us-sales-tax.service.js';

@ApiTags('tax')
@Controller('tax')
export class TaxController {
  constructor(
    private readonly cfdi: CfdiService,
    private readonly usSalesTax: UsSalesTaxService,
  ) {}

  @Get('settings')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'Get CFDI settings for the current tenant' })
  getSettings(@CurrentUser() user: AuthUser) {
    return this.cfdi.settings(user.tenantId);
  }

  @Put('settings')
  @RequirePermissions(permission(ModuleName.TAX, 'write'))
  @ApiOperation({ summary: 'Update CFDI settings for the current tenant' })
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateCfdiSettingsDto) {
    return this.cfdi.updateSettings(user.tenantId, dto);
  }

  @Get('cfdi')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'List CFDI documents' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: CfdiStatus,
  ) {
    return this.cfdi.list(user.tenantId, Number(page), Number(limit), status);
  }

  @Get('cfdi/invoices/:invoiceId')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'Get CFDI for an invoice' })
  getByInvoice(@CurrentUser() user: AuthUser, @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string) {
    return this.cfdi.getByInvoice(user.tenantId, invoiceId);
  }

  @Post('cfdi/invoices/:invoiceId/generate')
  @RequirePermissions(permission(ModuleName.TAX, 'write'))
  @ApiOperation({ summary: 'Generate a CFDI for an invoice (idempotent)' })
  generate(@CurrentUser() user: AuthUser, @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string) {
    return this.cfdi.generateForInvoice(user.tenantId as string, invoiceId, user.id);
  }

  @Get('cfdi/:id')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'Get a CFDI document' })
  getOne(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cfdi.findOne(user.tenantId, id);
  }

  @Get('cfdi/:id/xml')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'Download CFDI XML' })
  async getXml(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const { xml, uuid } = await this.cfdi.getXml(user.tenantId, id);
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${uuid}.xml"`,
    });
    res.send(xml);
  }

  @Put('cfdi/:id/cancel')
  @RequirePermissions(permission(ModuleName.TAX, 'write'))
  @ApiOperation({ summary: 'Cancel a CFDI (demo: no PAC cancellation)' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cfdi.cancel(user.tenantId, user.id ?? null, id);
  }

  @Get('catalogs')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'SAT fiscal catalogs' })
  catalogs() {
    return {
      regimes: FISCAL_REGIMES,
      usos: USO_CFDI,
      paymentForms: CFDI_PAYMENT_FORMS,
      paymentMethods: CFDI_PAYMENT_METHODS,
      productKeys: SAT_PRODUCT_KEYS,
    };
  }

  @Get('us-sales-tax')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'Get US sales tax (nexus) configuration for the current tenant' })
  getUsSalesTax(@CurrentUser() user: AuthUser) {
    return this.usSalesTax.getConfig(user.tenantId);
  }

  @Put('us-sales-tax')
  @RequirePermissions(permission(ModuleName.TAX, 'write'))
  @ApiOperation({ summary: 'Update US sales tax (nexus) configuration' })
  updateUsSalesTax(@CurrentUser() user: AuthUser, @Body() dto: UpdateUsSalesTaxDto) {
    return this.usSalesTax.updateConfig(user.tenantId, dto);
  }

  @Get('us-sales-tax/states')
  @RequirePermissions(permission(ModuleName.TAX, 'read'))
  @ApiOperation({ summary: 'US states catalog with default sales tax rates' })
  usStates() {
    return this.usSalesTax.states();
  }
}
