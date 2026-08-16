import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CfdiCertificate, CfdiDocument, Customer, Invoice, InvoiceItem, Tenant } from '@aptifum/database';
import { TaxController } from './tax.controller';
import { CfdiService } from './cfdi.service';
import { UsSalesTaxService } from './us-sales-tax.service';

@Module({
  imports: [TypeOrmModule.forFeature([CfdiDocument, CfdiCertificate, Invoice, InvoiceItem, Tenant, Customer])],
  controllers: [TaxController],
  providers: [CfdiService, UsSalesTaxService],
  exports: [CfdiService, UsSalesTaxService],
})
export class TaxModule {}
