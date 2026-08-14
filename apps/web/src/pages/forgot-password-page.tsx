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
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Aptifum ERP</h1>
        <p className="login-subtitle">{t('auth.resetPasswordSubtitle')}</p>
        {resetUrl === undefined ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>{t('fields.email')}</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? t('auth.sending') : t('auth.sendResetLink')}
            </button>
          </form>
        ) : resetUrl ? (
          <div>
            <div className="success-banner">
              {t('auth.resetLinkGenerated')}
            </div>
            <a className="btn btn-primary btn-block" href={resetUrl}>
              {t('auth.openResetLink')}
            </a>
          </div>
        ) : (
          <div className="success-banner">
            {t('auth.resetLinkSent')}
          </div>
        )}
        <p className="login-subtitle">
          <Link to="/login">{t('auth.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
