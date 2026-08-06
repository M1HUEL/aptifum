import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModuleName, permission } from '@aptifum/core';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { BomsService } from './boms.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@ApiTags('production')
@Controller('production/boms')
export class BomsController {
  constructor(private readonly bomsService: BomsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'read'))
  @ApiOperation({ summary: 'List BOMs' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
  ) {
    return this.bomsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100));
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'read'))
  @ApiOperation({ summary: 'Get BOM by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bomsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Create a BOM' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateBomDto) {
    return this.bomsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Update a BOM' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBomDto,
  ) {
    return this.bomsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.PRODUCTION, 'write'))
  @ApiOperation({ summary: 'Delete a BOM' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.bomsService.remove(user.tenantId, id);
  }
}
