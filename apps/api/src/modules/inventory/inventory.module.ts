import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  Product,
  ProductLot,
  ProductStock,
  ProductVariant,
  StockMovement,
  Warehouse,
  WarehouseLocation,
} from '@aptifum/database';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';
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
      ProductVariant,
      Warehouse,
      WarehouseLocation,
      ProductStock,
      StockMovement,
      ProductLot,
    ]),
  ],
  controllers: [
    CategoriesController,
    ProductsController,
    ProductVariantsController,
    WarehousesController,
    StockController,
  ],
  providers: [CategoriesService, ProductsService, ProductVariantsService, WarehousesService, StockService],
})
export class InventoryModule {}
