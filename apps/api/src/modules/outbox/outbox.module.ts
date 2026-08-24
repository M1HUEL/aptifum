import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutboxEvent } from '@aptifum/database';

import { TaxModule } from '../tax/tax.module.js';

import { OutboxDispatcher } from './outbox.dispatcher.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent]), TaxModule],
  providers: [OutboxService, OutboxDispatcher],
  exports: [OutboxService],
})
export class OutboxModule {}
