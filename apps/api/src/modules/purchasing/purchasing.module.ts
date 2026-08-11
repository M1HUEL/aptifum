import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GoodsReceipt,
  GoodsReceiptItem,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierBill,
  SupplierBillItem,
  SupplierPayment,
  Warehouse,
} from '@aptifum/database';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SupplierBillsController } from './supplier-bills.controller';
import { SupplierBillsService } from './supplier-bills.service';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { SupplierPaymentsService } from './supplier-payments.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

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
      Warehouse,
    ]),
  ],
  controllers: [
    SuppliersController,
    PurchaseOrdersController,
    SupplierBillsController,
    SupplierPaymentsController,
  ],
  providers: [
    SuppliersService,
    PurchaseOrdersService,
    SupplierBillsService,
    SupplierPaymentsService,
  ],
  exports: [PurchaseOrdersService],
})
export class PurchasingModule {}
