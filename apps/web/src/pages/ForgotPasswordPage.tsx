import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';

interface ForgotPasswordResult {
  sent: boolean;
  resetToken: string | null;
}

export function ForgotPasswordPage() {
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
        <p className="login-subtitle">Reset your password</p>
        {resetUrl === undefined ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>Email</span>
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
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        ) : resetUrl ? (
          <div>
            <div className="success-banner">
              A reset link was generated. Demo mode has no email server, so use the link below:
            </div>
            <a className="btn btn-primary btn-block" href={resetUrl}>
              Open reset link
            </a>
          </div>
        ) : (
          <div className="success-banner">
            If an account exists for that email, a reset link will be sent to it.
          </div>
        )}
        <p className="login-subtitle">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
