import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Paginated, Product } from '../api/types';
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

const columns: Column<Product>[] = [
  { key: 'sku', header: 'SKU' },
  { key: 'name', header: 'Name' },
  {
    key: 'category',
    header: 'Category',
    render: (row) => row.category?.name ?? '—',
  },
  {
    key: 'salePrice',
    header: 'Sale price',
    render: (row) => formatMoney(row.salePrice),
  },
  {
    key: 'enabled',
    header: 'Status',
    render: (row) => <Badge tone={row.enabled ? 'success' : 'neutral'}>{row.enabled ? 'Enabled' : 'Disabled'}</Badge>,
  },
];

export function ProductsPage() {
  const [data, setData] = useState<Paginated<Product> | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (query) params.set('q', query);
      const result = await apiFetch<Paginated<Product>>(`/api/v1/inventory/products?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load products.');
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
      <PageHeader title="Products" subtitle="Catalog" />
      {error ? <ErrorBanner message={error} /> : null}
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by name…"
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
            <EmptyState message="No products found." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}
