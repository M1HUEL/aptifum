import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../ui';
import { Button } from '../ui/button';

export interface CompletedSale {
  id: string;
  number: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
}

export function PosSuccess({
  sale,
  onDownloadPdf,
  onReset,
}: {
  sale: CompletedSale;
  onDownloadPdf: (sale: CompletedSale) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="card pos-success">
      <div className="success-banner">{t('pos.saleCompleted')}</div>
      <h3 className="card-title">{t('pos.invoiceNumber', { number: sale.number })}</h3>
      <div className="detail-grid">
        <div className="detail-item">
          <div className="detail-label">{t('tables.total')}</div>
          <div className="detail-value num">{formatMoney(sale.total, sale.currency)}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">{t('invoices.paid')}</div>
          <div className="detail-value num">{formatMoney(sale.paidAmount, sale.currency)}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">{t('invoices.balanceDue')}</div>
          <div className="detail-value num">
            {sale.balanceDue > 0 ? formatMoney(sale.balanceDue, sale.currency) : '—'}
          </div>
        </div>
      </div>
      <div className="pos-success-actions">
        <Button variant="ghost" onClick={() => onDownloadPdf(sale)}>
          {t('common.downloadPdf')}
        </Button>
        <Link to="/invoices" className="btn">
          {t('pos.viewInvoices')}
        </Link>
        <Button onClick={onReset}>{t('pos.newSale')}</Button>
      </div>
    </div>
  );
}
