import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import {
  ACCOUNT_CODES,
  ChartAccountNotFoundError,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  Supplier,
  SupplierPayment,
  postJournalEntry,
} from '@aptifum/database';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    @InjectRepository(SupplierPayment)
    private readonly paymentsRepo: Repository<SupplierPayment>,
    @InjectRepository(Supplier) private readonly suppliersRepo: Repository<Supplier>,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  async record(
    tenantId: string | null,
    userId: string | null,
    dto: CreateSupplierPaymentDto,
  ) {
    this.assertTenant(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager.getRepository(Supplier).findOneBy({
        id: dto.supplierId,
        tenantId,
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
      const payment = await manager.getRepository(SupplierPayment).save(
        manager.getRepository(SupplierPayment).create({
          tenantId,
          supplierId: dto.supplierId,
          method: dto.method,
          amount: dto.amount,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
        }),
      );
      try {
        await postJournalEntry(manager, tenantId, {
          entryDate: payment.paidAt.toISOString().slice(0, 10),
          description: `Supplier payment ${payment.id.slice(0, 8)}`,
          referenceType: 'supplier_payment',
          referenceId: payment.id,
          currency: supplier.currency,
          userId,
          lines: [
            { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, debit: payment.amount },
            { accountCode: ACCOUNT_CODES.CASH, credit: payment.amount },
          ],
        });
      } catch (error) {
        this.mapPostError(error);
      }
      return this.paymentsRepo.findOne({
        where: { id: payment.id, tenantId },
        relations: { supplier: true },
      });
    });
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
