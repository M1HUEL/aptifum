import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  GoodsReceipt,
  GoodsReceiptItem,
  Product,
  ProductSupplier,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierBill,
  SupplierBillItem,
  SupplierPayment,
  Warehouse,
} from '@aptifum/database';

import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module.js';

import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { ReordersService } from './reorders.service.js';
import { SupplierBillsController } from './supplier-bills.controller.js';
import { SupplierBillsService } from './supplier-bills.service.js';
import { SupplierPaymentsController } from './supplier-payments.controller.js';
import { SupplierPaymentsService } from './supplier-payments.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      SupplierBill,
      SupplierBillItem,
      SupplierPayment,
      PurchaseOrder,
      PurchaseOrderItem,
      GoodsReceipt,
      GoodsReceiptItem,
      Product,
      ProductSupplier,
      Warehouse,
    ]),
    ExchangeRatesModule,
  ],
  controllers: [SuppliersController, PurchaseOrdersController, SupplierBillsController, SupplierPaymentsController],
  providers: [SuppliersService, PurchaseOrdersService, ReordersService, SupplierBillsService, SupplierPaymentsService],
})
export class PurchasingModule {}
