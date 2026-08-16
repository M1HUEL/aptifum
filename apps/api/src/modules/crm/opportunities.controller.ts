import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('crm')
@Controller('crm/opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'List opportunities' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('stage') stage?: string,
  ) {
    return this.opportunitiesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), stage);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'Get opportunity by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.opportunitiesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Create an opportunity' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(user.tenantId, dto);
  }

  @Post(':id/mark-won')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Mark an opportunity as won' })
  markWon(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.opportunitiesService.markWon(user.tenantId, id);
  }

  @Post(':id/mark-lost')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Mark an opportunity as lost' })
  markLost(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.opportunitiesService.markLost(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Update an opportunity' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Delete an opportunity' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.opportunitiesService.remove(user.tenantId, id);
  }
}
