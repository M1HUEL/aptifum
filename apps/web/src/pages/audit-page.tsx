import { useMemo, useState } from 'react';
import type { AuditAction, AuditLogEntry } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';
import { Button } from '../components/ui/button';
import { usePagedQuery } from '../hooks/use-paged-query';

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

const columns: Column<AuditLogEntry>[] = [
  {
    key: 'createdAt',
    header: 'When',
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    key: 'action',
    header: 'Action',
    render: (row) => <Badge tone={actionTone(row.action)}>{row.action}</Badge>,
  },
  { key: 'module', header: 'Module' },
  { key: 'entity', header: 'Entity' },
  {
    key: 'entityId',
    header: 'Entity ID',
    render: (row) => <span title={row.entityId ?? undefined}>{shortId(row.entityId)}</span>,
  },
  {
    key: 'userId',
    header: 'User',
    render: (row) => <span title={row.userId ?? undefined}>{shortId(row.userId)}</span>,
  },
  { key: 'ip', header: 'IP', render: (row) => row.ip ?? '—' },
  {
    key: 'detail',
    header: 'Details',
    render: (row) => {
      const before = shortJson(row.before);
      const after = shortJson(row.after);
      const detail = after ?? before;
      if (!detail) return <span className="muted">—</span>;
      return (
        <span className="muted" title={`${before ? `before: ${before}\n` : ''}after: ${after ?? ''}`}>
          <code>{detail}</code>
        </span>
      );
    },
  },
];

export function AuditPage() {
  const [page, setPage] = useState(1);
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

  return (
    <>
      <PageHeader title="Audit log" subtitle="Record of security and write operations" />

      <div className="toolbar">
        <select
          value={filters.module}
          onChange={(event) => setFilter('module', event.target.value)}
        >
          <option value="">All modules</option>
          {MODULES.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(event) => setFilter('action', event.target.value)}
        >
          <option value="">All actions</option>
          {ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(event) => setFilter('from', event.target.value)}
        />
        <input
          type="date"
          value={filters.to}
          onChange={(event) => setFilter('to', event.target.value)}
        />
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {loading && !data ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No audit entries match the filters." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination
            page={data.meta.page}
            limit={data.meta.limit}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      ) : null}
    </>
  );
}
