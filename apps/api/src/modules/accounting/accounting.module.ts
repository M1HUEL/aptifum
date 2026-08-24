import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountingPeriod, ChartAccount, JournalEntry, JournalEntryLine } from '@aptifum/database';

import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module.js';

import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { JournalEntriesController } from './journal-entries.controller.js';
import { JournalEntriesService } from './journal-entries.service.js';
import { PeriodsController } from './periods.controller.js';
import { PeriodsService } from './periods.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { RevaluationsController } from './revaluations.controller.js';
import { RevaluationsService } from './revaluations.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChartAccount, AccountingPeriod, JournalEntry, JournalEntryLine]),
    ExchangeRatesModule,
  ],
  controllers: [
    AccountsController,
    JournalEntriesController,
    PeriodsController,
    ReportsController,
    RevaluationsController,
  ],
  providers: [AccountsService, JournalEntriesService, PeriodsService, ReportsService, RevaluationsService],
})
export class AccountingModule {}
