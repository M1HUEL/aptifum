import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Paginated } from '../../src/api/types';
import { usePagedQuery } from '../../src/hooks/use-paged-query';

vi.mock('../../src/api/client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../src/api/client';

const mockedFetch = vi.mocked(apiFetch);

function paginated<T>(data: T[]): Paginated<T> {
  return { data, meta: { page: 1, limit: 20, total: data.length } };
}

describe('usePagedQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue(paginated([]));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  function options(query: string) {
    return { path: '/api/v1/test', page: 1, limit: 20, query };
  }

  it('debounces rapid search changes into a single request', async () => {
    const { result, rerender } = renderHook(({ query }) => usePagedQuery(options(query)), {
      wrapper,
      initialProps: { query: '' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.loading).toBe(false);

    const callsAfterMount = mockedFetch.mock.calls.length;

    rerender({ query: 'a' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    rerender({ query: 'ab' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    rerender({ query: 'abc' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    const finalCalls = mockedFetch.mock.calls.length - callsAfterMount;
    expect(finalCalls).toBe(1);
    expect(mockedFetch.mock.calls.at(-1)?.[0]).toContain('q=abc');
  });

  it('requests with the URL-encoded search parameters', async () => {
    const { result, rerender } = renderHook(({ query }) => usePagedQuery(options(query)), {
      wrapper,
      initialProps: { query: '' },
    });

    rerender({ query: 'widget & co' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.loading).toBe(false);
    const lastCall = mockedFetch.mock.calls.at(-1)?.[0];
    expect(lastCall).toContain('q=widget%20%26%20co');
  });
});
