import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountType, ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('accounting')
@Controller('accounting/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'List chart accounts' })
  list(
    @CurrentUser() user: { tenantId: string | null },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: AccountType,
    @Query('q') q?: string,
  ) {
    return this.accountsService.findAll(
      user.tenantId,
      Number(page),
      Math.min(Number(limit), 100),
      type,
      q,
    );
  }

  @Get(':id')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'read'))
  @ApiOperation({ summary: 'Get chart account by id' })
  get(@CurrentUser() user: { tenantId: string | null }, @Param('id') id: string) {
    return this.accountsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Create a chart account' })
  create(@CurrentUser() user: { tenantId: string | null }, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Update a chart account' })
  update(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Deactivate a chart account' })
  remove(@CurrentUser() user: { tenantId: string | null }, @Param('id') id: string) {
    return this.accountsService.remove(user.tenantId, id);
  }
}
