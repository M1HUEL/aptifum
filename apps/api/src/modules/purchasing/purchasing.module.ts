import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GoodsReceipt,
  GoodsReceiptItem,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierPayment,
  Warehouse,
} from '@aptifum/database';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { SupplierPaymentsService } from './supplier-payments.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      SupplierPayment,
      PurchaseOrder,
      PurchaseOrderItem,
      GoodsReceipt,
      GoodsReceiptItem,
      Product,
      Warehouse,
    ]),
  ],
  controllers: [
    SuppliersController,
    PurchaseOrdersController,
    SupplierPaymentsController,
  ],
  providers: [SuppliersService, PurchaseOrdersService, SupplierPaymentsService],
  exports: [PurchaseOrdersService],
})
export class PurchasingModule {}
