import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page-center">
      <h1 className="status-code">404</h1>
      <p className="muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Go to dashboard
      </Link>
    </div>
  );
}
