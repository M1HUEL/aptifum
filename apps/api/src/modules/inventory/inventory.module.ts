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

import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { ProductVariantsController } from './product-variants.controller.js';
import { ProductVariantsService } from './product-variants.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';
import { WarehousesController } from './warehouses.controller.js';
import { WarehousesService } from './warehouses.service.js';

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
