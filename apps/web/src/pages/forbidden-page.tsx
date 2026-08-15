import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function ForbiddenPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="m-0 text-5xl font-bold text-primary">403</h1>
      <p className="text-[12px] text-muted">{from ? t('errors.forbiddenFor', { page: from }) : t('errors.forbidden')}</p>
      <Link to="/dashboard" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-primary bg-primary px-[14px] py-2 text-sm font-semibold text-white select-none hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
        {t('errors.goToDashboard')}
      </Link>
    </div>
  );
}
