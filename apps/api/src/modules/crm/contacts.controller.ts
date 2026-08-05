import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('crm')
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'List contacts' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
  ) {
    return this.contactsService.findAll(user.tenantId, Number(page), Math.min(Number(limit), 100), q);
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'read'))
  @ApiOperation({ summary: 'Get contact by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id') id: string) {
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
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.CRM, 'write'))
  @ApiOperation({ summary: 'Delete a contact' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id') id: string) {
    return this.contactsService.remove(user.tenantId, id);
  }
}
