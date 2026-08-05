import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountNormalBalance, round2 } from '@aptifum/core';

interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  active: boolean;
  debit: number;
  credit: number;
}

interface LedgerRow {
  number: string;
  entry_date: string;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  line_index: number;
  line_description: string | null;
  debit: number;
  credit: number;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async trialBalance(
    tenantId: string | null,
    opts: { periodId?: string; from?: string; to?: string },
  ) {
    this.assertTenant(tenantId);
    const { where, params } = this.buildPeriodFilter(tenantId, opts);
    const rows: TrialBalanceRow[] = await this.dataSource.query(
      `SELECT ca.id, ca.code, ca.name, ca.type AS account_type, ca.normal_balance, ca.active,
              COALESCE(SUM(jl.debit), 0)::numeric AS debit,
              COALESCE(SUM(jl.credit), 0)::numeric AS credit
         FROM journal_entry_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         JOIN chart_accounts ca ON ca.id = jl.account_id
        WHERE ${where}
          AND je.status <> 'draft'
          AND jl.deleted_at IS NULL AND je.deleted_at IS NULL AND ca.deleted_at IS NULL
        GROUP BY ca.id, ca.code, ca.name, ca.type, ca.normal_balance, ca.active
        ORDER BY ca.code`,
      params,
    );
    const data = rows
      .filter((row) => round2(row.debit) !== 0 || round2(row.credit) !== 0)
      .map((row) => {
        const debit = round2(Number(row.debit));
        const credit = round2(Number(row.credit));
        const balance =
          row.normal_balance === AccountNormalBalance.DEBIT
            ? round2(debit - credit)
            : round2(credit - debit);
        return {
          accountId: row.id,
          code: row.code,
          name: row.name,
          type: row.account_type,
          normalBalance: row.normal_balance,
          active: row.active,
          debit,
          credit,
          balance,
        };
      });
    const totals = data.reduce(
      (acc, row) => ({
        debit: round2(acc.debit + row.debit),
        credit: round2(acc.credit + row.credit),
      }),
      { debit: 0, credit: 0 },
    );
    return { data, totals };
  }

  async ledger(
    tenantId: string | null,
    accountId: string,
    opts: { from?: string; to?: string },
  ) {
    this.assertTenant(tenantId);
    const account = await this.dataSource.query(
      `SELECT id, code, name, normal_balance FROM chart_accounts
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [accountId, tenantId],
    );
    if (!account.length) {
      throw new NotFoundException('Chart account not found');
    }
    const { where, params } = this.buildDateFilter(tenantId, opts);
    const accountParam = `$${params.length + 1}`;
    const rows: LedgerRow[] = await this.dataSource.query(
      `SELECT je.number, je.entry_date, je.description, je.reference_type, je.reference_id,
              jl.line_index, jl.description AS line_description, jl.debit, jl.credit
         FROM journal_entry_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
        WHERE ${where}
          AND jl.account_id = ${accountParam}
          AND je.status <> 'draft'
          AND jl.deleted_at IS NULL AND je.deleted_at IS NULL
        ORDER BY je.entry_date, je.created_at, jl.line_index`,
      [...params, accountId],
    );
    let running = 0;
    const data = rows.map((row) => {
      const debit = round2(Number(row.debit));
      const credit = round2(Number(row.credit));
      running =
        account[0].normal_balance === AccountNormalBalance.DEBIT
          ? round2(running + debit - credit)
          : round2(running + credit - debit);
      return {
        entryNumber: row.number,
        entryDate: row.entry_date,
        description: row.description,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        lineIndex: row.line_index,
        lineDescription: row.line_description,
        debit,
        credit,
        balance: running,
      };
    });
    return { account: { id: accountId, code: account[0].code, name: account[0].name }, data };
  }

  private buildPeriodFilter(
    tenantId: string,
    opts: { periodId?: string; from?: string; to?: string },
  ): { where: string; params: unknown[] } {
    if (opts.periodId) {
      return { where: 'jl.tenant_id = $1 AND je.period_id = $2', params: [tenantId, opts.periodId] };
    }
    return this.buildDateFilter(tenantId, opts);
  }

  private buildDateFilter(
    tenantId: string,
    opts: { from?: string; to?: string },
  ): { where: string; params: unknown[] } {
    if (opts.from && opts.to) {
      return {
        where: 'jl.tenant_id = $1 AND je.entry_date >= $2 AND je.entry_date <= $3',
        params: [tenantId, opts.from, opts.to],
      };
    }
    if (opts.from) {
      return { where: 'jl.tenant_id = $1 AND je.entry_date >= $2', params: [tenantId, opts.from] };
    }
    if (opts.to) {
      return { where: 'jl.tenant_id = $1 AND je.entry_date <= $2', params: [tenantId, opts.to] };
    }
    return { where: 'jl.tenant_id = $1', params: [tenantId] };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
