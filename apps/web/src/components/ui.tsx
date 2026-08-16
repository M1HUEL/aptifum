import { useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpDown, ArrowUpRight, Inbox } from 'lucide-react';
import { cn } from '../lib/cn';
import i18n from '../i18n';

const inputBase =
  'rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15';

export function Input({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select className={cn(inputBase, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={cn(inputBase, className)} {...props} />;
}

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

export function StatCard({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  const hasTrend = trend !== undefined && trend !== null && Number.isFinite(trend);
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="rounded-ui border border-border bg-surface p-4 shadow-(--shadow) transition-transform duration-200 hover:-translate-y-0.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] uppercase tracking-[0.04em] text-muted">{label}</span>
        {hasTrend ? (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 text-[12px] font-semibold ${
              trendUp ? 'text-success' : 'text-danger'
            }`}
          >
            {trendUp ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend!).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 max-[640px]:flex-col max-[640px]:items-stretch">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-text">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 max-[640px]:flex max-[640px]:justify-end">{action}</div> : null}
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
      <form className="mb-4 flex flex-wrap gap-2.5 print:hidden max-[640px]:gap-2" {...props}>
        {children}
      </form>
    );
  }
  return <div className="mb-4 flex flex-wrap gap-2.5 print:hidden max-[640px]:gap-2">{children}</div>;
}

export function Spinner() {
  const { t } = useTranslation();
  return (
    <div
      className="size-7 animate-spin rounded-full border-[3px] border-border border-t-primary"
      aria-label={t('common.loading')}
    />
  );
}

export function LoadingBlock({ full = false }: { full?: boolean }) {
  return (
    <div
      className={
        full ? 'fixed inset-0 z-50 flex items-center justify-center p-12' : 'flex items-center justify-center p-12'
      }
    >
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
  return (
    <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{message}</div>
  );
}

export function EmptyState({ message, icon, action }: { message: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-ui border border-dashed border-border bg-surface p-10 text-center text-muted">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-hover/50">
        {icon ?? <Inbox className="size-6 text-muted opacity-70" aria-hidden="true" />}
      </div>
      <span>{message}</span>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
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
    <span
      className={`badge-${tone} inline-block rounded-full px-[9px] py-0.5 text-[12px] font-semibold ${badgeToneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

export type DataTableSort = { key: string; dir: 'asc' | 'desc' };

function sortCellValue<T>(row: T, col: Column<T>): unknown {
  if (col.sortValue) return col.sortValue(row);
  return (row as Record<string, unknown>)[col.key];
}

function isSortable<T>(row: T, col: Column<T>): boolean {
  return col.sortValue !== undefined || Object.prototype.hasOwnProperty.call(row, col.key);
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sort: externalSort,
  onSortChange,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
}) {
  const { t } = useTranslation();
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(null);
  const activeSort = externalSort ?? internalSort;

  const sortedRows = useMemo(() => {
    if (!activeSort) return rows;
    const col = columns.find((c) => c.key === activeSort.key);
    if (!col) return rows;
    const dir = activeSort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = sortCellValue(a, col);
      const bv = sortCellValue(b, col);
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, activeSort, columns]);

  const toggleSort = (col: Column<T>) => {
    const first = rows[0];
    if (!first || !isSortable(first, col)) return;
    let next: DataTableSort | null;
    if (activeSort?.key !== col.key) {
      next = { key: col.key, dir: 'asc' };
    } else if (activeSort.dir === 'asc') {
      next = { key: col.key, dir: 'desc' };
    } else {
      next = null;
    }
    if (onSortChange) {
      onSortChange(next);
    } else {
      setInternalSort(next);
    }
  };

  if (rows.length === 0) {
    return <EmptyState message={t('common.noData')} />;
  }
  return (
    <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
      <table
        data-testid="data-table"
        className="w-full border-collapse print:text-[11px] [&_tr:last-child>td]:border-b-0"
      >
        <thead>
          <tr>
            {columns.map((col) => {
              const first = rows[0];
              const sortable = !!first && isSortable(first, col);
              const active = activeSort?.key === col.key;
              const dir = activeSort?.dir;
              return (
                <th
                  key={col.key}
                  aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className="sticky top-0 z-[1] whitespace-nowrap border-b border-border bg-bg px-[14px] py-2.5 text-left text-[12px] uppercase tracking-[0.04em] text-muted print:px-2 print:py-1"
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      aria-label={t(`common.sort${active && dir === 'desc' ? 'Descending' : 'Ascending'}`, {
                        column: col.header,
                      })}
                      className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-[0.04em] select-none hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {col.header}
                      {active ? (
                        dir === 'asc' ? (
                          <ArrowUp className="size-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-muted/60" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-hover/30">
          {sortedRows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors hover:bg-hover">
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
    <Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
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
    <div className="flex flex-wrap items-center justify-end gap-x-[14px] gap-y-2 text-muted print:hidden">
      <button
        type="button"
        className="cursor-pointer text-text transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {t('common.previous')}
      </button>
      <span>{t('common.showingRange', { start, end, total })}</span>
      <button
        type="button"
        className="cursor-pointer text-text transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        {t('common.next')}
      </button>
      {onLimit ? (
        <Select
          className="w-auto"
          aria-label={t('common.rowsPerPage')}
          value={limit}
          onChange={(event) => onLimit(Number(event.target.value))}
        >
          {limits.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
