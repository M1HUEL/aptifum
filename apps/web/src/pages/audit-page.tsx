import type { TFunction } from 'i18next';
import { ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AuditAction, AuditLogEntry } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pagination,
  TableSkeleton,
  Input,
  Select,
} from '../components/ui';
import { Button } from '../components/ui/button';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';

const MODULES = [
  'auth',
  'users',
  'rbac',
  'tenants',
  'inventory',
  'sales',
  'invoicing',
  'purchasing',
  'accounting',
  'hr',
  'crm',
  'production',
  'reporting',
  'audit',
];

const ACTIONS: AuditAction[] = ['create', 'update', 'delete', 'login'];

function actionTone(action: AuditAction): 'success' | 'info' | 'danger' | 'neutral' {
  if (action === 'create') return 'success';
  if (action === 'update') return 'info';
  if (action === 'delete') return 'danger';
  return 'neutral';
}

function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function shortJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = JSON.stringify(value);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

interface AuditFilters {
  module: string;
  action: string;
  from: string;
  to: string;
}

const emptyFilters: AuditFilters = { module: '', action: '', from: '', to: '' };

const columns = (t: TFunction): Column<AuditLogEntry>[] => [
  {
    key: 'createdAt',
    header: t('tables.when'),
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    key: 'action',
    header: t('tables.action'),
    render: (row) => <Badge tone={actionTone(row.action)}>{row.action}</Badge>,
  },
  { key: 'module', header: t('tables.module') },
  { key: 'entity', header: t('tables.entity') },
  {
    key: 'entityId',
    header: t('tables.entityId'),
    render: (row) => <span title={row.entityId ?? undefined}>{shortId(row.entityId)}</span>,
  },
  {
    key: 'userId',
    header: t('tables.user'),
    render: (row) => <span title={row.userId ?? undefined}>{shortId(row.userId)}</span>,
  },
  { key: 'ip', header: t('tables.ip'), render: (row) => row.ip ?? '—' },
  {
    key: 'detail',
    header: t('tables.details'),
    render: (row) => {
      const before = shortJson(row.before);
      const after = shortJson(row.after);
      const detail = after ?? before;
      if (!detail) return <span className="text-[12px] text-muted">—</span>;
      const title = `${before ? `${t('audit.before')} ${before}\n` : ''}${t('audit.after')} ${after ?? ''}`;
      return (
        <span className="text-[12px] text-muted" title={title}>
          <code>{detail}</code>
        </span>
      );
    },
  },
];

export function AuditPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);

  const extraParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filters.module) params.module = filters.module;
    if (filters.action) params.action = filters.action;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  }, [filters]);

  const { data, error, loading } = usePagedQuery<AuditLogEntry>({
    path: '/api/v1/audit',
    page,
    limit,
    extraParams,
  });

  const setFilter = (key: keyof AuditFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
  };

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'audit', columns: columns(t), rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        action={
          <Button type="button" variant="secondary" aria-label={t('common.export')} onClick={handleExport}>
            {t('common.export')}
          </Button>
        }
      />

      <div className="mb-4 flex gap-2.5">
        <Select value={filters.module} onChange={(event) => setFilter('module', event.target.value)}>
          <option value="">{t('audit.allModules')}</option>
          {MODULES.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </Select>
        <Select value={filters.action} onChange={(event) => setFilter('action', event.target.value)}>
          <option value="">{t('audit.allActions')}</option>
          {ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
        <Input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
        <Input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t('audit.clearFilters')}
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {loading && !data ? <TableSkeleton columns={columns(t).length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('audit.noAuditEntries')} icon={<ScrollText className="size-6" />} />
          ) : (
            <DataTable columns={columns(t)} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination
            page={data.meta.page}
            limit={data.meta.limit}
            total={data.meta.total}
            onPage={setPage}
            onLimit={handleLimitChange}
          />
        </>
      ) : null}
    </>
  );
}
