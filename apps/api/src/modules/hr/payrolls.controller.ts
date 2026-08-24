import { Body, Controller, Get, Param, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { GeneratePayrollDto } from './dto/generate-payroll.dto.js';
import { PayrollsService } from './payrolls.service.js';

@ApiTags('hr')
@Controller('hr/payrolls')
export class PayrollsController {
  constructor(private readonly payrollsService: PayrollsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.HR, 'read'), permission(ModuleName.HR, 'approve'))
  @ApiOperation({ summary: 'List payrolls' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('period') period?: string,
  ) {
    return this.payrollsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), period);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.HR, 'read'), permission(ModuleName.HR, 'approve'))
  @ApiOperation({ summary: 'Get payroll by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payrollsService.findOne(user.tenantId, id);
  }

  @Post('generate')
  @RequirePermissions(permission(ModuleName.HR, 'approve'))
  @ApiOperation({ summary: 'Generate a draft payroll for a period' })
  generate(@CurrentUser() user: { tenantId: string | null }, @Body() dto: GeneratePayrollDto) {
    return this.payrollsService.generate(user.tenantId, dto);
  }

  @Post(':id/post')
  @RequirePermissions(permission(ModuleName.HR, 'approve'))
  @ApiOperation({ summary: 'Post a payroll (generates accounting entry)' })
  post(@CurrentUser() user: { tenantId: string | null; id?: string }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payrollsService.post(user.tenantId, user.id ?? null, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(permission(ModuleName.HR, 'approve'))
  @ApiOperation({ summary: 'Cancel a draft payroll' })
  cancel(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payrollsService.cancel(user.tenantId, id);
  }
}
