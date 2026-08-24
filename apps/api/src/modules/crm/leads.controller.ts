import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('crm')
@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'List leads' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('status') status?: string,
  ) {
    return this.leadsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), status);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'Get lead by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.leadsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Create a lead' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user.tenantId, dto);
  }

  @Post(':id/convert')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Convert a lead into a customer' })
  convert(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { customerCode?: string },
  ) {
    return this.leadsService.convert(user.tenantId, id, { customerCode: body?.customerCode });
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Update a lead' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Delete a lead' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.leadsService.remove(user.tenantId, id);
  }
}
