import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '@aptifum/database';
import { TaxModule } from '../tax/tax.module';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent]), TaxModule],
  providers: [OutboxService, OutboxDispatcher],
  exports: [OutboxService],
})
export class OutboxModule {}
