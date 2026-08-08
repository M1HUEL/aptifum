import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { InventoryReportsController } from './inventory-reports.controller';
import { SalesReportsController } from './sales-reports.controller';
import { AgingReportsController } from './aging-reports.controller';
import { FinancialReportsController } from './financial-reports.controller';
import { HrReportsController } from './hr-reports.controller';
import { ReportsService } from './reports.service';

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
