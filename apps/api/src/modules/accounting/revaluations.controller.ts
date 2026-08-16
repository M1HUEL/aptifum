import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { CreateRevaluationDto } from './dto/create-revaluation.dto';
import { RevaluationsService } from './revaluations.service';

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
