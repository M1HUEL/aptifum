import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { round2 } from '@aptifum/core';
import { InvoiceStatus, JournalEntryStatus, SupplierBillStatus } from '@aptifum/core';
import {
  ACCOUNT_CODES,
  Invoice,
  JournalEntry,
  SupplierBill,
  Tenant,
  postJournalEntry,
} from '@aptifum/database';
import type { JournalLineInput } from '@aptifum/database';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { CreateRevaluationDto } from './dto/create-revaluation.dto';

const REFERENCE_TYPE = 'fx_revaluation';

@Injectable()
export class RevaluationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async run(tenantId: string | null, userId: string | null, dto: CreateRevaluationDto) {
    this.assertTenant(tenantId);
    const date = dto.date ?? new Date().toISOString().slice(0, 10);
    const posted = await this.dataSource.transaction(async (manager) => {
      const tenant = await manager.getRepository(Tenant).findOneBy({ id: tenantId });
      const functional = tenant?.defaultCurrency ?? 'USD';
      const currency = dto.currency && dto.currency !== functional ? dto.currency : undefined;

      const invoiceRows = await this.revalueInvoices(manager, tenantId, userId, date, functional, currency);
      const billRows = await this.revalueBills(manager, tenantId, userId, date, functional, currency);
      return [...invoiceRows, ...billRows];
    });
    return { date, entries: posted };
  }

  private async revalueInvoices(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    date: string,
    functional: string,
    currency?: string,
  ) {
    const invoices = await manager.getRepository(Invoice).find({
      where: {
        tenantId,
        status: InvoiceStatus.ISSUED,
        currency: Not(functional),
        ...(currency ? { currency } : {}),
      },
    });
    const rows: Array<Record<string, unknown>> = [];
    for (const invoice of invoices) {
      const rate = await this.exchangeRates.resolveRate(tenantId, functional, invoice.currency, date);
      const booked = round2(invoice.balanceDue * (invoice.exchangeRate ?? 1));
      const target = round2(invoice.balanceDue * rate);
      const prior = await this.priorAdjustment(
        manager,
        tenantId,
        invoice.id,
        ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        true,
      );
      const current = round2(booked + prior);
      if (Math.abs(round2(target - current)) <= 0.005) {
        continue;
      }
      await this.reversePrior(manager, tenantId, userId, invoice.id, date);
      const adjustment = round2(target - booked);
      if (Math.abs(adjustment) <= 0.005) {
        continue;
      }
      const entry = await postJournalEntry(manager, tenantId, {
        entryDate: date,
        description: `FX revaluation invoice ${invoice.number}`,
        referenceType: REFERENCE_TYPE,
        referenceId: invoice.id,
        currency: functional,
        userId,
        lines:
          adjustment > 0
            ? [
                { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: adjustment },
                { accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_GAIN, credit: adjustment },
              ]
            : [
                { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, credit: -adjustment },
                { accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_LOSS, debit: -adjustment },
              ],
      });
      rows.push({
        documentType: 'invoice',
        documentId: invoice.id,
        number: invoice.number,
        currency: invoice.currency,
        balanceDue: invoice.balanceDue,
        rate,
        adjustment,
        entryId: entry.id,
      });
    }
    return rows;
  }

  private async revalueBills(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    date: string,
    functional: string,
    currency?: string,
  ) {
    const bills = await manager.getRepository(SupplierBill).find({
      where: {
        tenantId,
        status: In([SupplierBillStatus.ISSUED, SupplierBillStatus.PAID]),
        currency: Not(functional),
        ...(currency ? { currency } : {}),
      },
    });
    const rows: Array<Record<string, unknown>> = [];
    for (const bill of bills) {
      const rate = await this.exchangeRates.resolveRate(tenantId, functional, bill.currency, date);
      const booked = round2(bill.balanceDue * (bill.exchangeRate ?? 1));
      const target = round2(bill.balanceDue * rate);
      const prior = await this.priorAdjustment(
        manager,
        tenantId,
        bill.id,
        ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        false,
      );
      const current = round2(booked + prior);
      if (Math.abs(round2(target - current)) <= 0.005) {
        continue;
      }
      await this.reversePrior(manager, tenantId, userId, bill.id, date);
      const adjustment = round2(target - booked);
      if (Math.abs(adjustment) <= 0.005) {
        continue;
      }
      const entry = await postJournalEntry(manager, tenantId, {
        entryDate: date,
        description: `FX revaluation supplier bill ${bill.number}`,
        referenceType: REFERENCE_TYPE,
        referenceId: bill.id,
        currency: functional,
        userId,
        lines:
          adjustment > 0
            ? [
                { accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_LOSS, debit: adjustment },
                { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, credit: adjustment },
              ]
            : [
                { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, debit: -adjustment },
                { accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_GAIN, credit: -adjustment },
              ],
      });
      rows.push({
        documentType: 'supplier_bill',
        documentId: bill.id,
        number: bill.number,
        currency: bill.currency,
        balanceDue: bill.balanceDue,
        rate,
        adjustment,
        entryId: entry.id,
      });
    }
    return rows;
  }

  private async priorAdjustment(
    manager: EntityManager,
    tenantId: string,
    documentId: string,
    accountCode: string,
    positiveWhenDebit: boolean,
  ): Promise<number> {
    const entries = await manager.getRepository(JournalEntry).find({
      where: {
        tenantId,
        referenceType: REFERENCE_TYPE,
        referenceId: documentId,
        status: JournalEntryStatus.POSTED,
      },
      relations: { lines: { account: true } },
    });
    let sum = 0;
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.account?.code !== accountCode) {
          continue;
        }
        sum += positiveWhenDebit ? line.debit - line.credit : line.credit - line.debit;
      }
    }
    return round2(sum);
  }

  private async reversePrior(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    documentId: string,
    reversalDate: string,
  ): Promise<void> {
    const repo = manager.getRepository(JournalEntry);
    const prior = await repo.find({
      where: {
        tenantId,
        referenceType: REFERENCE_TYPE,
        referenceId: documentId,
        status: JournalEntryStatus.POSTED,
      },
      relations: { lines: { account: true } },
    });
    for (const entry of prior) {
      const lines: JournalLineInput[] = entry.lines.map((line) => ({
        accountCode: line.account?.code ?? '',
        debit: line.credit,
        credit: line.debit,
        description: line.description ?? undefined,
      }));
      const reversal = await postJournalEntry(manager, tenantId, {
        entryDate: reversalDate,
        description: `Reversal of ${entry.number}`,
        referenceType: 'journal_reversal',
        referenceId: entry.id,
        currency: entry.currency,
        userId,
        lines,
      });
      const current = await repo.findOneBy({ id: entry.id, tenantId });
      if (current) {
        current.reversedByEntryId = reversal.id;
        current.status = JournalEntryStatus.REVERSED;
        await repo.save(current);
      }
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
