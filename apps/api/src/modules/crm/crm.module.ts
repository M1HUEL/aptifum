import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CrmActivity, CrmContact, CrmLead, CrmOpportunity, Customer, DocumentSeries } from '@aptifum/database';

import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrmContact, CrmLead, CrmOpportunity, CrmActivity, Customer, DocumentSeries])],
  controllers: [ContactsController, LeadsController, OpportunitiesController, ActivitiesController],
  providers: [ContactsService, LeadsService, OpportunitiesService, ActivitiesService],
})
export class CrmModule {}
