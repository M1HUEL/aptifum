import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CrmActivity, CrmContact, CrmLead, CrmOpportunity, Customer, DocumentSeries } from '@aptifum/database';

import { ActivitiesController } from './activities.controller.js';
import { ActivitiesService } from './activities.service.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';
import { OpportunitiesController } from './opportunities.controller.js';
import { OpportunitiesService } from './opportunities.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CrmContact, CrmLead, CrmOpportunity, CrmActivity, Customer, DocumentSeries])],
  controllers: [ContactsController, LeadsController, OpportunitiesController, ActivitiesController],
  providers: [ContactsService, LeadsService, OpportunitiesService, ActivitiesService],
})
export class CrmModule {}
