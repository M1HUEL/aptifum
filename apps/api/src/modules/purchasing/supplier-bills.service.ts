import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import {
  ACCOUNT_CODES,
  ChartAccountNotFoundError,
  DocumentSeriesNotFoundError,
  GoodsReceipt,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  nextDocumentNumber as dbNextDocumentNumber,
  postJournalEntry,
  Supplier,
  SupplierBill,
  SupplierBillItem,
  Tenant,
} from '@aptifum/database';
import type { JournalLineInput } from '@aptifum/database';
import { OutboxService } from '../outbox/outbox.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { computeTotals, DocumentSeriesKind, SupplierBillStatus, round2 } from '@aptifum/core';
import { CreateSupplierBillDto } from './dto/create-supplier-bill.dto';

@Injectable()
export class SupplierBillsService {
  constructor(
    @InjectRepository(SupplierBill)
    private readonly billsRepo: Repository<SupplierBill>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<SupplierBill> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, supplierId?: string) {
    const where: FindOptionsWhere<SupplierBill> = this.scoped(tenantId);
    if (supplierId) {
      where.supplierId = supplierId;
    }
    const [rows, total] = await this.billsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { billDate: 'DESC', createdAt: 'DESC' },
      relations: { supplier: true, items: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const bill = await this.billsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { supplier: true, items: true },
    });
    if (!bill) {
      throw new NotFoundException('Supplier bill not found');
    }
    return bill;
  }

  async create(tenantId: string | null, userId: string | null, dto: CreateSupplierBillDto) {
    this.assertTenant(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager.getRepository(Supplier).findOneBy({
        id: dto.supplierId,
        tenantId,
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
      if (dto.receiptId) {
        const receipt = await manager.getRepository(GoodsReceipt).findOneBy({
          id: dto.receiptId,
          tenantId,
        });
        if (!receipt) {
          throw new NotFoundException('Goods receipt not found');
        }
        if (receipt.supplierId !== dto.supplierId) {
          throw new BadRequestException('Receipt belongs to a different supplier');
        }
        const existing = await manager.getRepository(SupplierBill).findOneBy({
          receiptId: dto.receiptId,
          tenantId,
          status: SupplierBillStatus.DRAFT,
        });
        if (existing) {
          throw new BadRequestException('A draft bill already exists for this receipt');
        }
      }
      const items = dto.items.map((line) =>
        manager.getRepository(SupplierBillItem).create({
          tenantId,
          productId: line.productId ?? null,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate ?? 0,
          lineTotal: round2(
            line.quantity * line.unitPrice + line.quantity * line.unitPrice * (line.taxRate ?? 0),
          ),
        }),
      );
      const totals = computeTotals(dto.items);
      const bill = manager.getRepository(SupplierBill).create({
        tenantId,
        supplierId: dto.supplierId,
        orderId: dto.orderId ?? null,
        receiptId: dto.receiptId ?? null,
        status: SupplierBillStatus.DRAFT,
        billDate: dto.billDate ?? this.today(),
        dueDate: dto.dueDate ?? null,
        currency: dto.currency ?? supplier.currency,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        paidAmount: 0,
        balanceDue: totals.total,
        notes: dto.notes ?? null,
        issuedAt: null,
        items,
      });
      const saved = await manager.getRepository(SupplierBill).save(bill);
      return this.billView(manager, saved.id, tenantId);
    });
  }

  async issue(tenantId: string | null, userId: string | null, id: string) {
    this.assertTenant(tenantId);
    const bill = await this.billsRepo.findOne({
      where: { id, tenantId },
      relations: { supplier: true },
    });
    if (!bill) {
      throw new NotFoundException('Supplier bill not found');
    }
    if (bill.status !== SupplierBillStatus.DRAFT) {
      throw new BadRequestException('Only draft supplier bills can be issued');
    }
    return this.dataSource.transaction(async (manager) => {
      const billsRepo = manager.getRepository(SupplierBill);
      const { number } = await this.nextNumber(manager, tenantId, DocumentSeriesKind.SUPPLIER_BILL);
      let receivedAmount = 0;
      if (bill.receiptId) {
        const receipt = await manager.getRepository(GoodsReceipt).findOne({
          where: { id: bill.receiptId, tenantId },
          relations: { items: true },
        });
        receivedAmount = round2(
          (receipt?.items ?? []).reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
        );
      }
      const functional = await this.functionalCurrency(manager, tenantId);
      const rate = await this.exchangeRates.resolveRate(
        tenantId,
        functional,
        bill.currency,
        bill.billDate,
      );
      bill.number = number;
      bill.status = SupplierBillStatus.ISSUED;
      bill.issuedAt = new Date();
      bill.exchangeRate = rate;
      const saved = await billsRepo.save(bill);
      const lines = this.billJournalLines(bill.total, receivedAmount, rate);
      if (lines.length > 0) {
        try {
          await postJournalEntry(manager, tenantId, {
            entryDate: bill.billDate,
            description: `Supplier bill ${number}`,
            referenceType: 'supplier_bill',
            referenceId: bill.id,
            currency: functional,
            userId,
            lines,
          });
        } catch (error) {
          this.mapPostError(error);
        }
      }
      await this.outbox.emit(manager, tenantId, {
        eventType: 'supplier_bill.issued',
        aggregateType: 'supplier_bill',
        aggregateId: bill.id,
        payload: {
          number,
          supplierId: bill.supplierId,
          total: bill.total,
          dueDate: bill.dueDate,
        },
        tenantId,
        userId,
      });
      return this.billView(manager, saved.id, tenantId);
    });
  }

  async cancel(tenantId: string | null, id: string) {
    const bill = await this.findOne(tenantId, id);
    if (bill.status !== SupplierBillStatus.DRAFT) {
      throw new BadRequestException('Only draft supplier bills can be cancelled');
    }
    bill.status = SupplierBillStatus.CANCELLED;
    return this.billsRepo.save(bill);
  }

  private billJournalLines(total: number, receivedAmount: number, rate: number): JournalLineInput[] {
    const difference = round2(round2(total * rate) - receivedAmount);
    if (Math.abs(difference) <= 0.005) {
      return [];
    }
    if (difference > 0) {
      return [
        { accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD, debit: difference },
        { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, credit: difference },
      ];
    }
    return [
      { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, debit: Math.abs(difference) },
      { accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD, credit: Math.abs(difference) },
    ];
  }

  private async functionalCurrency(manager: EntityManager, tenantId: string): Promise<string> {
    const tenant = await manager.getRepository(Tenant).findOneBy({ id: tenantId });
    return tenant?.defaultCurrency ?? 'USD';
  }

  private async billView(
    manager: EntityManager,
    id: string,
    tenantId: string,
  ): Promise<SupplierBill> {
    return manager.getRepository(SupplierBill).findOne({
      where: { id, tenantId },
      relations: { supplier: true, items: true },
    }) as Promise<SupplierBill>;
  }

  private async nextNumber(
    manager: EntityManager,
    tenantId: string,
    kind: DocumentSeriesKind,
  ): Promise<{ number: string; seriesId: string }> {
    try {
      return await dbNextDocumentNumber(manager, tenantId, kind);
    } catch (error) {
      if (error instanceof DocumentSeriesNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  private mapPostError(error: unknown): never {
    if (error instanceof ChartAccountNotFoundError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryPeriodClosedError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof JournalEntryUnbalancedError) {
      throw new ConflictException(error.message);
    }
    throw error;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
