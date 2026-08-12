import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CfdiCertificate,
  CfdiDocument,
  Customer,
  Invoice,
  InvoiceItem,
  Tenant,
} from '@aptifum/database';
import { TaxController } from './tax.controller';
import { CfdiService } from './cfdi.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CfdiDocument,
      CfdiCertificate,
      Invoice,
      InvoiceItem,
      Tenant,
      Customer,
    ]),
  ],
  controllers: [TaxController],
  providers: [CfdiService],
  exports: [CfdiService],
})
export class TaxModule {}
