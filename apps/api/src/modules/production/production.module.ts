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

import { BomsController } from './boms.controller';
import { BomsService } from './boms.service';
import { ProductionOrdersController } from './production-orders.controller';
import { ProductionOrdersService } from './production-orders.service';

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
