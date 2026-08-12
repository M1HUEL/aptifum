import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingPeriod, ChartAccount, JournalEntry, JournalEntryLine } from '@aptifum/database';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { RevaluationsController } from './revaluations.controller';
import { RevaluationsService } from './revaluations.service';

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
