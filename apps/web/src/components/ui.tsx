import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

function resolveLocale(language?: string): string {
  return language?.startsWith('es') ? 'es-MX' : 'en-US';
}

export function formatMoney(value: number, currency = 'USD', locale?: string): string {
  const resolvedLocale = locale ?? resolveLocale(i18n.language);
  return new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency }).format(value);
}

export function formatNumber(value: number, locale?: string): string {
  const resolvedLocale = locale ?? resolveLocale(i18n.language);
  return new Intl.NumberFormat(resolvedLocale).format(value);
}

export function formatDate(value: string | null | undefined, locale?: string): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const resolvedLocale = locale ?? resolveLocale(i18n.language);
  return date.toLocaleDateString(resolvedLocale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title ? <h3 className="card-title">{title}</h3> : null}
      {children}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  );
}

export function Spinner() {
  const { t } = useTranslation();
  return <div className="spinner" aria-label={t('common.loading')} />;
}

export function LoadingBlock() {
  return (
    <div className="loading-block">
      <Spinner />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={className ? `skeleton ${className}` : 'skeleton'} aria-hidden="true" />;
}

export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, index) => (
              <th key={index}>
                <Skeleton className="skeleton-header" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <td key={colIndex}>
                  <Skeleton />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <EmptyState message={t('common.noData')} />;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
  onLimit,
  limits = [10, 20, 50],
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
  onLimit?: (limit: number) => void;
  limits?: number[];
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {t('common.previous')}
      </button>
      <span>
        {t('common.showingRange', { start, end, total })}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        {t('common.next')}
      </button>
      {onLimit ? (
        <select
          aria-label={t('common.rowsPerPage')}
          value={limit}
          onChange={(event) => onLimit(Number(event.target.value))}
        >
          {limits.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
