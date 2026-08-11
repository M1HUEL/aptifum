import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer, Invoice, Supplier } from '@aptifum/database';
import { EmailNotificationsService } from './email-notifications.service';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Customer, Invoice, Supplier])],
  providers: [EmailService, EmailNotificationsService],
  exports: [EmailService, EmailNotificationsService],
})
export class EmailModule {}
