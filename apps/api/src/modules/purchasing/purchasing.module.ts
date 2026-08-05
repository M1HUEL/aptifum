import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GoodsReceipt,
  GoodsReceiptItem,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  Warehouse,
} from '@aptifum/database';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      PurchaseOrder,
      PurchaseOrderItem,
      GoodsReceipt,
      GoodsReceiptItem,
      Product,
      Warehouse,
    ]),
  ],
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchasingModule {}
