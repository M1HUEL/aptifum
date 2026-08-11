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
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { DocumentSeriesController } from './document-series.controller';
import { DocumentSeriesService } from './document-series.service';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TaxesController } from './taxes.controller';
import { TaxesService } from './taxes.service';

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
  ],
  controllers: [
    CustomersController,
    TaxesController,
    DocumentSeriesController,
    OrdersController,
    InvoicesController,
  ],
  providers: [
    CustomersService,
    TaxesService,
    DocumentSeriesService,
    OrdersService,
    InvoicesService,
  ],
  exports: [InvoicesService],
})
export class SalesModule {}
