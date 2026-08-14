import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function ForbiddenPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return (
    <div className="page-center">
      <h1 className="status-code">403</h1>
      <p className="muted">{from ? t('errors.forbiddenFor', { page: from }) : t('errors.forbidden')}</p>
      <Link to="/dashboard" className="btn btn-primary">
        {t('errors.goToDashboard')}
      </Link>
    </div>
  );
}
