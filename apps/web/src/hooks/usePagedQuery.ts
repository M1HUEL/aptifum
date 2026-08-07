import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Paginated } from '../api/types';

interface PagedQueryOptions {
  path: string;
  page: number;
  limit?: number;
  query?: string;
}

interface PagedQueryResult<T> {
  data: Paginated<T> | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function usePagedQuery<T>({ path, page, limit = 20, query }: PagedQueryOptions): PagedQueryResult<T> {
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (query) params.set('q', query);
      const result = await apiFetch<Paginated<T>>(`${path}?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, [path, page, limit, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
