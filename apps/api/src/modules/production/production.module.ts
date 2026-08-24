import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Product,
  ProductStock,
  ProductionBom,
  ProductionBomLine,
  ProductionOrder,
  ProductionOrderLine,
  Tenant,
  Warehouse,
} from '@aptifum/database';

import { BomsController } from './boms.controller.js';
import { BomsService } from './boms.service.js';
import { ProductionOrdersController } from './production-orders.controller.js';
import { ProductionOrdersService } from './production-orders.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionBom,
      ProductionBomLine,
      ProductionOrder,
      ProductionOrderLine,
      Product,
      ProductStock,
      Warehouse,
      Tenant,
    ]),
  ],
  controllers: [BomsController, ProductionOrdersController],
  providers: [BomsService, ProductionOrdersService],
})
export class ProductionModule {}
