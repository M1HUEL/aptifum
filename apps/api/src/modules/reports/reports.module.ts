import { Module } from '@nestjs/common';

import { AgingReportsController } from './aging-reports.controller.js';
import { FinancialReportsController } from './financial-reports.controller.js';
import { HrReportsController } from './hr-reports.controller.js';
import { InventoryReportsController } from './inventory-reports.controller.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { SalesReportsController } from './sales-reports.controller.js';

@Module({
  controllers: [
    ReportsController,
    InventoryReportsController,
    SalesReportsController,
    AgingReportsController,
    FinancialReportsController,
    HrReportsController,
  ],
  providers: [ReportsService],
})
export class ReportsModule {}
