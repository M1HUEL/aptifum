import { Body, Controller, Get, Param, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JournalEntriesService } from './journal-entries.service';

@ApiTags('accounting')
@Controller('accounting/journal-entries')
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'List journal entries' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('periodId') periodId?: string,
  ) {
    return this.journalEntriesService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), periodId);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'Get journal entry by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.journalEntriesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Post a manual journal entry' })
  create(@CurrentUser() user: { tenantId: string | null; id: string }, @Body() dto: CreateJournalEntryDto) {
    return this.journalEntriesService.create(user.tenantId, user.id, dto);
  }

  @Post(':id/reverse')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Reverse a posted journal entry' })
  reverse(@CurrentUser() user: { tenantId: string | null; id: string }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.journalEntriesService.reverse(user.tenantId, user.id, id);
  }
}
