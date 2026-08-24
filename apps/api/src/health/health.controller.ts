import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

import { Public } from '../modules/auth/decorators/public.decorator.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness and database check' })
  check() {
    return {
      status: 'ok',
      db: this.dataSource.isInitialized ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
