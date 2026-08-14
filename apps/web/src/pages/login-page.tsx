import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/auth-context';

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
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Aptifum ERP</h1>
        <p className="login-subtitle">{t('auth.signInSubtitle')}</p>
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
          <label className="field">
            <span>{t('fields.password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {notice ? <div className="success-banner">{notice}</div> : null}
          {error ? <div className="error-banner">{error}</div> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? t('auth.signingIn') : t('auth.loginTitle')}
          </button>
        </form>
        <p className="login-subtitle">
          <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
        </p>
      </div>
    </div>
  );
}
