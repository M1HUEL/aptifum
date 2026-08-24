import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Invoice, PaymentProviderConfig } from '@aptifum/database';

import { SalesModule } from '../sales/sales.module.js';

import { PaymentsController, WebhooksController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { StripeClient } from './stripe/stripe-client.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentProviderConfig, Invoice]), SalesModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, StripeClient],
})
export class PaymentsModule {}
