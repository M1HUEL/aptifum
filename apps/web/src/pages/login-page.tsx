import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { Input } from '../components/ui';
import { Button } from '../components/ui/button';

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(t('auth.tooManyLoginAttempts'));
        } else if (err.status === 401) {
          setError(t('auth.invalidCredentials'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('auth.couldNotReachServer'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#121a2b] via-[#1e2a44] to-primary">
      <div className="w-[360px] rounded-ui border border-border bg-surface p-8 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <svg className="mx-auto mb-3 block" aria-hidden="true" width="44" height="44" viewBox="0 0 44 44" fill="none">
          <rect width="44" height="44" rx="10" fill="var(--color-primary)" />
          <path d="M22 9 L36 35 H29.5 L22 19 L14.5 35 H8 Z" fill="#ffffff" />
        </svg>
        <h1 className="mb-1 text-[22px]">Aptifum ERP</h1>
        <p className="mb-[22px] text-muted">{t('auth.signInSubtitle')}</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <span>{t('fields.email')}</span>
            <Input
              className="w-full"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <span>{t('fields.password')}</span>
            <Input
              className="w-full"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {notice ? (
            <div className="mb-4 rounded-ui border border-success/40 bg-success-bg px-[14px] py-2.5 text-success">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="w-full" loading={submitting}>
            {submitting ? t('auth.signingIn') : t('auth.loginTitle')}
          </Button>
        </form>
        <p className="mb-[22px] text-muted">
          <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
        </p>
      </div>
    </div>
  );
}
