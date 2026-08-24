import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Customer,
  DocumentSeries,
  IdempotencyKey,
  Invoice,
  InvoiceItem,
  Payment,
  Product,
  ProductVariant,
  SalesOrder,
  SalesOrderItem,
  Tax,
  Tenant,
  Warehouse,
} from '@aptifum/database';

import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module.js';
import { TaxModule } from '../tax/tax.module.js';

import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { DocumentSeriesController } from './document-series.controller.js';
import { DocumentSeriesService } from './document-series.service.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { TaxesController } from './taxes.controller.js';
import { TaxesService } from './taxes.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Tax,
      DocumentSeries,
      SalesOrder,
      SalesOrderItem,
      Invoice,
      InvoiceItem,
      Payment,
      IdempotencyKey,
      Product,
      ProductVariant,
      Warehouse,
      Tenant,
    ]),
    ExchangeRatesModule,
    TaxModule,
  ],
  controllers: [CustomersController, TaxesController, DocumentSeriesController, OrdersController, InvoicesController],
  providers: [CustomersService, TaxesService, DocumentSeriesService, OrdersService, InvoicesService],
  exports: [InvoicesService],
})
export class SalesModule {}
