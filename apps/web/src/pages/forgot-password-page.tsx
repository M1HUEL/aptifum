import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError } from '../api/client';

interface ForgotPasswordResult {
  sent: boolean;
  resetToken: string | null;
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null | undefined>(undefined);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<ForgotPasswordResult>('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        auth: false,
      });
      setResetUrl(
        result.resetToken
          ? `${window.location.origin}/reset-password?token=${encodeURIComponent(result.resetToken)}`
          : null,
      );
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
      <div className="w-[360px] rounded-xl bg-surface p-8 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <h1 className="mb-1 text-[22px]">Aptifum ERP</h1>
        <p className="mb-[22px] text-muted">{t('auth.resetPasswordSubtitle')}</p>
        {resetUrl === undefined ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <span>{t('fields.email')}</span>
              <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {error ? (
              <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{error}</div>
            ) : null}
            <button
              type="submit"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-primary bg-primary px-[14px] py-2 text-sm font-semibold text-white select-none hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 w-full"
              disabled={submitting}
            >
              {submitting ? t('auth.sending') : t('auth.sendResetLink')}
            </button>
          </form>
        ) : resetUrl ? (
          <div>
            <div className="mb-4 rounded-ui border border-success/40 bg-success-bg px-[14px] py-2.5 text-success">
              {t('auth.resetLinkGenerated')}
            </div>
            <a
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-primary bg-primary px-[14px] py-2 text-sm font-semibold text-white select-none hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 w-full"
              href={resetUrl}
            >
              {t('auth.openResetLink')}
            </a>
          </div>
        ) : (
          <div className="mb-4 rounded-ui border border-success/40 bg-success-bg px-[14px] py-2.5 text-success">
            {t('auth.resetLinkSent')}
          </div>
        )}
        <p className="mb-[22px] text-muted">
          <Link to="/login">{t('auth.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
