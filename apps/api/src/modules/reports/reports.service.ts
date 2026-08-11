import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountNormalBalance, MovementType, round2 } from '@aptifum/core';

interface AggregatedAccountRow {
  code: string;
  name: string;
  type: string;
  normal_balance: string;
  debit: number;
  credit: number;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async inventoryValuation(tenantId: string | null, opts: { warehouseId?: string }) {
    this.assertTenant(tenantId);
    const params: unknown[] = [tenantId];
    const where = ['ps.tenant_id = $1', 'ps.deleted_at IS NULL', 'ps.quantity <> 0'];
    if (opts.warehouseId) {
      params.push(opts.warehouseId);
      where.push(`ps.warehouse_id = $${params.length}`);
    }
    const rows: Array<{
      product_id: string;
      sku: string;
      name: string;
      unit_of_measure: string;
      warehouse_id: string;
      warehouse_code: string;
      quantity: number;
      average_cost: number;
      value: number;
    }> = await this.dataSource.query(
      `SELECT p.id AS product_id, p.sku, p.name, p.unit_of_measure,
              w.id AS warehouse_id, w.code AS warehouse_code,
              ps.quantity, ps.average_cost,
              ROUND((ps.quantity * ps.average_cost)::numeric, 2) AS value
         FROM product_stock ps
         JOIN products p ON p.id = ps.product_id AND p.tenant_id = ps.tenant_id AND p.deleted_at IS NULL
         JOIN warehouses w ON w.id = ps.warehouse_id AND w.tenant_id = ps.tenant_id AND w.deleted_at IS NULL
        WHERE ${where.join(' AND ')}
        ORDER BY p.name, w.code`,
      params,
    );
    const data = rows.map((row) => ({
      productId: row.product_id,
      sku: row.sku,
      name: row.name,
      unitOfMeasure: row.unit_of_measure,
      warehouseId: row.warehouse_id,
      warehouseCode: row.warehouse_code,
      quantity: Number(row.quantity),
      averageCost: round2(Number(row.average_cost)),
      value: round2(Number(row.value)),
    }));
    const totals = data.reduce(
      (acc, row) => ({
        quantity: acc.quantity + row.quantity,
        value: round2(acc.value + row.value),
      }),
      { quantity: 0, value: 0 },
    );
    return { data, totals };
  }

  async stockMovements(
    tenantId: string | null,
    opts: {
      productId?: string;
      warehouseId?: string;
      movementType?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    this.assertTenant(tenantId);
    if (opts.movementType && !(Object.values(MovementType) as string[]).includes(opts.movementType)) {
      throw new BadRequestException(`Invalid movement type: ${opts.movementType}`);
    }
    const params: unknown[] = [tenantId];
    const where = ['sm.tenant_id = $1', 'sm.deleted_at IS NULL'];
    if (opts.productId) {
      params.push(opts.productId);
      where.push(`sm.product_id = $${params.length}`);
    }
    if (opts.warehouseId) {
      params.push(opts.warehouseId);
      where.push(`sm.warehouse_id = $${params.length}`);
    }
    if (opts.movementType) {
      params.push(opts.movementType);
      where.push(`sm.movement_type = $${params.length}`);
    }
    const dateClause = this.buildDateClause('sm.occurred_at::date', opts, params);
    if (dateClause) {
      where.push(dateClause);
    }

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const limitParam = `$${params.length - 1}`;
    const offsetParam = `$${params.length}`;

    const rows: Array<{
      id: string;
      movement_type: string;
      quantity: number;
      unit_cost: number;
      occurred_at: string;
      reference_type: string | null;
      reference_id: string | null;
      user_id: string | null;
      notes: string | null;
      sku: string;
      name: string;
      warehouse_code: string | null;
    }> = await this.dataSource.query(
      `SELECT sm.id, sm.movement_type, sm.quantity, sm.unit_cost, sm.occurred_at,
              sm.reference_type, sm.reference_id, sm.user_id, sm.notes,
              p.sku, p.name, w.code AS warehouse_code
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id AND p.tenant_id = sm.tenant_id AND p.deleted_at IS NULL
         LEFT JOIN warehouses w ON w.id = sm.warehouse_id AND w.tenant_id = sm.tenant_id AND w.deleted_at IS NULL
        WHERE ${where.join(' AND ')}
        ORDER BY sm.occurred_at DESC, sm.id
        LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total
         FROM stock_movements sm
        WHERE ${where.join(' AND ')}`,
      params.slice(0, -2),
    );
    return {
      data: rows.map((row) => ({
        id: row.id,
        movementType: row.movement_type,
        quantity: Number(row.quantity),
        unitCost: round2(Number(row.unit_cost)),
        occurredAt: row.occurred_at,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        userId: row.user_id,
        notes: row.notes,
        productSku: row.sku,
        productName: row.name,
        warehouseCode: row.warehouse_code,
      })),
      meta: { page, limit, total: Number(countRows[0]?.total ?? 0) },
    };
  }

  async lowStock(tenantId: string | null, opts: { threshold?: number; warehouseId?: string }) {
    this.assertTenant(tenantId);
    const threshold = opts.threshold ?? 10;
    if (threshold < 0) {
      throw new BadRequestException('Threshold must be a non-negative number');
    }
    const params: unknown[] = [tenantId];
    const join = ['ps.product_id = p.id', 'ps.tenant_id = p.tenant_id', 'ps.deleted_at IS NULL'];
    if (opts.warehouseId) {
      params.push(opts.warehouseId);
      join.push(`ps.warehouse_id = $${params.length}`);
    }
    params.push(threshold);
    const thresholdParam = `$${params.length}`;
    const rows: Array<{
      product_id: string;
      sku: string;
      name: string;
      unit_of_measure: string;
      total_quantity: number;
    }> = await this.dataSource.query(
      `SELECT p.id AS product_id, p.sku, p.name, p.unit_of_measure,
              COALESCE(SUM(ps.quantity), 0) AS total_quantity
         FROM products p
         LEFT JOIN product_stock ps ON ${join.join(' AND ')}
        WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.enabled = true
        GROUP BY p.id, p.sku, p.name, p.unit_of_measure
       HAVING COALESCE(SUM(ps.quantity), 0) <= ${thresholdParam}
        ORDER BY total_quantity`,
      params,
    );
    return {
      threshold,
      data: rows.map((row) => ({
        productId: row.product_id,
        sku: row.sku,
        name: row.name,
        unitOfMeasure: row.unit_of_measure,
        totalQuantity: Number(row.total_quantity),
      })),
      totals: { lowStock: rows.length },
    };
  }

  async salesSummary(
    tenantId: string | null,
    opts: { from?: string; to?: string; groupBy?: string; warehouseId?: string },
  ) {
    this.assertTenant(tenantId);
    const groupBy = opts.groupBy ?? 'month';
    const formats: Record<string, string> = {
      day: 'YYYY-MM-DD',
      month: 'YYYY-MM',
      quarter: 'YYYY-"Q"Q',
      year: 'YYYY',
    };
    if (!formats[groupBy]) {
      throw new BadRequestException(`Invalid groupBy: ${groupBy} (day|month|quarter|year)`);
    }
    const params: unknown[] = [tenantId, formats[groupBy]];
    const where = [
      'i.tenant_id = $1',
      'i.deleted_at IS NULL',
      "i.status = 'issued'",
      this.buildDateClause('i.issue_date', opts, params),
      this.buildWarehouseClause('i.warehouse_id', opts.warehouseId, params),
    ];
    const rows: Array<{
      period: string;
      invoices: number;
      revenue: number;
      tax: number;
      total: number;
      credit_notes: number;
    }> = await this.dataSource.query(
      `SELECT TO_CHAR(i.issue_date, $2) AS period,
              COUNT(DISTINCT i.id) AS invoices,
              SUM(CASE WHEN i.type = 'invoice' THEN (i.subtotal - i.discount) ELSE -(i.subtotal - i.discount) END) AS revenue,
              SUM(CASE WHEN i.type = 'invoice' THEN i.tax ELSE -i.tax END) AS tax,
              SUM(CASE WHEN i.type = 'invoice' THEN i.total ELSE -i.total END) AS total,
              COUNT(*) FILTER (WHERE i.type = 'credit_note') AS credit_notes
         FROM invoices i
        WHERE ${where.filter(Boolean).join(' AND ')}
        GROUP BY 1
        ORDER BY 1`,
      params,
    );
    const data = rows.map((row) => ({
      period: row.period,
      invoices: Number(row.invoices),
      creditNotes: Number(row.credit_notes),
      revenue: round2(Number(row.revenue)),
      tax: round2(Number(row.tax)),
      total: round2(Number(row.total)),
    }));
    const totals = data.reduce(
      (acc, row) => ({
        invoices: acc.invoices + row.invoices,
        revenue: round2(acc.revenue + row.revenue),
        tax: round2(acc.tax + row.tax),
        total: round2(acc.total + row.total),
      }),
      { invoices: 0, revenue: 0, tax: 0, total: 0 },
    );
    return { groupBy, data, totals };
  }

  async salesByProduct(tenantId: string | null, opts: { from?: string; to?: string; warehouseId?: string }) {
    this.assertTenant(tenantId);
    const params: unknown[] = [tenantId];
    const salesDate = this.buildDateClause('i.issue_date', opts, params);
    const cogsDate = this.buildDateClause('sm.occurred_at::date', opts, params);
    const salesWarehouse = this.buildWarehouseClause('i.warehouse_id', opts.warehouseId, params);
    const cogsWarehouse = this.buildWarehouseClause('sm.warehouse_id', opts.warehouseId, params);
    const rows: Array<{
      product_id: string;
      sku: string;
      name: string;
      quantity: number;
      revenue: number;
      cogs: number;
    }> = await this.dataSource.query(
      `WITH revenue AS (
           SELECT ii.product_id,
                  SUM(CASE WHEN i.type = 'credit_note' THEN -ii.quantity ELSE ii.quantity END) AS quantity,
                  SUM(CASE WHEN i.type = 'credit_note' THEN -ii.line_total ELSE ii.line_total END) AS revenue
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id AND i.deleted_at IS NULL
            WHERE ii.tenant_id = $1 AND ii.deleted_at IS NULL AND i.status = 'issued'
              ${salesDate ? `AND ${salesDate}` : ''}
              ${salesWarehouse ? `AND ${salesWarehouse}` : ''}
            GROUP BY ii.product_id
         ),
         cogs AS (
           SELECT sm.product_id, SUM(-sm.quantity * sm.unit_cost) AS cogs
             FROM stock_movements sm
            WHERE sm.tenant_id = $1 AND sm.deleted_at IS NULL
              AND sm.reference_type IN ('invoice', 'credit_note')
              ${cogsDate ? `AND ${cogsDate}` : ''}
              ${cogsWarehouse ? `AND ${cogsWarehouse}` : ''}
            GROUP BY sm.product_id
         )
        SELECT p.id AS product_id, p.sku, p.name,
               COALESCE(r.quantity, 0) AS quantity,
               COALESCE(r.revenue, 0) AS revenue,
               COALESCE(c.cogs, 0) AS cogs
          FROM products p
          LEFT JOIN revenue r ON r.product_id = p.id
          LEFT JOIN cogs c ON c.product_id = p.id
         WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
           AND (r.product_id IS NOT NULL OR c.product_id IS NOT NULL)
         ORDER BY revenue DESC`,
      params,
    );
    const data = rows.map((row) => {
      const revenue = round2(Number(row.revenue));
      const cogs = round2(Number(row.cogs));
      const grossProfit = round2(revenue - cogs);
      const margin = revenue !== 0 ? round2(grossProfit / revenue) : 0;
      return {
        productId: row.product_id,
        sku: row.sku,
        name: row.name,
        quantity: Number(row.quantity),
        revenue,
        cogs,
        grossProfit,
        margin,
      };
    });
    const totals = data.reduce(
      (acc, row) => ({
        revenue: round2(acc.revenue + row.revenue),
        cogs: round2(acc.cogs + row.cogs),
        grossProfit: round2(acc.grossProfit + row.grossProfit),
      }),
      { revenue: 0, cogs: 0, grossProfit: 0 },
    );
    return { data, totals };
  }

  async salesByCustomer(tenantId: string | null, opts: { from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const params: unknown[] = [tenantId];
    const dateClause = this.buildDateClause('i.issue_date', opts, params);
    const rows: Array<{
      customer_id: string;
      code: string;
      trade_name: string;
      email: string | null;
      invoices: number;
      total_sold: number;
      total_paid: number;
      balance: number;
    }> = await this.dataSource.query(
      `SELECT c.id AS customer_id, c.code, c.trade_name, c.email,
              COUNT(DISTINCT i.id) AS invoices,
              SUM(CASE WHEN i.type = 'credit_note' THEN -(i.subtotal - i.discount) ELSE (i.subtotal - i.discount) END) AS total_sold,
              SUM(CASE WHEN i.type = 'invoice' THEN i.paid_amount ELSE 0 END) AS total_paid,
              SUM(CASE WHEN i.type = 'credit_note' THEN -i.total ELSE i.balance_due END) AS balance
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id AND c.tenant_id = i.tenant_id AND c.deleted_at IS NULL
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued'
          ${dateClause ? `AND ${dateClause}` : ''}
        GROUP BY c.id, c.code, c.trade_name, c.email
        ORDER BY total_sold DESC`,
      params,
    );
    const data = rows.map((row) => ({
      customerId: row.customer_id,
      code: row.code,
      tradeName: row.trade_name,
      email: row.email,
      invoices: Number(row.invoices),
      totalSold: round2(Number(row.total_sold)),
      totalPaid: round2(Number(row.total_paid)),
      balance: round2(Number(row.balance)),
    }));
    const totals = data.reduce(
      (acc, row) => ({
        totalSold: round2(acc.totalSold + row.totalSold),
        totalPaid: round2(acc.totalPaid + row.totalPaid),
        balance: round2(acc.balance + row.balance),
      }),
      { totalSold: 0, totalPaid: 0, balance: 0 },
    );
    return { data, totals };
  }

  async arAging(tenantId: string | null) {
    this.assertTenant(tenantId);
    const rows: Array<{
      customer_id: string;
      code: string;
      trade_name: string;
      credit_notes: number;
      current: number;
      days_1_30: number;
      days_31_60: number;
      days_61_90: number;
      days_90_plus: number;
      total_outstanding: number;
    }> = await this.dataSource.query(
      `SELECT c.id AS customer_id, c.code, c.trade_name,
              SUM(CASE WHEN i.type = 'credit_note' THEN -i.total ELSE 0 END) AS credit_notes,
              SUM(CASE WHEN i.type = 'invoice' AND i.balance_due > 0 AND (CURRENT_DATE - COALESCE(i.due_date, i.issue_date)) <= 0 THEN i.balance_due ELSE 0 END) AS current,
              SUM(CASE WHEN i.type = 'invoice' AND i.balance_due > 0 AND (CURRENT_DATE - COALESCE(i.due_date, i.issue_date)) BETWEEN 1 AND 30 THEN i.balance_due ELSE 0 END) AS days_1_30,
              SUM(CASE WHEN i.type = 'invoice' AND i.balance_due > 0 AND (CURRENT_DATE - COALESCE(i.due_date, i.issue_date)) BETWEEN 31 AND 60 THEN i.balance_due ELSE 0 END) AS days_31_60,
              SUM(CASE WHEN i.type = 'invoice' AND i.balance_due > 0 AND (CURRENT_DATE - COALESCE(i.due_date, i.issue_date)) BETWEEN 61 AND 90 THEN i.balance_due ELSE 0 END) AS days_61_90,
              SUM(CASE WHEN i.type = 'invoice' AND i.balance_due > 0 AND (CURRENT_DATE - COALESCE(i.due_date, i.issue_date)) > 90 THEN i.balance_due ELSE 0 END) AS days_90_plus,
              SUM(CASE WHEN i.type = 'invoice' THEN i.balance_due ELSE -i.total END) AS total_outstanding
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id AND c.tenant_id = i.tenant_id AND c.deleted_at IS NULL
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued'
          AND (i.balance_due > 0 OR i.type = 'credit_note')
        GROUP BY c.id, c.code, c.trade_name
        ORDER BY total_outstanding DESC`,
      [tenantId],
    );
    const data = rows.map((row) => ({
      customerId: row.customer_id,
      code: row.code,
      tradeName: row.trade_name,
      creditNotes: round2(Number(row.credit_notes)),
      current: round2(Number(row.current)),
      days1to30: round2(Number(row.days_1_30)),
      days31to60: round2(Number(row.days_31_60)),
      days61to90: round2(Number(row.days_61_90)),
      days90plus: round2(Number(row.days_90_plus)),
      totalOutstanding: round2(Number(row.total_outstanding)),
    }));
    const totals = this.sumBuckets(data);
    return { asOf: this.today(), data, totals };
  }

  async apAging(tenantId: string | null) {
    this.assertTenant(tenantId);
    const rows: Array<{
      supplier_id: string;
      code: string;
      trade_name: string;
      current: number;
      days_31_60: number;
      days_61_90: number;
      days_90_plus: number;
      total_outstanding: number;
    }> = await this.dataSource.query(
      `SELECT supplier_id, code, trade_name,
              SUM(CASE WHEN (CURRENT_DATE - ref_date) <= 30 THEN amount ELSE 0 END) AS current,
              SUM(CASE WHEN (CURRENT_DATE - ref_date) BETWEEN 31 AND 60 THEN amount ELSE 0 END) AS days_31_60,
              SUM(CASE WHEN (CURRENT_DATE - ref_date) BETWEEN 61 AND 90 THEN amount ELSE 0 END) AS days_61_90,
              SUM(CASE WHEN (CURRENT_DATE - ref_date) > 90 THEN amount ELSE 0 END) AS days_90_plus,
              SUM(amount) AS total_outstanding
         FROM (
           SELECT s.id AS supplier_id, s.code, s.trade_name, sb.bill_date AS ref_date, sb.balance_due AS amount
             FROM supplier_bills sb
             JOIN suppliers s ON s.id = sb.supplier_id AND s.tenant_id = sb.tenant_id AND s.deleted_at IS NULL
            WHERE sb.tenant_id = $1 AND sb.deleted_at IS NULL AND sb.status IN ('issued', 'paid')
           UNION ALL
           SELECT s.id AS supplier_id, s.code, s.trade_name, gr.received_at::date AS ref_date,
                  SUM(gri.quantity * gri.unit_cost) AS amount
             FROM goods_receipts gr
             JOIN goods_receipt_items gri ON gri.receipt_id = gr.id AND gri.tenant_id = gr.tenant_id AND gri.deleted_at IS NULL
             JOIN suppliers s ON s.id = gr.supplier_id AND s.tenant_id = gr.tenant_id AND s.deleted_at IS NULL
             LEFT JOIN supplier_bills sb2 ON sb2.receipt_id = gr.id AND sb2.tenant_id = gr.tenant_id AND sb2.deleted_at IS NULL AND sb2.status <> 'cancelled'
            WHERE gr.tenant_id = $1 AND gr.deleted_at IS NULL AND sb2.id IS NULL
            GROUP BY s.id, s.code, s.trade_name, gr.received_at::date
         ) u
        GROUP BY supplier_id, code, trade_name
        ORDER BY total_outstanding DESC`,
      [tenantId],
    );
    const payments: Array<{ supplier_id: string; total: number }> = await this.dataSource.query(
      `SELECT sp.supplier_id, COALESCE(SUM(sp.amount), 0) AS total
         FROM supplier_payments sp
        WHERE sp.tenant_id = $1 AND sp.deleted_at IS NULL AND sp.bill_id IS NULL
        GROUP BY sp.supplier_id`,
      [tenantId],
    );
    const paidBySupplier = new Map(payments.map((p) => [p.supplier_id, Number(p.total)]));
    const data = rows.map((row) => {
      let remaining = paidBySupplier.get(row.supplier_id) ?? 0;
      const buckets: Array<'days_90_plus' | 'days_61_90' | 'days_31_60' | 'current'> = [
        'days_90_plus',
        'days_61_90',
        'days_31_60',
        'current',
      ];
      for (const key of buckets) {
        const amount = Number(row[key]);
        const applied = Math.min(amount, remaining);
        row[key] = amount - applied;
        remaining = remaining - applied;
      }
      return {
        supplierId: row.supplier_id,
        code: row.code,
        tradeName: row.trade_name,
        current: round2(Number(row.current)),
        days31to60: round2(Number(row.days_31_60)),
        days61to90: round2(Number(row.days_61_90)),
        days90plus: round2(Number(row.days_90_plus)),
        totalOutstanding: round2(
          Math.max(
            0,
            Number(row.current) + Number(row.days_31_60) + Number(row.days_61_90) + Number(row.days_90_plus),
          ),
        ),
      };
    });
    const totals = data.reduce(
      (acc, row) => ({
        current: round2(acc.current + row.current),
        days31to60: round2(acc.days31to60 + row.days31to60),
        days61to90: round2(acc.days61to90 + row.days61to90),
        days90plus: round2(acc.days90plus + row.days90plus),
        totalOutstanding: round2(acc.totalOutstanding + row.totalOutstanding),
      }),
      { current: 0, days31to60: 0, days61to90: 0, days90plus: 0, totalOutstanding: 0 },
    );
    return { asOf: this.today(), data, totals };
  }

  async incomeStatement(
    tenantId: string | null,
    opts: { periodId?: string; from?: string; to?: string },
  ) {
    this.assertTenant(tenantId);
    const { where, params } = this.buildPeriodFilter(tenantId, opts);
    const rows: AggregatedAccountRow[] = await this.dataSource.query(
      `SELECT ca.code, ca.name, ca.type, ca.normal_balance,
              COALESCE(SUM(jl.debit), 0) AS debit,
              COALESCE(SUM(jl.credit), 0) AS credit
         FROM journal_entry_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         JOIN chart_accounts ca ON ca.id = jl.account_id
        WHERE ${where}
          AND je.status <> 'draft'
          AND jl.deleted_at IS NULL AND je.deleted_at IS NULL AND ca.deleted_at IS NULL
          AND ca.type IN ('revenue', 'expense')
        GROUP BY ca.code, ca.name, ca.type, ca.normal_balance
        ORDER BY ca.code`,
      params,
    );
    const accounts = rows.map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      balance: this.accountBalance(row),
    }));
    const revenueAccounts = accounts.filter((a) => a.type === 'revenue');
    const cogsAccounts = accounts.filter((a) => a.type === 'expense' && a.code.startsWith('5'));
    const expenseAccounts = accounts.filter((a) => a.type === 'expense' && !a.code.startsWith('5'));
    const revenue = this.total(revenueAccounts);
    const costOfSales = this.total(cogsAccounts);
    const operatingExpenses = this.total(expenseAccounts);
    const netIncome = round2(revenue - costOfSales - operatingExpenses);
    return {
      period: opts.periodId ? { periodId: opts.periodId } : { from: opts.from, to: opts.to },
      revenue: { accounts: revenueAccounts, total: revenue },
      costOfSales: { accounts: cogsAccounts, total: costOfSales },
      operatingExpenses: { accounts: expenseAccounts, total: operatingExpenses },
      netIncome,
    };
  }

  async balanceSheet(tenantId: string | null, opts: { asOf?: string }) {
    this.assertTenant(tenantId);
    const asOf = opts.asOf ?? this.today();
    const params: unknown[] = [tenantId, asOf];
    const rows: AggregatedAccountRow[] = await this.dataSource.query(
      `SELECT ca.code, ca.name, ca.type, ca.normal_balance,
              COALESCE(SUM(jl.debit), 0) AS debit,
              COALESCE(SUM(jl.credit), 0) AS credit
         FROM journal_entry_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         JOIN chart_accounts ca ON ca.id = jl.account_id
        WHERE jl.tenant_id = $1
          AND je.entry_date <= $2
          AND je.status <> 'draft'
          AND jl.deleted_at IS NULL AND je.deleted_at IS NULL AND ca.deleted_at IS NULL
          AND ca.type IN ('asset', 'liability', 'equity')
        GROUP BY ca.code, ca.name, ca.type, ca.normal_balance
        ORDER BY ca.code`,
      params,
    );
    const accounts = rows.map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      balance: this.accountBalance(row),
    }));
    const assets = this.total(accounts.filter((a) => a.type === 'asset'));
    const liabilities = this.total(accounts.filter((a) => a.type === 'liability'));
    const equityAccounts = accounts.filter((a) => a.type === 'equity');

    const periodStart = `${asOf.slice(0, 7)}-01`;
    const statement = await this.incomeStatement(tenantId, { from: periodStart, to: asOf });
    const netIncome = statement.netIncome;

    const equity = {
      accounts: [...equityAccounts, { code: '', name: 'Net income (current period)', type: 'equity', balance: netIncome }],
      total: round2(equityAccounts.reduce((sum, a) => sum + a.balance, 0) + netIncome),
    };
    const totalLiabilitiesAndEquity = round2(liabilities + equity.total);
    return {
      asOf,
      assets: { accounts: accounts.filter((a) => a.type === 'asset'), total: assets },
      liabilities: { accounts: accounts.filter((a) => a.type === 'liability'), total: liabilities },
      equity,
      totalAssets: assets,
      totalLiabilitiesAndEquity,
    };
  }

  async cashFlow(tenantId: string | null, opts: { from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const params: unknown[] = [tenantId];
    const where = [
      'jl.tenant_id = $1',
      "je.status <> 'draft'",
      'jl.deleted_at IS NULL AND je.deleted_at IS NULL AND ca.deleted_at IS NULL',
      "ca.code = '1000'",
    ];
    const dateClause = this.buildDateClause('je.entry_date', opts, params);
    if (dateClause) {
      where.push(dateClause);
    }
    const rows: Array<{ period: string; debit: number; credit: number }> =
      await this.dataSource.query(
        `SELECT to_char(je.entry_date, 'YYYY-MM') AS period,
                COALESCE(SUM(jl.debit), 0) AS debit,
                COALESCE(SUM(jl.credit), 0) AS credit
           FROM journal_entry_lines jl
           JOIN journal_entries je ON je.id = jl.entry_id
           JOIN chart_accounts ca ON ca.id = jl.account_id
          WHERE ${where.join(' AND ')}
          GROUP BY to_char(je.entry_date, 'YYYY-MM')
          ORDER BY to_char(je.entry_date, 'YYYY-MM')`,
        params,
      );

    let openingBalance = 0;
    if (opts.from) {
      const [opening]: Array<{ balance: number }> = await this.dataSource.query(
        `SELECT COALESCE(
                 SUM(CASE WHEN ca.normal_balance = 'debit' THEN jl.debit - jl.credit
                          ELSE jl.credit - jl.debit END), 0) AS balance
           FROM journal_entry_lines jl
           JOIN journal_entries je ON je.id = jl.entry_id
           JOIN chart_accounts ca ON ca.id = jl.account_id
          WHERE jl.tenant_id = $1
            AND je.status <> 'draft'
            AND jl.deleted_at IS NULL AND je.deleted_at IS NULL AND ca.deleted_at IS NULL
            AND ca.code = '1000'
            AND je.entry_date < $2`,
        [tenantId, opts.from],
      );
      openingBalance = round2(Number(opening?.balance ?? 0));
    }

    const buckets = new Map<string, { inflows: number; outflows: number }>();
    for (const row of rows) {
      const bucket = buckets.get(row.period) ?? { inflows: 0, outflows: 0 };
      bucket.inflows += Number(row.debit);
      bucket.outflows += Number(row.credit);
      buckets.set(row.period, bucket);
    }
    let running = openingBalance;
    const data = Array.from(buckets.entries()).map(([period, bucket]) => {
      const inflows = round2(bucket.inflows);
      const outflows = round2(bucket.outflows);
      const net = round2(inflows - outflows);
      running = round2(running + net);
      return { period, inflows, outflows, net, balance: running };
    });
    const totals = data.reduce(
      (acc, row) => ({
        inflows: round2(acc.inflows + row.inflows),
        outflows: round2(acc.outflows + row.outflows),
        net: round2(acc.net + row.net),
      }),
      { inflows: 0, outflows: 0, net: 0 },
    );
    return {
      from: opts.from ?? null,
      to: opts.to ?? null,
      openingBalance,
      closingBalance: data.length ? data[data.length - 1].balance : openingBalance,
      data,
      totals,
    };
  }

  async payrollSummary(tenantId: string | null, opts: { from?: string; to?: string }) {
    this.assertTenant(tenantId);
    const params: unknown[] = [tenantId];
    const where = ['hp.tenant_id = $1', 'hp.deleted_at IS NULL'];
    const dateClause = this.buildDateClause('hp.period', opts, params);
    if (dateClause) {
      where.push(dateClause);
    }
    const rows: Array<{
      period: string;
      payrolls: number;
      total_gross: number;
      total_deductions: number;
      total_net: number;
    }> = await this.dataSource.query(
      `SELECT hp.period,
              COUNT(*) AS payrolls,
              SUM(hp.total_gross) AS total_gross,
              SUM(hp.total_deductions) AS total_deductions,
              SUM(hp.total_net) AS total_net
         FROM hr_payrolls hp
        WHERE ${where.join(' AND ')}
        GROUP BY hp.period
        ORDER BY hp.period`,
      params,
    );
    const data = rows.map((row) => ({
      period: row.period,
      payrolls: Number(row.payrolls),
      totalGross: round2(Number(row.total_gross)),
      totalDeductions: round2(Number(row.total_deductions)),
      totalNet: round2(Number(row.total_net)),
    }));
    const totals = data.reduce(
      (acc, row) => ({
        payrolls: acc.payrolls + row.payrolls,
        totalGross: round2(acc.totalGross + row.totalGross),
        totalDeductions: round2(acc.totalDeductions + row.totalDeductions),
        totalNet: round2(acc.totalNet + row.totalNet),
      }),
      { payrolls: 0, totalGross: 0, totalDeductions: 0, totalNet: 0 },
    );
    return { data, totals };
  }

  async dashboard(tenantId: string | null, opts: { from?: string; to?: string } = {}) {
    this.assertTenant(tenantId);
    const today = this.today();
    const month = today.slice(0, 7);
    const monthStart = `${month}-01`;
    const from = opts.from ?? monthStart;
    const to = opts.to ?? today;

    const [salesToday]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued'
          AND i.type = 'invoice' AND i.issue_date = $2`,
      [tenantId, today],
    );
    const [salesMonth]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued'
          AND i.type = 'invoice' AND i.issue_date >= $2 AND i.issue_date <= $3`,
      [tenantId, monthStart, today],
    );
    const [monthInvoices]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM invoices i
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued'
          AND i.issue_date >= $2 AND i.issue_date <= $3`,
      [tenantId, monthStart, today],
    );
    const [salesRange]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued'
          AND i.type = 'invoice' AND i.issue_date >= $2 AND i.issue_date <= $3`,
      [tenantId, from, to],
    );
    const [rangeInvoices]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM invoices i
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued'
          AND i.issue_date >= $2 AND i.issue_date <= $3`,
      [tenantId, from, to],
    );
    const [receivables]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(i.balance_due), 0) AS total FROM invoices i
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued' AND i.type = 'invoice'`,
      [tenantId],
    );
    const [payables]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT
        COALESCE((SELECT SUM(sb.balance_due) FROM supplier_bills sb
                   WHERE sb.tenant_id = $1 AND sb.deleted_at IS NULL AND sb.status IN ('issued', 'paid')), 0)
        + COALESCE((SELECT SUM(gri.quantity * gri.unit_cost)
                      FROM goods_receipts gr
                      JOIN goods_receipt_items gri ON gri.receipt_id = gr.id AND gri.tenant_id = gr.tenant_id AND gri.deleted_at IS NULL
                      LEFT JOIN supplier_bills sb2 ON sb2.receipt_id = gr.id AND sb2.tenant_id = gr.tenant_id AND sb2.deleted_at IS NULL AND sb2.status <> 'cancelled'
                     WHERE gr.tenant_id = $1 AND gr.deleted_at IS NULL AND sb2.id IS NULL), 0)
        - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp
                     WHERE sp.tenant_id = $1 AND sp.deleted_at IS NULL AND sp.bill_id IS NULL), 0) AS total`,
      [tenantId],
    );
    const [inventoryValue]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(ps.quantity * ps.average_cost), 0) AS total
         FROM product_stock ps WHERE ps.tenant_id = $1 AND ps.deleted_at IS NULL`,
      [tenantId],
    );
    const [lowStock]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT p.id FROM products p
         LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.tenant_id = p.tenant_id AND ps.deleted_at IS NULL
         WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.enabled = true
         GROUP BY p.id HAVING COALESCE(SUM(ps.quantity), 0) <= 10
       ) s`,
      [tenantId],
    );
    const [openPurchaseOrders]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM purchase_orders po
        WHERE po.tenant_id = $1 AND po.deleted_at IS NULL AND po.status = 'approved'`,
      [tenantId],
    );
    const [productionInProgress]: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM production_orders po
        WHERE po.tenant_id = $1 AND po.deleted_at IS NULL AND po.status = 'in_progress'`,
      [tenantId],
    );
    const statement = await this.incomeStatement(tenantId, { from: monthStart, to: today });
    const rangeStatement =
      from === monthStart && to === today
        ? statement
        : await this.incomeStatement(tenantId, { from, to });
    return {
      asOf: today,
      salesToday: round2(Number(salesToday?.total ?? 0)),
      salesMonth: round2(Number(salesMonth?.total ?? 0)),
      monthInvoices: Number(monthInvoices?.total ?? 0),
      salesRange: round2(Number(salesRange?.total ?? 0)),
      rangeInvoices: Number(rangeInvoices?.total ?? 0),
      netIncomeRange: rangeStatement.netIncome,
      receivables: round2(Number(receivables?.total ?? 0)),
      payables: round2(Number(payables?.total ?? 0)),
      inventoryValue: round2(Number(inventoryValue?.total ?? 0)),
      lowStockProducts: Number(lowStock?.total ?? 0),
      openPurchaseOrders: Number(openPurchaseOrders?.total ?? 0),
      productionInProgress: Number(productionInProgress?.total ?? 0),
      netIncomeMonth: statement.netIncome,
    };
  }

  async alerts(tenantId: string | null, opts: { limit?: number } = {}) {
    this.assertTenant(tenantId);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
    const lowStockRows: Array<{
      product_id: string;
      sku: string;
      name: string;
      unit_of_measure: string;
      total_quantity: number;
    }> = await this.dataSource.query(
      `SELECT p.id AS product_id, p.sku, p.name, p.unit_of_measure,
              COALESCE(SUM(ps.quantity), 0) AS total_quantity
         FROM products p
         LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.tenant_id = p.tenant_id AND ps.deleted_at IS NULL
        WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.enabled = true
        GROUP BY p.id, p.sku, p.name, p.unit_of_measure
       HAVING COALESCE(SUM(ps.quantity), 0) <= 10
        ORDER BY total_quantity
        LIMIT $2`,
      [tenantId, limit],
    );
    const overdueReceivableRows: Array<{
      invoice_id: string;
      number: string;
      due_date: string | null;
      balance_due: number;
      customer_code: string;
      customer_name: string;
      days_overdue: number;
    }> = await this.dataSource.query(
      `SELECT i.id AS invoice_id, i.number, i.due_date, i.balance_due,
              c.code AS customer_code, c.trade_name AS customer_name,
              (CURRENT_DATE - COALESCE(i.due_date, i.issue_date)) AS days_overdue
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id AND c.tenant_id = i.tenant_id AND c.deleted_at IS NULL
        WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND i.status = 'issued' AND i.type = 'invoice'
          AND i.balance_due > 0 AND COALESCE(i.due_date, i.issue_date) < CURRENT_DATE
        ORDER BY days_overdue DESC
        LIMIT $2`,
      [tenantId, limit],
    );
    const overduePayableRows: Array<{
      receipt_id: string;
      number: string;
      received_at: string;
      supplier_code: string;
      supplier_name: string;
      outstanding: number;
      days_outstanding: number;
    }> = await this.dataSource.query(
      `SELECT receipt_id, number, received_at, supplier_code, supplier_name, outstanding, days_outstanding
         FROM (
           SELECT sb.id AS receipt_id, sb.number, sb.bill_date AS received_at,
                  s.code AS supplier_code, s.trade_name AS supplier_name,
                  sb.balance_due AS outstanding,
                  (CURRENT_DATE - sb.due_date::date) AS days_outstanding
             FROM supplier_bills sb
             JOIN suppliers s ON s.id = sb.supplier_id AND s.tenant_id = sb.tenant_id AND s.deleted_at IS NULL
            WHERE sb.tenant_id = $1 AND sb.deleted_at IS NULL
              AND sb.status = 'issued' AND sb.balance_due > 0
              AND sb.due_date IS NOT NULL AND sb.due_date::date < CURRENT_DATE
           UNION ALL
           SELECT gr.id AS receipt_id, gr.number, gr.received_at::date AS received_at,
                  s.code AS supplier_code, s.trade_name AS supplier_name,
                  SUM(gri.quantity * gri.unit_cost) AS outstanding,
                  (CURRENT_DATE - gr.received_at::date) AS days_outstanding
             FROM goods_receipts gr
             JOIN goods_receipt_items gri ON gri.receipt_id = gr.id AND gri.tenant_id = gr.tenant_id AND gri.deleted_at IS NULL
             JOIN suppliers s ON s.id = gr.supplier_id AND s.tenant_id = gr.tenant_id AND s.deleted_at IS NULL
             LEFT JOIN supplier_bills sb2 ON sb2.receipt_id = gr.id AND sb2.tenant_id = gr.tenant_id AND sb2.deleted_at IS NULL AND sb2.status <> 'cancelled'
            WHERE gr.tenant_id = $1 AND gr.deleted_at IS NULL
              AND sb2.id IS NULL
              AND gr.received_at::date < CURRENT_DATE - 30
            GROUP BY gr.id, gr.number, gr.received_at::date, s.code, s.trade_name
         ) sub
        ORDER BY days_outstanding DESC
        LIMIT $2`,
      [tenantId, limit],
    );
    return {
      asOf: this.today(),
      summary: {
        lowStock: lowStockRows.length,
        overdueReceivables: overdueReceivableRows.length,
        overduePayables: overduePayableRows.length,
      },
      lowStock: lowStockRows.map((row) => ({
        productId: row.product_id,
        sku: row.sku,
        name: row.name,
        unitOfMeasure: row.unit_of_measure,
        quantity: Number(row.total_quantity),
      })),
      overdueReceivables: overdueReceivableRows.map((row) => ({
        invoiceId: row.invoice_id,
        number: row.number,
        dueDate: row.due_date,
        balanceDue: round2(Number(row.balance_due)),
        customerCode: row.customer_code,
        customerName: row.customer_name,
        daysOverdue: Number(row.days_overdue),
      })),
      overduePayables: overduePayableRows.map((row) => ({
        receiptId: row.receipt_id,
        number: row.number,
        receivedAt: row.received_at,
        supplierCode: row.supplier_code,
        supplierName: row.supplier_name,
        outstanding: round2(Number(row.outstanding)),
        daysOutstanding: Number(row.days_outstanding),
      })),
    };
  }

  private accountBalance(row: AggregatedAccountRow): number {
    const debit = round2(Number(row.debit));
    const credit = round2(Number(row.credit));
    return row.normal_balance === AccountNormalBalance.DEBIT
      ? round2(debit - credit)
      : round2(credit - debit);
  }

  private total(accounts: Array<{ balance: number }>): number {
    return round2(accounts.reduce((sum, a) => sum + a.balance, 0));
  }

  private sumBuckets(
    rows: Array<{
      current: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      days90plus: number;
      totalOutstanding: number;
    }>,
  ) {
    return rows.reduce(
      (acc, row) => ({
        current: round2(acc.current + row.current),
        days1to30: round2(acc.days1to30 + row.days1to30),
        days31to60: round2(acc.days31to60 + row.days31to60),
        days61to90: round2(acc.days61to90 + row.days61to90),
        days90plus: round2(acc.days90plus + row.days90plus),
        totalOutstanding: round2(acc.totalOutstanding + row.totalOutstanding),
      }),
      { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, totalOutstanding: 0 },
    );
  }

  private buildPeriodFilter(
    tenantId: string,
    opts: { periodId?: string; from?: string; to?: string },
  ): { where: string; params: unknown[] } {
    if (opts.periodId) {
      return { where: 'jl.tenant_id = $1 AND je.period_id = $2', params: [tenantId, opts.periodId] };
    }
    const params: unknown[] = [tenantId];
    const clause = this.buildDateClause('je.entry_date', opts, params);
    return { where: `jl.tenant_id = $1${clause ? ` AND ${clause}` : ''}`, params };
  }

  private buildDateClause(
    column: string,
    opts: { from?: string; to?: string },
    params: unknown[],
  ): string {
    const parts: string[] = [];
    if (opts.from) {
      params.push(opts.from);
      parts.push(`${column} >= $${params.length}`);
    }
    if (opts.to) {
      params.push(opts.to);
      parts.push(`${column} <= $${params.length}`);
    }
    return parts.join(' AND ');
  }

  private buildWarehouseClause(
    column: string,
    warehouseId: string | undefined,
    params: unknown[],
  ): string {
    if (!warehouseId) {
      return '';
    }
    params.push(warehouseId);
    return `${column} = $${params.length}`;
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

