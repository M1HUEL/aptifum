import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  Product,
  ProductStock,
  StockMovement,
  Warehouse,
  WarehouseLocation,
} from '@aptifum/database';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Product,
      Warehouse,
      WarehouseLocation,
      ProductStock,
      StockMovement,
    ]),
  ],
  controllers: [
    CategoriesController,
    ProductsController,
    WarehousesController,
    StockController,
  ],
  providers: [CategoriesService, ProductsService, WarehousesService, StockService],
  exports: [ProductsService, StockService],
})
export class InventoryModule {}
