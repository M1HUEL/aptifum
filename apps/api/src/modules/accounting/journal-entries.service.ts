import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { JournalEntryStatus, today } from '@aptifum/core';
import {
  ChartAccountNotFoundError,
  DocumentSeriesNotFoundError,
  JournalEntry,
  JournalEntryInvalidError,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  postJournalEntry,
} from '@aptifum/database';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';

@Injectable()
export class JournalEntriesService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly entriesRepo: Repository<JournalEntry>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<JournalEntry> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, periodId?: string) {
    const where: FindOptionsWhere<JournalEntry> = this.scoped(tenantId);
    if (periodId) {
      where.periodId = periodId;
    }
    const [rows, total] = await this.entriesRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { entryDate: 'DESC', createdAt: 'DESC' },
      relations: { lines: { account: true } },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const entry = await this.entriesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { lines: { account: true }, period: true },
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }
    return entry;
  }

  async create(tenantId: string | null, userId: string | null, dto: CreateJournalEntryDto) {
    this.assertTenant(tenantId);
    try {
      const entry = await this.dataSource.transaction((manager) =>
        postJournalEntry(manager, tenantId, {
          entryDate: dto.entryDate,
          description: dto.description ?? 'Manual entry',
          currency: dto.currency ?? 'USD',
          userId,
          lines: dto.lines.map((line) => ({
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
      description: line.description ?? undefined,
          })),
        }),
      );
      return this.findOne(tenantId, entry.id);
    } catch (error) {
      this.mapPostError(error);
    }
  }

  async reverse(tenantId: string | null, userId: string | null, id: string) {
    const entry = await this.findOne(tenantId, id);
    if (entry.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException('Only posted journal entries can be reversed');
    }
    if (entry.reversedByEntryId) {
      throw new BadRequestException('Journal entry already reversed');
    }
    const lines = entry.lines.map((line) => ({
      accountCode: line.account?.code ?? '',
      debit: line.credit,
      credit: line.debit,
      description: line.description ?? undefined,
    }));
    try {
      const reversal = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(JournalEntry);
        const current = await repo.findOneBy({ id: entry.id, tenantId: tenantId as string });
        if (!current) {
          throw new NotFoundException('Journal entry not found');
        }
        const posted = await postJournalEntry(manager, tenantId as string, {
          entryDate: today(),
          description: `Reversal of ${entry.number}`,
          referenceType: 'journal_reversal',
          referenceId: entry.id,
          currency: entry.currency,
          userId,
          lines,
        });
        current.reversedByEntryId = posted.id;
        current.status = JournalEntryStatus.REVERSED;
        await repo.save(current);
        return posted;
      });
      return this.findOne(tenantId, reversal.id);
    } catch (error) {
      this.mapPostError(error);
    }
  }

  private mapPostError(error: unknown): never {
    if (error instanceof ChartAccountNotFoundError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryInvalidError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryUnbalancedError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof JournalEntryPeriodClosedError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof DocumentSeriesNotFoundError) {
      throw new NotFoundException(error.message);
    }
    throw error;
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
