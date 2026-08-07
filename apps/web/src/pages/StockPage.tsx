import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Paginated, ProductStock } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatNumber,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';

const columns: Column<ProductStock>[] = [
  {
    key: 'product',
    header: 'Product',
    render: (row) => `${row.product.sku} · ${row.product.name}`,
  },
  {
    key: 'warehouse',
    header: 'Warehouse',
    render: (row) => row.warehouse.name,
  },
  {
    key: 'quantity',
    header: 'On hand',
    render: (row) => (
      <Badge tone={row.quantity <= 10 ? 'warning' : 'success'}>{formatNumber(row.quantity)}</Badge>
    ),
  },
  {
    key: 'reservedQuantity',
    header: 'Reserved',
    render: (row) => formatNumber(row.reservedQuantity),
  },
  {
    key: 'averageCost',
    header: 'Avg cost',
    render: (row) => `$${row.averageCost.toFixed(2)}`,
  },
];

export function StockPage() {
  const [data, setData] = useState<Paginated<ProductStock> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const result = await apiFetch<Paginated<ProductStock>>(`/api/v1/inventory/stock?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load stock.');
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Stock" subtitle="Stock levels by warehouse" />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No stock records." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}
