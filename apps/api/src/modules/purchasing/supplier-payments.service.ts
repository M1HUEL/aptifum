import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import {
  ACCOUNT_CODES,
  ChartAccountNotFoundError,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  Supplier,
  SupplierBill,
  SupplierPayment,
  Tenant,
  postJournalEntry,
} from '@aptifum/database';
import type { JournalLineInput } from '@aptifum/database';
import { SupplierBillStatus, round2 } from '@aptifum/core';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    @InjectRepository(SupplierPayment)
    private readonly paymentsRepo: Repository<SupplierPayment>,
    @InjectRepository(Supplier) private readonly suppliersRepo: Repository<Supplier>,
    @InjectRepository(SupplierBill) private readonly billsRepo: Repository<SupplierBill>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<SupplierPayment> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, supplierId?: string) {
    const where: FindOptionsWhere<SupplierPayment> = this.scoped(tenantId);
    if (supplierId) {
      where.supplierId = supplierId;
    }
    const [rows, total] = await this.paymentsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { paidAt: 'DESC' },
      relations: { supplier: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async record(tenantId: string | null, userId: string | null, dto: CreateSupplierPaymentDto) {
    this.assertTenant(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager.getRepository(Supplier).findOneBy({
        id: dto.supplierId,
        tenantId,
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
      let bill: SupplierBill | null = null;
      if (dto.billId) {
        bill = await manager.getRepository(SupplierBill).findOneBy({
          id: dto.billId,
          tenantId,
        });
        if (!bill) {
          throw new NotFoundException('Supplier bill not found');
        }
        if (bill.supplierId !== dto.supplierId) {
          throw new BadRequestException('Bill belongs to a different supplier');
        }
        if (bill.status !== SupplierBillStatus.ISSUED) {
          throw new BadRequestException('Only issued supplier bills can be paid');
        }
        if (round2(dto.amount - bill.balanceDue) > 0.005) {
          throw new BadRequestException(`Payment exceeds balance due ${bill.balanceDue} for bill ${bill.number}`);
        }
      }
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      const functional = await this.functionalCurrency(manager, tenantId);
      const rate = await this.exchangeRates.resolveRate(
        tenantId,
        functional,
        supplier.currency,
        paidAt.toISOString().slice(0, 10),
      );
      const payment = await manager.getRepository(SupplierPayment).save(
        manager.getRepository(SupplierPayment).create({
          tenantId,
          supplierId: dto.supplierId,
          billId: dto.billId ?? null,
          method: dto.method,
          amount: dto.amount,
          paidAt,
          exchangeRate: rate,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
        }),
      );
      try {
        const bookedRate = bill?.exchangeRate ?? rate;
        const settled = round2(payment.amount * bookedRate);
        const paid = round2(payment.amount * rate);
        const fx = round2(paid - settled);
        const lines: JournalLineInput[] = [
          { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, debit: settled },
          { accountCode: ACCOUNT_CODES.CASH, credit: paid },
        ];
        if (fx > 0.005) {
          lines.push({ accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_LOSS, debit: fx });
        } else if (fx < -0.005) {
          lines.push({ accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_GAIN, credit: -fx });
        }
        await postJournalEntry(manager, tenantId, {
          entryDate: payment.paidAt.toISOString().slice(0, 10),
          description: `Supplier payment ${payment.id.slice(0, 8)}`,
          referenceType: 'supplier_payment',
          referenceId: payment.id,
          currency: functional,
          userId,
          lines,
        });
      } catch (error) {
        this.mapPostError(error);
      }
      if (bill) {
        bill.paidAmount = round2(bill.paidAmount + payment.amount);
        bill.balanceDue = round2(bill.balanceDue - payment.amount);
        if (bill.balanceDue <= 0.005) {
          bill.status = SupplierBillStatus.PAID;
          bill.balanceDue = 0;
        }
        await manager.getRepository(SupplierBill).save(bill);
      }
      return manager.getRepository(SupplierPayment).findOne({
        where: { id: payment.id, tenantId },
        relations: { supplier: true, bill: true },
      });
    });
  }

  private async functionalCurrency(manager: EntityManager, tenantId: string): Promise<string> {
    const tenant = await manager.getRepository(Tenant).findOneBy({ id: tenantId });
    return tenant?.defaultCurrency ?? 'USD';
  }

  private mapPostError(error: unknown): never {
    if (error instanceof ChartAccountNotFoundError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryPeriodClosedError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryUnbalancedError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
