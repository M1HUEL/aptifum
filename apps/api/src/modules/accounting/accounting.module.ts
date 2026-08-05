import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingPeriod, ChartAccount, JournalEntry, JournalEntryLine } from '@aptifum/database';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChartAccount, AccountingPeriod, JournalEntry, JournalEntryLine])],
  controllers: [AccountsController, JournalEntriesController, PeriodsController],
  providers: [AccountsService, JournalEntriesService, PeriodsService],
})
export class AccountingModule {}
