import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('hr')
@Controller('hr/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.HR, 'read'))
  @ApiOperation({ summary: 'List departments' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
  ) {
    return this.departmentsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.HR, 'read'))
  @ApiOperation({ summary: 'Get department by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.departmentsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Create a department' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Update a department' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Delete a department' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.departmentsService.remove(user.tenantId, id);
  }
}
