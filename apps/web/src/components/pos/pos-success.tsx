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
    <div className="mb-5 rounded-ui border border-border bg-surface p-5 shadow-(--shadow)">
      <div className="mb-4 rounded-ui border border-success/40 bg-success-bg px-[14px] py-2.5 text-success">{t('pos.saleCompleted')}</div>
      <h3 className="mb-3.5 text-[15px]">{t('pos.invoiceNumber', { number: sale.number })}</h3>
      <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="detail-item">
          <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('tables.total')}</div>
          <div className="mt-0.5 text-right tabular-nums">{formatMoney(sale.total, sale.currency)}</div>
        </div>
        <div className="detail-item">
          <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('invoices.paid')}</div>
          <div className="mt-0.5 text-right tabular-nums">{formatMoney(sale.paidAmount, sale.currency)}</div>
        </div>
        <div className="detail-item">
          <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('invoices.balanceDue')}</div>
          <div className="mt-0.5 text-right tabular-nums">
            {sale.balanceDue > 0 ? formatMoney(sale.balanceDue, sale.currency) : '—'}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onDownloadPdf(sale)}>
          {t('common.downloadPdf')}
        </Button>
        <Link to="/invoices" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50">
          {t('pos.viewInvoices')}
        </Link>
        <Button onClick={onReset}>{t('pos.newSale')}</Button>
      </div>
    </div>
  );
}
