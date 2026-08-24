import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { apiFetch, ApiError } from './client';
import type { Paginated } from './types';

type QueryKeyFn = QueryKey | (() => QueryKey);

function resolveKey(key: QueryKeyFn): QueryKey {
  return typeof key === 'function' ? key() : key;
}

export interface ApiQueryOptions<T> extends Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'> {}

export function useApiQuery<T>(key: QueryKeyFn, path: string, options: ApiQueryOptions<T> = {}) {
  return useQuery<T, ApiError>({
    queryKey: resolveKey(key),
    queryFn: () => apiFetch<T>(path),
    ...options,
  });
}

export function useApiMutation<TBody, TResult = unknown>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
  options: UseMutationOptions<TResult, ApiError, TBody> = {},
) {
  return useMutation<TResult, ApiError, TBody>({
    mutationFn: (body) =>
      apiFetch<TResult>(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ...options,
  });
}

export function useApiMutationVoid(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
  options: UseMutationOptions<void, ApiError, Record<string, never> | undefined> = {},
) {
  return useMutation<void, ApiError, Record<string, never> | undefined>({
    mutationFn: (body) => apiFetch<void>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    ...options,
  });
}

export function useApiPagedQuery<T>(key: QueryKeyFn, path: string, options: ApiQueryOptions<Paginated<T>> = {}) {
  return useQuery<Paginated<T>, ApiError>({
    queryKey: resolveKey(key),
    queryFn: () => apiFetch<Paginated<T>>(path),
    ...options,
  });
}

export function useApiInvalidation() {
  const client = useQueryClient();
  return {
    invalidate: (key: QueryKeyFn) => client.invalidateQueries({ queryKey: resolveKey(key) }),
    invalidateAll: (prefix: string) => client.invalidateQueries({ queryKey: [prefix] }),
  };
}
