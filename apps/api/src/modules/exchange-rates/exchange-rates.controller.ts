import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto.js';
import { ExchangeRatesService } from './exchange-rates.service.js';

@ApiTags('exchange-rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRates: ExchangeRatesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'List exchange rates' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('base') base?: string,
    @Query('quote') quote?: string,
  ) {
    return this.exchangeRates.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), { base, quote });
  }

  @Get('latest')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'Latest exchange rate for a pair, at or before an optional date' })
  latest(
    @CurrentUser() user: { tenantId: string | null },
    @Query('base') base?: string,
    @Query('quote') quote?: string,
    @Query('date') date?: string,
  ) {
    return this.exchangeRates.latest(user.tenantId, base ?? '', quote ?? '', date);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Create an exchange rate' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateExchangeRateDto) {
    return this.exchangeRates.create(user.tenantId, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Delete an exchange rate' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.exchangeRates.remove(user.tenantId, id);
  }
}
