import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ModuleName, permission } from '@aptifum/core';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

import { CreateRevaluationDto } from './dto/create-revaluation.dto.js';
import { RevaluationsService } from './revaluations.service.js';

@ApiTags('accounting')
@Controller('accounting/revaluations')
export class RevaluationsController {
  constructor(private readonly revaluationsService: RevaluationsService) {}

  @Post()
  @RequirePermissions(permission(ModuleName.ACCOUNTING, 'write'))
  @ApiOperation({ summary: 'Revalue open foreign-currency balances' })
  run(@CurrentUser() user: { tenantId: string | null; id: string }, @Body() dto: CreateRevaluationDto) {
    return this.revaluationsService.run(user.tenantId, user.id, dto);
  }
}
