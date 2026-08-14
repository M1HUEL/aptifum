import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="page-center">
      <h1 className="status-code">404</h1>
      <p className="muted">{t('errors.notFound')}</p>
      <Link to="/dashboard" className="btn btn-primary">
        {t('errors.goToDashboard')}
      </Link>
    </div>
  );
}
