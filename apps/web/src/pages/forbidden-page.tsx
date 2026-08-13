import { Link, useLocation } from 'react-router-dom';

export function ForbiddenPage() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return (
    <div className="page-center">
      <h1 className="status-code">403</h1>
      <p className="muted">You don&apos;t have permission to access{from ? ` ${from}` : ' this page'}.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Go to dashboard
      </Link>
    </div>
  );
}
