import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError } from '../api/client';

export function ResetPasswordPage() {
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
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
        auth: false,
      });
      navigate('/login', {
        replace: true,
        state: { notice: t('auth.passwordReset') },
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
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Aptifum ERP</h1>
        <p className="login-subtitle">{t('auth.chooseNewPassword')}</p>
        {token ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>{t('fields.newPassword')}</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('fields.confirmPassword')}</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            {error ? <div className="error-banner">{error}</div> : null}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? t('common.saving') : t('auth.resetPassword')}
            </button>
          </form>
        ) : (
          <div className="error-banner">
            {t('auth.resetLinkInvalid')}
          </div>
        )}
        <p className="login-subtitle">
          <Link to="/login">{t('auth.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
