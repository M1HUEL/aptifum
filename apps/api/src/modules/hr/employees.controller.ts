import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ALL_PERMISSIONS, ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { PermissionsService } from '../rbac/rbac.service.js';

import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('hr')
@Controller('hr/employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  private async canViewSalary(userId?: string): Promise<boolean> {
    if (!userId) {
      return false;
    }
    const permissions = await this.permissionsService.permissionsFor(userId);
    return permissions.includes(ALL_PERMISSIONS) || permissions.includes(permission(ModuleName.HR, 'approve'));
  }

  @Get()
  @RequirePermissions(permission(ModuleName.HR, 'read'))
  @ApiOperation({ summary: 'List employees' })
  async list(
    @CurrentUser() user: { tenantId: string | null; id?: string },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('q') q?: string,
  ) {
    const includeSalary = await this.canViewSalary(user.id);
    return this.employeesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), q, includeSalary);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.HR, 'read'))
  @ApiOperation({ summary: 'Get employee by id' })
  async get(
    @CurrentUser() user: { tenantId: string | null; id?: string },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const includeSalary = await this.canViewSalary(user.id);
    return this.employeesService.findOne(user.tenantId, id, includeSalary);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Create an employee' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Update an employee' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.HR, 'write'))
  @ApiOperation({ summary: 'Delete an employee' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.employeesService.remove(user.tenantId, id);
  }
}
