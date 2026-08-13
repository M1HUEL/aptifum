import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';

export function AcceptInvitePage() {
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
      setError('Passwords do not match.');
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
        state: { notice: 'Your account is ready. Sign in with your new password.' },
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? 'Too many requests. Please wait a minute and try again.'
            : err.message
          : 'Could not reach the server.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Aptifum ERP</h1>
        <p className="login-subtitle">Accept your invitation</p>
        {token ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>New password</span>
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
              <span>Confirm password</span>
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
              {submitting ? 'Saving…' : 'Set password'}
            </button>
          </form>
        ) : (
          <div className="error-banner">This invite link is missing or invalid.</div>
        )}
        <p className="login-subtitle">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
