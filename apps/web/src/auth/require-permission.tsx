import { Navigate, useLocation } from 'react-router-dom';
import { usePermission } from './auth-context';

export function RequirePermission({ permission, children }: { permission?: string; children: React.ReactNode }) {
  const location = useLocation();
  const can = usePermission();

  if (permission && !can(permission)) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  }
  return children;
}
