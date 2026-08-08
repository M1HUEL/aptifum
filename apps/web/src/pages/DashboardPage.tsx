import { useEffect, useMemo, useState } from 'react';
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
import type { DashboardReport, Paginated, ProductSalesRow, SalesSummary, Warehouse } from '../api/types';
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
import { Select } from '../components/forms';

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

export function DashboardPage() {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [topProducts, setTopProducts] = useState<ProductSalesRow[]>([]);
  const [groupBy, setGroupBy] = useState('month');
  const [preset, setPreset] = useState('month');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => rangeFor(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Paginated<Warehouse>>('/api/v1/inventory/warehouses?page=1&limit=100')
      .then((result) => {
        if (!cancelled) setWarehouses(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ from, to });
        if (warehouseId) params.set('warehouseId', warehouseId);
        const query = `?${params.toString()}`;
        const dashboard = await apiFetch<DashboardReport>(`/api/v1/reports/dashboard${query}`);
        const sales = await apiFetch<SalesSummary>(
          `/api/v1/reports/sales/summary?groupBy=${groupBy}&${params.toString()}`,
        );
        const products = await apiFetch<{ data: ProductSalesRow[] }>(
          `/api/v1/reports/sales/by-product${query}`,
        );
        if (!cancelled) {
          setReport(dashboard);
          setSummary(sales);
          setTopProducts(products.data.slice(0, 8));
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load the dashboard.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupBy, preset, from, to, warehouseId]);

  const rangeLabel = rangeOptions.find((option) => option.value === preset)?.label ?? preset;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${rangeLabel} · ${formatDate(from)} → ${formatDate(to)}`}
      />
      <div className="toolbar">
        <Select value={preset} onChange={(event) => setPreset(event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
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

      <div className="chart-grid">
        <Card title="Sales trend">
          <div className="chart-controls">
            <Select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
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
