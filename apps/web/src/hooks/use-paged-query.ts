import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { Paginated } from '../api/types';

const SEARCH_DEBOUNCE_MS = 300;

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

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(search);
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [search]);

  const result = useQuery<Paginated<T>>({
    queryKey: ['paged', path, debouncedSearch],
    queryFn: () => apiFetch<Paginated<T>>(`${path}?${debouncedSearch}`),
    placeholderData: (previous) => previous,
  });

  return {
    data: result.data ?? null,
    error: result.isError ? result.error.message : null,
    loading: result.isPending,
    reload: () => result.refetch().then(() => undefined),
  };
}
