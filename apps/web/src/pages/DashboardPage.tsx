import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { DashboardReport } from '../api/types';
import { Badge, Card, ErrorBanner, formatDate, formatMoney, LoadingBlock, PageHeader, StatCard } from '../components/ui';

export function DashboardPage() {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<DashboardReport>('/api/v1/reports/dashboard');
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 403) {
            setError('Your role does not have permission to view reports.');
          } else if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('Could not load the dashboard.');
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          <Card title="Operational health">
            <div className="status-list">
              <StatusRow label="Open purchase orders" count={report.openPurchaseOrders} />
              <StatusRow label="Production orders in progress" count={report.productionInProgress} />
              <StatusRow label="Low stock products" count={report.lowStockProducts} warnThreshold={1} />
            </div>
          </Card>
        </>
      ) : null}
    </>
  );
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
