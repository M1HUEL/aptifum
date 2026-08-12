import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice, PaymentProviderConfig } from '@aptifum/database';
import { SalesModule } from '../sales/sales.module';
import { PaymentsController, WebhooksController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeClient } from './stripe/stripe-client.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentProviderConfig, Invoice]), SalesModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, StripeClient],
})
export class PaymentsModule {}
