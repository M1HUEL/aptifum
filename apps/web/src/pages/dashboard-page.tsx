import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Input,
  Select,
} from '../components/ui';

const groupOptions = [
  { value: 'day', labelKey: 'dashboard.groups.day' },
  { value: 'month', labelKey: 'dashboard.groups.month' },
  { value: 'quarter', labelKey: 'dashboard.groups.quarter' },
  { value: 'year', labelKey: 'dashboard.groups.year' },
];

const rangeOptions = [
  { value: '7d', labelKey: 'dashboard.ranges.7d' },
  { value: '30d', labelKey: 'dashboard.ranges.30d' },
  { value: '90d', labelKey: 'dashboard.ranges.90d' },
  { value: 'month', labelKey: 'dashboard.ranges.month' },
  { value: 'year', labelKey: 'dashboard.ranges.year' },
  { value: 'all', labelKey: 'dashboard.ranges.all' },
  { value: 'custom', labelKey: 'dashboard.ranges.custom' },
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
    <div className="flex items-center justify-between border-b border-border pb-2.5 last:border-b-0 last:pb-0">
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
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <strong>{title}</strong>
        <Link className="whitespace-nowrap text-[13px] text-primary hover:underline" to={linkTo}>
          {count > 0 ? t('dashboard.viewAll', { count }) : emptyText}
        </Link>
      </div>
      {count > 0 ? <div className="flex flex-col gap-2.5">{children}</div> : <p className="text-[13px] text-muted">{emptyText}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState('month');
  const [preset, setPreset] = useState('month');
  const [warehouseId, setWarehouseId] = useState('');
  const [customFrom, setCustomFrom] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return start.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { from, to } = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return rangeFor(preset);
  }, [preset, customFrom, customTo]);

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
  const error = reportQuery.error
    ? reportQuery.error instanceof ApiError && reportQuery.error.status === 403
      ? t('dashboard.noReportsPermission')
      : reportQuery.error instanceof ApiError
        ? reportQuery.error.message
        : t('dashboard.couldNotLoad')
    : null;

  const rangeLabel = t(`dashboard.ranges.${preset}`);

  return (
    <>
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={`${rangeLabel} · ${formatDate(from)} → ${formatDate(to)}`}
      />
      <div className="mb-4 flex gap-2.5">
        <Select value={preset} onChange={(event) => setPreset(event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </Select>
        {preset === 'custom' ? (
          <div className="flex items-center gap-2.5">
            <label className="whitespace-nowrap text-[13px] text-muted" htmlFor="dash-from">
              {t('dashboard.from')}
            </label>
            <Input
              id="dash-from"
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <label className="whitespace-nowrap text-[13px] text-muted" htmlFor="dash-to">
              {t('dashboard.to')}
            </label>
            <Input
              id="dash-to"
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </div>
        ) : null}
        <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          <option value="">{t('dashboard.allWarehouses')}</option>
          {(warehousesQuery.data?.data ?? []).map((warehouse) => (
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
          <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
            <StatCard label={t('dashboard.stat.revenuePeriod')} value={formatMoney(report.salesRange)} />
            <StatCard label={t('dashboard.stat.netIncomePeriod')} value={formatMoney(report.netIncomeRange)} />
            <StatCard label={t('dashboard.stat.invoicesPeriod')} value={String(report.rangeInvoices)} />
            <StatCard label={t('dashboard.stat.salesToday')} value={formatMoney(report.salesToday)} />
            <StatCard label={t('dashboard.stat.salesThisMonth')} value={formatMoney(report.salesMonth)} />
            <StatCard label={t('dashboard.stat.netIncomeMonth')} value={formatMoney(report.netIncomeMonth)} />
          </div>
          <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
            <StatCard label={t('dashboard.stat.invoicesMonth')} value={String(report.monthInvoices)} />
            <StatCard label={t('dashboard.stat.receivables')} value={formatMoney(report.receivables)} />
            <StatCard label={t('dashboard.stat.payables')} value={formatMoney(report.payables)} />
            <StatCard label={t('dashboard.stat.inventoryValue')} value={formatMoney(report.inventoryValue)} />
            <StatCard label={t('dashboard.stat.lowStockProducts')} value={String(report.lowStockProducts)} />
            <StatCard label={t('dashboard.stat.openPurchaseOrders')} value={String(report.openPurchaseOrders)} />
          </div>
          <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
            <StatCard label={t('dashboard.stat.productionInProgress')} value={String(report.productionInProgress)} />
          </div>
        </>
      ) : null}

      {alerts ? (
        <Card title={t('dashboard.alerts')}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
            <AlertSection
              title={t('dashboard.lowStock')}
              count={alerts.summary.lowStock}
              linkTo="/stock"
              emptyText={t('dashboard.lowStockOk')}
            >
              {alerts.lowStock.map((product) => (
                <div className="flex items-center justify-between border-b border-border pb-2.5 last:border-b-0 last:pb-0" key={product.productId}>
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
              title={t('dashboard.overdueReceivables')}
              count={alerts.summary.overdueReceivables}
              linkTo="/invoices"
              emptyText={t('dashboard.noOverdueInvoices')}
            >
              {alerts.overdueReceivables.map((invoice) => (
                <div className="flex items-center justify-between border-b border-border pb-2.5 last:border-b-0 last:pb-0" key={invoice.invoiceId}>
                  <span>
                    {invoice.number}
                    <span className="text-muted"> · {invoice.customerName}</span>
                  </span>
                  <Badge tone="danger">{formatMoney(invoice.balanceDue)}</Badge>
                </div>
              ))}
            </AlertSection>
            <AlertSection
              title={t('dashboard.overduePayables')}
              count={alerts.summary.overduePayables}
              linkTo="/purchasing"
              emptyText={t('dashboard.noOverduePayables')}
            >
              {alerts.overduePayables.map((receipt) => (
                <div className="flex items-center justify-between border-b border-border pb-2.5 last:border-b-0 last:pb-0" key={receipt.receiptId}>
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

      <div className="mb-4 grid grid-cols-2 gap-4 max-[900px]:grid-cols-1 max-[480px]:grid-cols-2">
        <Card title={t('dashboard.salesTrend')}>
          <div className="mb-2.5 flex justify-end">
            <Select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </Select>
          </div>
          {summary ? (
            <div className="w-full">
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
                    name={t('dashboard.revenue')}
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name={t('dashboard.total')}
                    stroke="var(--success)"
                    fill="var(--success)"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </Card>

        <Card title={t('dashboard.topProducts')}>
          {topProducts.length === 0 ? (
            <p className="text-muted">{t('dashboard.noSalesData')}</p>
          ) : (
            <div className="w-full">
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
                  <Bar dataKey="revenue" name={t('dashboard.revenue')} fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="grossProfit" name={t('dashboard.grossProfit')} fill="var(--success)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {report ? (
        <Card title={t('dashboard.operationalHealth')}>
          <div className="flex flex-col gap-2.5">
            <StatusRow label={t('dashboard.stat.openPurchaseOrders')} count={report.openPurchaseOrders} />
            <StatusRow label={t('dashboard.productionOrdersInProgress')} count={report.productionInProgress} />
            <StatusRow label={t('dashboard.stat.lowStockProducts')} count={report.lowStockProducts} warnThreshold={1} />
          </div>
        </Card>
      ) : null}
    </>
  );
}
