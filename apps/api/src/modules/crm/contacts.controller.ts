import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { ContactsService } from './contacts.service.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { UpdateContactDto } from './dto/update-contact.dto.js';

@ApiTags('crm')
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'List contacts' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query() { page, limit }: PaginationQueryDto,
    @Query('q') q?: string,
  ) {
    return this.contactsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), q);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'Get contact by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.contactsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Create a contact' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Update a contact' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Delete a contact' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.contactsService.remove(user.tenantId, id);
  }
}
