import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Invoice, Paginated } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatDate,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';

const columns: Column<Invoice>[] = [
  { key: 'number', header: 'Number' },
  {
    key: 'type',
    header: 'Type',
    render: (row) => (
      <Badge tone={row.type === 'invoice' ? 'info' : 'warning'}>{row.type.replace('_', ' ')}</Badge>
    ),
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (row) => row.customer.tradeName,
  },
  {
    key: 'issueDate',
    header: 'Issue date',
    render: (row) => formatDate(row.issueDate),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <Badge tone={row.status === 'issued' ? 'success' : row.status === 'draft' ? 'neutral' : 'danger'}>
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'total',
    header: 'Total',
    render: (row) => formatMoney(row.total),
  },
  {
    key: 'balanceDue',
    header: 'Balance',
    render: (row) => formatMoney(row.balanceDue),
  },
];

export function InvoicesPage() {
  const [data, setData] = useState<Paginated<Invoice> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const result = await apiFetch<Paginated<Invoice>>(`/api/v1/sales/invoices?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load invoices.');
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Invoices" subtitle="Invoices and credit notes" />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No invoices." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}
