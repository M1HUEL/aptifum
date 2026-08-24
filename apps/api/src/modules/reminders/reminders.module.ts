import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutboxEvent } from '@aptifum/database';

import { RemindersService } from './reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
