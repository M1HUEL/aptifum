import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExchangeRate } from '@aptifum/database';

import { ExchangeRatesController } from './exchange-rates.controller.js';
import { ExchangeRatesService } from './exchange-rates.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRate])],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
