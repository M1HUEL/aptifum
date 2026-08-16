import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateLocationDto } from './dto/create-location.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('inventory')
@Controller('inventory/warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List warehouses' })
  list(@CurrentUser() user: { tenantId: string | null }, @Query() { page, limit }: PaginationQueryDto) {
    return this.warehousesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'Get warehouse by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.warehousesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Create a warehouse' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Update a warehouse' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Deactivate a warehouse' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.warehousesService.remove(user.tenantId, id);
  }

  @Get(':id/locations')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'read'))
  @ApiOperation({ summary: 'List warehouse locations' })
  listLocations(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.warehousesService.listLocations(user.tenantId, id);
  }

  @Post(':id/locations')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Add a warehouse location' })
  addLocation(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.warehousesService.addLocation(user.tenantId, id, dto);
  }

  @Patch(':id/locations/:locationId')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Update a warehouse location' })
  updateLocation(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.warehousesService.updateLocation(user.tenantId, id, locationId, dto);
  }

  @Delete(':id/locations/:locationId')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @ApiOperation({ summary: 'Deactivate a warehouse location' })
  removeLocation(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
  ) {
    return this.warehousesService.removeLocation(user.tenantId, id, locationId);
  }
}
