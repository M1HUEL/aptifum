import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { DocumentSeriesService } from './document-series.service';
import { CreateSeriesDto } from './dto/create-series.dto';

@ApiTags('sales')
@Controller('sales/document-series')
export class DocumentSeriesController {
  constructor(private readonly documentSeriesService: DocumentSeriesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.INVOICING, 'read'))
  @ApiOperation({ summary: 'List document series' })
  list(@CurrentUser() user: { tenantId: string | null }) {
    return this.documentSeriesService.findAll(user.tenantId);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.INVOICING, 'write'))
  @ApiOperation({ summary: 'Create a document series' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateSeriesDto) {
    return this.documentSeriesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.INVOICING, 'write'))
  @ApiOperation({ summary: 'Update a document series' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id') id: string,
    @Body() dto: CreateSeriesDto,
  ) {
    return this.documentSeriesService.update(user.tenantId, id, dto);
  }
}
