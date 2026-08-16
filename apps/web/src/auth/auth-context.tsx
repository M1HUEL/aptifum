import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, clearTokens, getAccessToken, getRefreshToken, storeTokens } from '../api/client';
import type { AuthResult, UserProfile } from '../api/types';

interface AuthContextValue {
  user: UserProfile | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!getAccessToken() || !getRefreshToken()) {
        if (!cancelled) setInitializing(false);
        return;
      }
      try {
        const me = await apiFetch<UserProfile>('/api/v1/auth/me');
        if (!cancelled) setUser(me);
      } catch {
        clearTokens();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<AuthResult>('/api/v1/auth/login', {
      method: 'POST',
      auth: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    storeTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        await apiFetch('/api/v1/auth/logout', {
          method: 'POST',
          auth: false,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
        });
      }
    } catch {
      // idempotent: the API ignores invalid or already-revoked tokens
    }
    clearTokens();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const me = await apiFetch<UserProfile>('/api/v1/auth/me');
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, logout, refreshProfile }),
    [user, initializing, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function usePermission(): (permission: string) => boolean {
  const { user } = useAuth();
  return useCallback(
    (permission: string) => {
      if (!user) return false;
      return user.roles.some((role) => role.permissions.includes('*') || role.permissions.includes(permission));
    },
    [user],
  );
}
