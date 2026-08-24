import { Module } from '@nestjs/common';

import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
