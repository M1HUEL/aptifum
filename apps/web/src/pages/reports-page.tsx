import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError, downloadFile } from '../api/client';
import { usePermission } from '../auth/auth-context';
import {
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatNumber,
  LoadingBlock,
  PageHeader,
  Select,
} from '../components/ui';
import { BarChart3 } from 'lucide-react';
import { Button } from '../components/ui/button';

type Shape = 'list' | 'single' | 'financial';

interface ReportDef {
  id: string;
  labelKey: string;
  endpoint: string;
  shape: Shape;
  pdf?: boolean;
  sections?: Array<{ sectionKey: string; key: string }>;
  summaryRows?: Array<{ code: string; nameKey: string; key: string }>;
}

const REPORTS: ReportDef[] = [
  { id: 'dashboard', labelKey: 'reports.list.dashboard', endpoint: '/api/v1/reports/dashboard', shape: 'single', pdf: true },
  { id: 'sales-summary', labelKey: 'reports.list.salesSummary', endpoint: '/api/v1/reports/sales/summary', shape: 'list', pdf: true },
  { id: 'sales-by-product', labelKey: 'reports.list.salesByProduct', endpoint: '/api/v1/reports/sales/by-product', shape: 'list', pdf: true },
  { id: 'sales-by-customer', labelKey: 'reports.list.salesByCustomer', endpoint: '/api/v1/reports/sales/by-customer', shape: 'list', pdf: true },
  { id: 'inventory-valuation', labelKey: 'reports.list.inventoryValuation', endpoint: '/api/v1/reports/inventory/valuation', shape: 'list', pdf: true },
  { id: 'stock-movements', labelKey: 'reports.list.stockMovements', endpoint: '/api/v1/reports/inventory/movements', shape: 'list', pdf: true },
  { id: 'low-stock', labelKey: 'reports.list.lowStock', endpoint: '/api/v1/reports/inventory/low-stock', shape: 'list', pdf: true },
  { id: 'aging-ar', labelKey: 'reports.list.agingAr', endpoint: '/api/v1/reports/aging/ar', shape: 'list', pdf: true },
  { id: 'aging-ap', labelKey: 'reports.list.agingAp', endpoint: '/api/v1/reports/aging/ap', shape: 'list', pdf: true },
  {
    id: 'income-statement',
    labelKey: 'reports.list.incomeStatement',
    endpoint: '/api/v1/reports/financial/income-statement',
    shape: 'financial',
    pdf: true,
    sections: [
      { sectionKey: 'reports.section.revenue', key: 'revenue' },
      { sectionKey: 'reports.section.costOfSales', key: 'costOfSales' },
      { sectionKey: 'reports.section.operatingExpenses', key: 'operatingExpenses' },
    ],
    summaryRows: [{ code: '', nameKey: 'reports.summaryRow.netIncome', key: 'netIncome' }],
  },
  { id: 'cash-flow', labelKey: 'reports.list.cashFlow', endpoint: '/api/v1/reports/financial/cash-flow', shape: 'list', pdf: true },
  {
    id: 'balance-sheet',
    labelKey: 'reports.list.balanceSheet',
    endpoint: '/api/v1/reports/financial/balance-sheet',
    shape: 'financial',
    pdf: true,
    sections: [
      { sectionKey: 'reports.section.assets', key: 'assets' },
      { sectionKey: 'reports.section.liabilities', key: 'liabilities' },
      { sectionKey: 'reports.section.equity', key: 'equity' },
    ],
    summaryRows: [
      { code: '', nameKey: 'reports.summaryRow.totalAssets', key: 'totalAssets' },
      { code: '', nameKey: 'reports.summaryRow.totalLiabilitiesAndEquity', key: 'totalLiabilitiesAndEquity' },
    ],
  },
  { id: 'payroll', labelKey: 'reports.list.payroll', endpoint: '/api/v1/reports/hr/payroll', shape: 'list', pdf: true },
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

function buildColumns(rows: Row[], t: TFunction): Column<Row>[] {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return keys.map((key) => ({
    key,
    header: t(`reports.column.${key}`, { defaultValue: key }),
    render: (row) => formatCell(row[key]),
  }));
}

function flattenFinancial(report: ReportDef, payload: Json, t: TFunction): Row[] {
  const rows: Row[] = [];
  for (const { sectionKey, key } of report.sections ?? []) {
    const sectionData = payload[key] as
      | { accounts?: Array<Record<string, unknown>>; total?: number }
      | undefined;
    const sectionLabel = t(sectionKey);
    for (const account of sectionData?.accounts ?? []) {
      rows.push({ section: sectionLabel, code: account.code, name: account.name, balance: account.balance });
    }
    rows.push({
      section: sectionLabel,
      code: '',
      name: t('reports.totalSection', { section: sectionLabel.toLowerCase() }),
      balance: sectionData?.total ?? 0,
    });
  }
  for (const row of report.summaryRows ?? []) {
    rows.push({
      section: t('reports.summary'),
      code: row.code,
      name: t(row.nameKey),
      balance: payload[row.key] ?? 0,
    });
  }
  return rows;
}

export function ReportsPage() {
  const { t } = useTranslation();
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
          setRows(flattenFinancial(report, payload, t));
        }
      } catch (err) {
        setRows(null);
        setError(err instanceof ApiError ? err.message : t('reports.couldNotLoad'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load(reportId);
  }, [reportId, load]);

  const download = async () => {
    setDownloadError(null);
    try {
      await downloadFile(`${activeReport.endpoint}?format=csv`, 'export.csv');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : t('reports.couldNotDownloadCsv'));
    }
  };

  const downloadPdf = async () => {
    setDownloadError(null);
    try {
      await downloadFile(`${activeReport.endpoint}?format=pdf`, 'report.pdf');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : t('reports.couldNotDownloadPdf'));
    }
  };

  const downloadXlsx = async () => {
    setDownloadError(null);
    try {
      await downloadFile(`${activeReport.endpoint}?format=xlsx`, 'export.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : t('reports.couldNotDownloadXlsx'));
    }
  };

  if (!can('reporting:read')) {
    return (
      <>
        <PageHeader title={t('reports.title')} />
        <ErrorBanner message={t('errors.noReportsPermission')} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        action={
          <div className="flex justify-end gap-2">
            {activeReport.pdf ? (
              <Button variant="secondary" type="button" onClick={() => void downloadPdf()}>
                {t('common.downloadPdf')}
              </Button>
            ) : null}
            <Button variant="secondary" type="button" onClick={() => window.print()}>
              {t('reports.printPdf')}
            </Button>
            <Button variant="secondary" type="button" onClick={() => void downloadXlsx()}>
              {t('reports.downloadXlsx')}
            </Button>
            <Button type="button" onClick={() => void download()}>
              {t('reports.downloadCsv')}
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex gap-2.5">
        <Select value={reportId} onChange={(event) => setReportId(event.target.value)}>
          {REPORTS.map((report) => (
            <option key={report.id} value={report.id}>
              {t(report.labelKey)}
            </option>
          ))}
        </Select>
      </div>
      <div className="hidden print:block print:mb-4">
        <h2 className="print:text-lg">{t(activeReport.labelKey)}</h2>
        <p className="print:text-[12px] print:text-muted">{t('reports.generated', { date: new Date().toLocaleString() })}</p>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {downloadError ? <ErrorBanner message={downloadError} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && rows ? (
        rows.length === 0 ? (
          <EmptyState message={t('reports.noData')} icon={<BarChart3 className="size-6" />} />
        ) : (
          <DataTable
            columns={buildColumns(rows, t)}
            rows={rows}
            rowKey={(row) => String(row['id'] ?? JSON.stringify(row))}
          />
        )
      ) : null}
    </>
  );
}
