import i18n from '../i18n';

import type { ApiErrorBody, AuthResult } from './types';

const ACCESS_KEY = 'aptifum.accessToken';
const REFRESH_KEY = 'aptifum.refreshToken';

let refreshPromise: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function storeTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly rawMessage: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.rawMessage = body.message || `Request failed (${status})`;
    this.message = this.translatedMessage;
  }

  get translatedMessage(): string {
    if (this.status === 401) return i18n.t('errors.unauthorized');
    if (this.status === 403) return i18n.t('errors.forbidden');
    if (this.status === 404) return i18n.t('errors.notFound');
    if (this.status >= 500) return i18n.t('errors.server');
    return this.rawMessage;
  }
}

async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = (await res.json()) as AuthResult;
      storeTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface ApiFetchOptions extends RequestInit {
  auth?: boolean;
}

async function parseError(res: Response): Promise<ApiErrorBody> {
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return { code: 'HTTP_ERROR', message: res.statusText || `Request failed (${res.status})`, requestId: '' };
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    const h: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
    if (auth) {
      const token = getAccessToken();
      if (token) h.Authorization = `Bearer ${token}`;
    }
    return fetch(path, { ...rest, headers: h });
  };

  let res = await doFetch();
  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await doFetch();
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  if (res.status === 204 || (res.headers.get('content-type') ?? '').includes('application/json') === false) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function downloadFile(path: string, fallbackName = 'download'): Promise<void> {
  let res = await fetch(path, {
    headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()!}` } : {},
  });
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await fetch(path, {
        headers: { Authorization: `Bearer ${getAccessToken()!}` },
      });
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadCsv(path: string): Promise<void> {
  await downloadFile(path, 'export.csv');
}
