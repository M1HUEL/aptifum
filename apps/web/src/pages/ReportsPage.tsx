import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError, downloadFile } from '../api/client';
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

type Shape = 'list' | 'single' | 'financial';

interface ReportDef {
  id: string;
  label: string;
  endpoint: string;
  shape: Shape;
  pdf?: boolean;
  sections?: Array<{ section: string; key: string }>;
  summaryRows?: Array<{ code: string; name: string; key: string }>;
}

const REPORTS: ReportDef[] = [
  { id: 'dashboard', label: 'Dashboard', endpoint: '/api/v1/reports/dashboard', shape: 'single', pdf: true },
  { id: 'sales-summary', label: 'Sales summary', endpoint: '/api/v1/reports/sales/summary', shape: 'list', pdf: true },
  { id: 'sales-by-product', label: 'Sales by product', endpoint: '/api/v1/reports/sales/by-product', shape: 'list', pdf: true },
  { id: 'sales-by-customer', label: 'Sales by customer', endpoint: '/api/v1/reports/sales/by-customer', shape: 'list', pdf: true },
  { id: 'inventory-valuation', label: 'Inventory valuation', endpoint: '/api/v1/reports/inventory/valuation', shape: 'list', pdf: true },
  { id: 'stock-movements', label: 'Stock movements', endpoint: '/api/v1/reports/inventory/movements', shape: 'list', pdf: true },
  { id: 'low-stock', label: 'Low stock', endpoint: '/api/v1/reports/inventory/low-stock', shape: 'list', pdf: true },
  { id: 'aging-ar', label: 'Aging (accounts receivable)', endpoint: '/api/v1/reports/aging/ar', shape: 'list', pdf: true },
  { id: 'aging-ap', label: 'Aging (accounts payable)', endpoint: '/api/v1/reports/aging/ap', shape: 'list', pdf: true },
  {
    id: 'income-statement',
    label: 'Income statement',
    endpoint: '/api/v1/reports/financial/income-statement',
    shape: 'financial',
    pdf: true,
    sections: [
      { section: 'Revenue', key: 'revenue' },
      { section: 'Cost of sales', key: 'costOfSales' },
      { section: 'Operating expenses', key: 'operatingExpenses' },
    ],
    summaryRows: [{ code: '', name: 'Net income', key: 'netIncome' }],
  },
  { id: 'cash-flow', label: 'Cash flow', endpoint: '/api/v1/reports/financial/cash-flow', shape: 'list', pdf: true },
  {
    id: 'balance-sheet',
    label: 'Balance sheet',
    endpoint: '/api/v1/reports/financial/balance-sheet',
    shape: 'financial',
    pdf: true,
    sections: [
      { section: 'Assets', key: 'assets' },
      { section: 'Liabilities', key: 'liabilities' },
      { section: 'Equity', key: 'equity' },
    ],
    summaryRows: [
      { code: '', name: 'Total assets', key: 'totalAssets' },
      { code: '', name: 'Total liabilities and equity', key: 'totalLiabilitiesAndEquity' },
    ],
  },
  { id: 'payroll', label: 'Payroll summary', endpoint: '/api/v1/reports/hr/payroll', shape: 'list', pdf: true },
];

type Row = Record<string, unknown>;
type Json = Record<string, unknown>;

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

function flattenFinancial(report: ReportDef, payload: Json): Row[] {
  const rows: Row[] = [];
  for (const { section, key } of report.sections ?? []) {
    const sectionData = payload[key] as
      | { accounts?: Array<Record<string, unknown>>; total?: number }
      | undefined;
    for (const account of sectionData?.accounts ?? []) {
      rows.push({ section, code: account.code, name: account.name, balance: account.balance });
    }
    rows.push({
      section,
      code: '',
      name: `Total ${section.toLowerCase()}`,
      balance: sectionData?.total ?? 0,
    });
  }
  for (const row of report.summaryRows ?? []) {
    rows.push({ section: 'Summary', code: row.code, name: row.name, balance: payload[row.key] ?? 0 });
  }
  return rows;
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
        const payload = await apiFetch<Json>(report.endpoint);
        if (report.shape === 'list') {
          setRows((payload.data as Row[] | undefined) ?? []);
        } else if (report.shape === 'single') {
          setRows([payload]);
        } else {
          setRows(flattenFinancial(report, payload));
        }
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
      await downloadFile(`${activeReport.endpoint}?format=csv`, 'export.csv');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not download the CSV.');
    }
  };

  const downloadPdf = async () => {
    setDownloadError(null);
    try {
      await downloadFile(`${activeReport.endpoint}?format=pdf`, 'report.pdf');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not download the PDF.');
    }
  };

  const downloadXlsx = async () => {
    setDownloadError(null);
    try {
      await downloadFile(`${activeReport.endpoint}?format=xlsx`, 'export.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not download the XLSX.');
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
          <div className="page-header-actions">
            {activeReport.pdf ? (
              <button type="button" className="btn btn-ghost" onClick={() => void downloadPdf()}>
                Download PDF
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              Print / PDF
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void downloadXlsx()}>
              Download XLSX
            </button>
            <button type="button" className="btn" onClick={() => void download()}>
              Download CSV
            </button>
          </div>
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
      <div className="report-print-heading">
        <h2>{activeReport.label}</h2>
        <p>Generated {new Date().toLocaleString()}</p>
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
