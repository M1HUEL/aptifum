import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError, downloadCsv } from '../api/client';
import { usePermission } from '../auth/AuthContext';
import {
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatNumber,
  LoadingBlock,
  PageHeader,
} from '../components/ui';

interface ReportDef {
  id: string;
  label: string;
  endpoint: string;
}

const REPORTS: ReportDef[] = [
  { id: 'sales-summary', label: 'Sales summary', endpoint: '/api/v1/reports/sales/summary' },
  { id: 'sales-by-product', label: 'Sales by product', endpoint: '/api/v1/reports/sales/by-product' },
  { id: 'inventory-valuation', label: 'Inventory valuation', endpoint: '/api/v1/reports/inventory/valuation' },
  { id: 'low-stock', label: 'Low stock', endpoint: '/api/v1/reports/inventory/low-stock' },
  { id: 'aging-ar', label: 'Aging (accounts receivable)', endpoint: '/api/v1/reports/aging/ar' },
];

type Row = Record<string, unknown>;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  return String(value);
}

function buildColumns(rows: Row[]): Column<Row>[] {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return keys.map((key) => ({
    key,
    header: key,
    render: (row) => formatCell(row[key]),
  }));
}

export function ReportsPage() {
  const can = usePermission();
  const [reportId, setReportId] = useState(REPORTS[0].id);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const activeReport = REPORTS.find((report) => report.id === reportId) ?? REPORTS[0];

  const load = useCallback(
    async (id: string) => {
      const report = REPORTS.find((item) => item.id === id);
      if (!report) return;
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<{ data?: Row[]; [key: string]: unknown }>(report.endpoint);
        setRows(payload.data ?? []);
      } catch (err) {
        setRows(null);
        setError(err instanceof ApiError ? err.message : 'Could not load the report.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(reportId);
  }, [reportId, load]);

  const download = async () => {
    setDownloadError(null);
    try {
      await downloadCsv(`${activeReport.endpoint}?format=csv`);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not download the CSV.');
    }
  };

  if (!can('reporting:read')) {
    return (
      <>
        <PageHeader title="Reports" />
        <ErrorBanner message="Your role does not have permission to view reports." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Analytics and exports"
        action={
          <button type="button" className="btn" onClick={() => void download()}>
            Download CSV
          </button>
        }
      />
      <div className="toolbar">
        <select value={reportId} onChange={(event) => setReportId(event.target.value)}>
          {REPORTS.map((report) => (
            <option key={report.id} value={report.id}>
              {report.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {downloadError ? <ErrorBanner message={downloadError} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && rows ? (
        rows.length === 0 ? (
          <EmptyState message="No data for this report." />
        ) : (
          <DataTable
            columns={buildColumns(rows)}
            rows={rows}
            rowKey={(row) => String(row['id'] ?? JSON.stringify(row))}
          />
        )
      ) : null}
    </>
  );
}
