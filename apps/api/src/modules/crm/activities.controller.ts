import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('crm')
@Controller('crm/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'List activities (filter by referenceType/referenceId)' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('referenceType') referenceType?: string,
    @Query('referenceId') referenceId?: string,
    @Query('q') q?: string,
  ) {
    return this.activitiesService.findAll(
      user.tenantId,
      Number(page),
      Math.min(Number(limit), 100),
      { referenceType, referenceId, q },
    );
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'Get activity by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.activitiesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Create an activity' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Update an activity' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Delete an activity' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.activitiesService.remove(user.tenantId, id);
  }
}
