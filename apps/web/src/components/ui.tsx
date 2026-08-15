import type { ComponentPropsWithoutRef, ReactNode } from 'react';
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
    <div className="mb-5 rounded-ui border border-border bg-surface p-5 shadow-(--shadow)">
      {title ? <h3 className="mb-3.5 text-[15px]">{title}</h3> : null}
      {children}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ui border border-border bg-surface p-4 shadow-(--shadow)">
      <div className="mb-1.5 text-[12px] uppercase tracking-[0.04em] text-muted">{label}</div>
      <div className="text-xl font-bold">{value}</div>
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
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Toolbar({
  children,
  as = 'div',
  ...props
}: { children: ReactNode; as?: 'div' | 'form' } & ComponentPropsWithoutRef<'form'>) {
  if (as === 'form') {
    return (
      <form className="mb-4 flex gap-2.5 print:hidden" {...props}>
        {children}
      </form>
    );
  }
  return <div className="mb-4 flex gap-2.5 print:hidden">{children}</div>;
}

export function Spinner() {
  const { t } = useTranslation();
  return <div className="size-7 animate-spin rounded-full border-[3px] border-border border-t-primary" aria-label={t('common.loading')} />;
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center p-12">
      <Spinner />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={className ? `skeleton ${className}` : 'skeleton'} aria-hidden="true" />;
}

export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
      <table className="w-full border-collapse print:text-[11px] [&_tr:last-child>td]:border-b-0">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, index) => (
              <th
                key={index}
                className="sticky top-0 z-[1] whitespace-nowrap border-b border-border bg-bg px-[14px] py-2.5 text-left text-[12px] uppercase tracking-[0.04em] text-muted print:px-2 print:py-1"
              >
                <Skeleton className="skeleton-header" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <td
                  key={colIndex}
                  className="max-w-[260px] overflow-hidden whitespace-nowrap border-b border-border px-[14px] py-2.5 text-left text-ellipsis print:px-2 print:py-1"
                >
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
  return <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-ui border border-dashed border-border bg-surface p-10 text-center text-muted">
      <svg
        className="mx-auto mb-2.5 block size-8 text-muted opacity-60"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-bg text-neutral-text',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`badge-${tone} inline-block rounded-full px-[9px] py-0.5 text-[12px] font-semibold ${badgeToneClasses[tone]}`}>
      {children}
    </span>
  );
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
    <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
      <table className="w-full border-collapse print:text-[11px] [&_tr:last-child>td]:border-b-0">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="sticky top-0 z-[1] whitespace-nowrap border-b border-border bg-bg px-[14px] py-2.5 text-left text-[12px] uppercase tracking-[0.04em] text-muted print:px-2 print:py-1"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => {
                const value = String((row as Record<string, unknown>)[col.key] ?? '');
                const cellClass =
                  'max-w-[260px] overflow-hidden whitespace-nowrap border-b border-border px-[14px] py-2.5 text-left text-ellipsis last:text-right print:px-2 print:py-1';
                return col.render ? (
                  <td key={col.key} className={cellClass}>
                    {col.render(row)}
                  </td>
                ) : (
                  <td key={col.key} className={cellClass} title={value}>
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
    <div className="flex items-center justify-end gap-[14px] text-muted print:hidden">
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
        <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
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
