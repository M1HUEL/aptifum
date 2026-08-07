import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Customer, Paginated } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';

const columns: Column<Customer>[] = [
  { key: 'code', header: 'Code' },
  { key: 'tradeName', header: 'Trade name' },
  { key: 'taxId', header: 'Tax ID' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  {
    key: 'creditLimit',
    header: 'Credit limit',
    render: (row) => formatMoney(row.creditLimit),
  },
  {
    key: 'active',
    header: 'Status',
    render: (row) => <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>,
  },
];

export function CustomersPage() {
  const [data, setData] = useState<Paginated<Customer> | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (query) params.set('q', query);
      const result = await apiFetch<Paginated<Customer>>(`/api/v1/sales/customers?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load customers.');
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Customers" subtitle="Customer accounts" />
      {error ? <ErrorBanner message={error} /> : null}
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by trade name…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No customers found." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}
