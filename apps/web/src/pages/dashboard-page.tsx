import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiError } from '../api/client';
import type { AlertsReport, DashboardReport, Paginated, ProductSalesRow, SalesSummary, Warehouse } from '../api/types';
import { useApiQuery } from '../api/hooks';
import {
  Badge,
  Card,
  ErrorBanner,
  formatDate,
  formatMoney,
  LoadingBlock,
  PageHeader,
  StatCard,
} from '../components/ui';

const groupOptions = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const rangeOptions = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

function rangeFor(preset: string): { from: string; to: string } {
  const to = new Date();
  const toStr = to.toISOString().slice(0, 10);
  const start = new Date(to);
  switch (preset) {
    case '7d':
      start.setDate(to.getDate() - 6);
      break;
    case '30d':
      start.setDate(to.getDate() - 29);
      break;
    case '90d':
      start.setDate(to.getDate() - 89);
      break;
    case 'month':
      start.setDate(1);
      break;
    case 'year':
      start.setMonth(0, 1);
      break;
    default:
      start.setFullYear(2000, 0, 1);
      break;
  }
  return { from: start.toISOString().slice(0, 10), to: toStr };
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 403) {
    return 'Your role does not have permission to view reports.';
  }
  if (err instanceof ApiError) return err.message;
  return fallback;
}

function StatusRow({
  label,
  count,
  warnThreshold,
}: {
  label: string;
  count: number;
  warnThreshold?: number;
}) {
  const warn = warnThreshold !== undefined && count >= warnThreshold;
  return (
    <div className="status-row">
      <span>{label}</span>
      <Badge tone={warn ? 'warning' : 'success'}>{count}</Badge>
    </div>
  );
}

function AlertSection({
  title,
  count,
  linkTo,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  linkTo: string;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="alert-head">
        <strong>{title}</strong>
        <Link className="alert-link" to={linkTo}>
          {count > 0 ? `View all (${count})` : emptyText}
        </Link>
      </div>
      {count > 0 ? <div className="status-list">{children}</div> : <p className="alert-empty">{emptyText}</p>}
    </div>
  );
}

export function DashboardPage() {
  const [groupBy, setGroupBy] = useState('month');
  const [preset, setPreset] = useState('month');
  const [warehouseId, setWarehouseId] = useState('');

  const { from, to } = useMemo(() => rangeFor(preset), [preset]);

  const reportParams = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (warehouseId) params.set('warehouseId', warehouseId);
    return params.toString();
  }, [from, to, warehouseId]);

  const warehousesQuery = useApiQuery<Paginated<Warehouse>>(
    ['warehouses', 'all'],
    '/api/v1/inventory/warehouses?page=1&limit=100',
  );

  const reportQuery = useApiQuery<DashboardReport>(
    ['dashboard', reportParams],
    `/api/v1/reports/dashboard?${reportParams}`,
  );

  const summaryQuery = useApiQuery<SalesSummary>(
    ['sales-summary', groupBy, reportParams],
    `/api/v1/reports/sales/summary?groupBy=${groupBy}&${reportParams}`,
  );

  const topProductsQuery = useApiQuery<{ data: ProductSalesRow[] }>(
    ['top-products', reportParams],
    `/api/v1/reports/sales/by-product?${reportParams}`,
  );

  const alertsQuery = useApiQuery<AlertsReport>(['alerts'], '/api/v1/reports/alerts?limit=5');

  const report = reportQuery.data;
  const summary = summaryQuery.data;
  const topProducts = topProductsQuery.data?.data.slice(0, 8) ?? [];
  const alerts = alertsQuery.data;
  const error = reportQuery.error ? errorMessage(reportQuery.error, 'Could not load the dashboard.') : null;

  const rangeLabel = rangeOptions.find((option) => option.value === preset)?.label ?? preset;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${rangeLabel} · ${formatDate(from)} → ${formatDate(to)}`}
      />
      <div className="toolbar">
        <select value={preset} onChange={(event) => setPreset(event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          <option value="">All warehouses</option>
          {(warehousesQuery.data?.data ?? []).map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {!report && !error ? <LoadingBlock /> : null}
      {report ? (
        <>
          <div className="stat-grid">
            <StatCard label="Revenue (period)" value={formatMoney(report.salesRange)} />
            <StatCard label="Net income (period)" value={formatMoney(report.netIncomeRange)} />
            <StatCard label="Invoices (period)" value={String(report.rangeInvoices)} />
            <StatCard label="Sales today" value={formatMoney(report.salesToday)} />
            <StatCard label="Sales this month" value={formatMoney(report.salesMonth)} />
            <StatCard label="Net income (month)" value={formatMoney(report.netIncomeMonth)} />
          </div>
          <div className="stat-grid">
            <StatCard label="Invoices (month)" value={String(report.monthInvoices)} />
            <StatCard label="Receivables" value={formatMoney(report.receivables)} />
            <StatCard label="Payables" value={formatMoney(report.payables)} />
            <StatCard label="Inventory value" value={formatMoney(report.inventoryValue)} />
            <StatCard label="Low stock products" value={String(report.lowStockProducts)} />
            <StatCard label="Open purchase orders" value={String(report.openPurchaseOrders)} />
          </div>
          <div className="stat-grid">
            <StatCard label="Production in progress" value={String(report.productionInProgress)} />
          </div>
        </>
      ) : null}

      {alerts ? (
        <Card title="Alerts">
          <div className="alert-grid">
            <AlertSection
              title="Low stock"
              count={alerts.summary.lowStock}
              linkTo="/stock"
              emptyText="All products above reorder level."
            >
              {alerts.lowStock.map((product) => (
                <div className="status-row" key={product.productId}>
                  <span>
                    {product.name}
                    <span className="text-muted"> ({product.sku})</span>
                  </span>
                  <Badge tone="warning">
                    {product.quantity} {product.unitOfMeasure}
                  </Badge>
                </div>
              ))}
            </AlertSection>
            <AlertSection
              title="Overdue receivables"
              count={alerts.summary.overdueReceivables}
              linkTo="/invoices"
              emptyText="No overdue invoices."
            >
              {alerts.overdueReceivables.map((invoice) => (
                <div className="status-row" key={invoice.invoiceId}>
                  <span>
                    {invoice.number}
                    <span className="text-muted"> · {invoice.customerName}</span>
                  </span>
                  <Badge tone="danger">{formatMoney(invoice.balanceDue)}</Badge>
                </div>
              ))}
            </AlertSection>
            <AlertSection
              title="Overdue payables"
              count={alerts.summary.overduePayables}
              linkTo="/purchasing"
              emptyText="No overdue payables."
            >
              {alerts.overduePayables.map((receipt) => (
                <div className="status-row" key={receipt.receiptId}>
                  <span>
                    {receipt.number}
                    <span className="text-muted"> · {receipt.supplierName}</span>
                  </span>
                  <Badge tone="danger">{formatMoney(receipt.outstanding)}</Badge>
                </div>
              ))}
            </AlertSection>
          </div>
        </Card>
      ) : null}

      <div className="chart-grid">
        <Card title="Sales trend">
          <div className="chart-controls">
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {summary ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={summary.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="var(--success)"
                    fill="var(--success)"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </Card>

        <Card title="Top products by revenue">
          {topProducts.length === 0 ? (
            <p className="modal-message">No sales data for this period.</p>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: string) =>
                      value.length > 16 ? `${value.slice(0, 15)}…` : value
                    }
                  />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="grossProfit" name="Gross profit" fill="var(--success)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {report ? (
        <Card title="Operational health">
          <div className="status-list">
            <StatusRow label="Open purchase orders" count={report.openPurchaseOrders} />
            <StatusRow label="Production orders in progress" count={report.productionInProgress} />
            <StatusRow label="Low stock products" count={report.lowStockProducts} warnThreshold={1} />
          </div>
        </Card>
      ) : null}
    </>
  );
}
