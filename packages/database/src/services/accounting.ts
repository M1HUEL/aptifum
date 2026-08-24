import { EntityManager, In } from 'typeorm';

import { AccountingPeriodStatus, DocumentSeriesKind, JournalEntryStatus, round2 } from '@aptifum/core';

import { AccountingPeriod } from '../entities/accounting-period.entity';
import { ChartAccount } from '../entities/chart-account.entity';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { JournalEntry } from '../entities/journal-entry.entity';

import { nextDocumentNumber } from './document-numbering';

export const ACCOUNT_CODES = {
  CASH: '1000',
  ACCOUNTS_RECEIVABLE: '1100',
  INVENTORY: '1200',
  ACCOUNTS_PAYABLE: '2000',
  OUTPUT_VAT: '2100',
  RETAINED_EARNINGS: '3000',
  SALES_REVENUE: '4000',
  SALES_RETURNS: '4100',
  FOREIGN_EXCHANGE_GAIN: '4200',
  COST_OF_GOODS_SOLD: '5000',
  PAYROLL_PAYABLE: '2001',
  PAYROLL_DEDUCTIONS_PAYABLE: '2002',
  PAYROLL_EXPENSE: '6000',
  FOREIGN_EXCHANGE_LOSS: '6100',
} as const;

export class ChartAccountNotFoundError extends Error {
  constructor(code: string) {
    super(`Chart account ${code} not found or inactive`);
    this.name = 'ChartAccountNotFoundError';
  }
}

export class JournalEntryUnbalancedError extends Error {
  constructor(debit: number, credit: number) {
    super(`Journal entry not balanced: debit ${debit} vs credit ${credit}`);
    this.name = 'JournalEntryUnbalancedError';
  }
}

export class JournalEntryInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JournalEntryInvalidError';
  }
}

export class JournalEntryPeriodClosedError extends Error {
  constructor(period: string) {
    super(`Accounting period ${period} is closed`);
    this.name = 'JournalEntryPeriodClosedError';
  }
}

export interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface PostJournalEntryInput {
  entryDate: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  currency?: string;
  userId?: string | null;
  lines: JournalLineInput[];
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1] ?? month} ${year}`;
}

function lastDayOfMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const last = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
  return `${period}-${String(last).padStart(2, '0')}`;
}

export async function resolvePeriod(
  manager: EntityManager,
  tenantId: string,
  entryDate: string,
): Promise<AccountingPeriod> {
  const period = entryDate.slice(0, 7);
  const repo = manager.getRepository(AccountingPeriod);
  let existing = await repo.findOneBy({ tenantId, period });
  if (!existing) {
    existing = await repo.save(
      repo.create({
        tenantId,
        period,
        label: periodLabel(period),
        startDate: `${period}-01`,
        endDate: lastDayOfMonth(period),
        status: AccountingPeriodStatus.OPEN,
      }),
    );
  }
  if (existing.status === AccountingPeriodStatus.CLOSED) {
    throw new JournalEntryPeriodClosedError(period);
  }
  return existing;
}

export async function postJournalEntry(
  manager: EntityManager,
  tenantId: string,
  input: PostJournalEntryInput,
): Promise<JournalEntry> {
  const lines = input.lines.map((line, index) => ({
    accountCode: line.accountCode,
    debit: round2(line.debit ?? 0),
    credit: round2(line.credit ?? 0),
    description: line.description ?? null,
    lineIndex: index,
  }));

  if (lines.length === 0) {
    throw new JournalEntryInvalidError('Journal entry requires at least one line');
  }
  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new JournalEntryInvalidError(`Line for ${line.accountCode} cannot have both debit and credit`);
    }
    if (line.debit <= 0 && line.credit <= 0) {
      throw new JournalEntryInvalidError(`Line for ${line.accountCode} must have a positive debit or credit`);
    }
  }
  const debitTotal = round2(lines.reduce((sum, line) => sum + line.debit, 0));
  const creditTotal = round2(lines.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(debitTotal - creditTotal) > 0.005) {
    throw new JournalEntryUnbalancedError(debitTotal, creditTotal);
  }

  const period = await resolvePeriod(manager, tenantId, input.entryDate);

  const accountsRepo = manager.getRepository(ChartAccount);
  const codes = [...new Set(lines.map((line) => line.accountCode))];
  const accounts = await accountsRepo.findBy({ tenantId, code: In(codes) });
  const accountsByCode = new Map(accounts.map((account) => [account.code, account]));

  const entriesRepo = manager.getRepository(JournalEntry);
  const linesRepo = manager.getRepository(JournalEntryLine);
  const { number } = await nextDocumentNumber(manager, tenantId, DocumentSeriesKind.JOURNAL_ENTRY);

  const entry = entriesRepo.create({
    tenantId,
    number,
    periodId: period.id,
    entryDate: input.entryDate,
    status: JournalEntryStatus.POSTED,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    currency: input.currency ?? 'USD',
    description: input.description ?? null,
    debitTotal,
    creditTotal,
    postedAt: new Date(),
    postedBy: input.userId ?? null,
    lines: lines.map((line) => {
      const account = accountsByCode.get(line.accountCode);
      if (!account || !account.active) {
        throw new ChartAccountNotFoundError(line.accountCode);
      }
      return linesRepo.create({
        tenantId,
        accountId: account.id,
        lineIndex: line.lineIndex,
        description: line.description,
        debit: line.debit,
        credit: line.credit,
      });
    }),
  });

  return entriesRepo.save(entry);
}
