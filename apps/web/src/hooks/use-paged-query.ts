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

export function usePagedQuery<T>(options: PagedQueryOptions): PagedQueryResult<T> {
  const { path, page, limit, query, extraParams } = options;

  const staticSearch = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit ?? 20),
    });
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        if (value) params.set(key, value);
      }
    }
    return params.toString();
  }, [page, limit, extraParams]);

  const [debouncedQuery, setDebouncedQuery] = useState(query ?? '');
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(query ?? '');
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const result = useQuery<Paginated<T>>({
    queryKey: ['paged', path, staticSearch, debouncedQuery],
    queryFn: () =>
      apiFetch<Paginated<T>>(
        `${path}?${staticSearch}${debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ''}`,
      ),
    placeholderData: (previous) => previous,
  });

  return {
    data: result.data ?? null,
    error: result.isError ? result.error.message : null,
    loading: result.isPending,
    reload: () => result.refetch().then(() => undefined),
  };
}
