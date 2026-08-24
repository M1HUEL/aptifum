import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CreateLeaveDto } from './dto/create-leave.dto.js';
import { UpdateLeaveDto } from './dto/update-leave.dto.js';
import { LeavesService } from './leaves.service.js';

@ApiTags('hr')
@Controller('hr/leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.HR, 'read'))
  @ApiOperation({ summary: 'List leaves' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('leaveType') leaveType?: string,
  ) {
    return this.leavesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), {
      employeeId,
      status,
      leaveType,
    });
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.HR, 'read'))
  @ApiOperation({ summary: 'Get leave by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.leavesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Request a leave' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateLeaveDto) {
    return this.leavesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Update a pending leave' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLeaveDto,
  ) {
    return this.leavesService.update(user.tenantId, id, dto);
  }

  @Post(':id/approve')
  @RequirePermissions(permission(ModuleName.HR, 'approve'))
  @ApiOperation({ summary: 'Approve a leave request' })
  approve(@CurrentUser() user: { tenantId: string | null; id?: string }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.leavesService.approve(user.tenantId, id, user.id ?? null);
  }

  @Post(':id/reject')
  @RequirePermissions(permission(ModuleName.HR, 'approve'))
  @ApiOperation({ summary: 'Reject a leave request' })
  reject(@CurrentUser() user: { tenantId: string | null; id?: string }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.leavesService.reject(user.tenantId, id, user.id ?? null);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Delete a pending leave' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.leavesService.remove(user.tenantId, id);
  }
}
