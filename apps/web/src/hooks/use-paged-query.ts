import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { Paginated } from '../api/types';

interface PagedQueryOptions {
  path: string;
  page: number;
  limit?: number;
  query?: string;
  extraParams?: Record<string, string>;
}

interface PagedQueryResult<T> {
  data: Paginated<T> | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

function serializeParams(options: PagedQueryOptions): string {
  const params = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit ?? 20),
  });
  if (options.query) params.set('q', options.query);
  if (options.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      if (value) params.set(key, value);
    }
  }
  return params.toString();
}

export function usePagedQuery<T>(options: PagedQueryOptions): PagedQueryResult<T> {
  const { path } = options;
  const search = useMemo(() => serializeParams(options), [options]);

  const result = useQuery<Paginated<T>>({
    queryKey: ['paged', path, search],
    queryFn: () => apiFetch<Paginated<T>>(`${path}?${search}`),
    placeholderData: (previous) => previous,
  });

  return {
    data: result.data ?? null,
    error: result.isError ? result.error.message : null,
    loading: result.isPending,
    reload: () => result.refetch().then(() => undefined),
  };
}
