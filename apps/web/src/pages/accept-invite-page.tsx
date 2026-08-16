import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError } from '../api/client';
import { Input } from '../components/ui';
import { Button } from '../components/ui/button';

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/v1/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
        auth: false,
      });
      navigate('/login', {
        replace: true,
        state: { notice: t('auth.accountReady') },
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? t('auth.tooManyRequests')
            : err.message
          : t('auth.couldNotReachServer'),
      );
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
        <p className="mb-[22px] text-muted">{t('auth.acceptInvitation')}</p>
        {token ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <span>{t('fields.newPassword')}</span>
              <Input
                className="w-full"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <span>{t('fields.confirmPassword')}</span>
              <Input
                className="w-full"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            {error ? (
              <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full" loading={submitting}>
              {submitting ? t('common.saving') : t('auth.setPassword')}
            </Button>
          </form>
        ) : (
          <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
            {t('auth.inviteLinkInvalid')}
          </div>
        )}
        <p className="mb-[22px] text-muted">
          <Link to="/login">{t('auth.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
