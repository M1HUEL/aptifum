import { useEffect, useState } from 'react';
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
import { apiFetch, ApiError } from '../api/client';
import type { DashboardReport, ProductSalesRow, SalesSummary } from '../api/types';
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

export function DashboardPage() {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [topProducts, setTopProducts] = useState<ProductSalesRow[]>([]);
  const [groupBy, setGroupBy] = useState('month');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dashboard = await apiFetch<DashboardReport>('/api/v1/reports/dashboard');
        if (!cancelled) setReport(dashboard);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load the dashboard.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sales = await apiFetch<SalesSummary>(
          `/api/v1/reports/sales/summary?groupBy=${groupBy}`,
        );
        const products = await apiFetch<{ data: ProductSalesRow[] }>('/api/v1/reports/sales/by-product');
        if (!cancelled) {
          setSummary(sales);
          setTopProducts(products.data.slice(0, 8));
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load sales charts.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupBy]);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={report ? `As of ${formatDate(report.asOf)}` : 'Today’s activity'} />
      {error ? <ErrorBanner message={error} /> : null}
      {!report && !error ? <LoadingBlock /> : null}
      {report ? (
        <>
          <div className="stat-grid">
            <StatCard label="Sales today" value={formatMoney(report.salesToday)} />
            <StatCard label="Sales this month" value={formatMoney(report.salesMonth)} />
            <StatCard label="Net income (month)" value={formatMoney(report.netIncomeMonth)} />
            <StatCard label="Invoices (month)" value={String(report.monthInvoices)} />
            <StatCard label="Receivables" value={formatMoney(report.receivables)} />
            <StatCard label="Payables" value={formatMoney(report.payables)} />
            <StatCard label="Inventory value" value={formatMoney(report.inventoryValue)} />
            <StatCard label="Low stock products" value={String(report.lowStockProducts)} />
          </div>
          <div className="stat-grid">
            <StatCard label="Open purchase orders" value={String(report.openPurchaseOrders)} />
            <StatCard label="Production in progress" value={String(report.productionInProgress)} />
          </div>
        </>
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
            <p className="modal-message">No sales data yet.</p>
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
                    tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
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
