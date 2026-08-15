import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError, downloadFile } from '../../api/client';
import type { CfdiDocument, Invoice } from '../../api/types';
import { Badge, ErrorBanner, formatDate, formatMoney, LoadingBlock } from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';

export function InvoiceDetailsModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfdi, setCfdi] = useState<CfdiDocument | null>(null);
  const [cfdiLoading, setCfdiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!invoice) return;
    setDetail(null);
    setLoading(true);
    setError(null);
    setCfdi(null);
    setCfdiLoading(true);
    void apiFetch<Invoice>(`/api/v1/sales/invoices/${invoice.id}`)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t('invoices.couldNotLoad')))
      .finally(() => setLoading(false));
    void apiFetch<CfdiDocument>(`/api/v1/tax/cfdi/invoices/${invoice.id}`)
      .then(setCfdi)
      .catch(() => setCfdi(null))
      .finally(() => setCfdiLoading(false));
  }, [invoice]);

  const downloadPdf = async (row: Invoice) => {
    try {
      await downloadFile(`/api/v1/sales/invoices/${row.id}/pdf`, `invoice-${row.number}.pdf`);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : t('reports.couldNotDownloadPdf'), 'error');
    }
  };

  const downloadCfd = async (cfdiDoc: CfdiDocument) => {
    try {
      await downloadFile(`/api/v1/tax/cfdi/${cfdiDoc.id}/xml`, `${cfdiDoc.uuid}.xml`);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : t('invoices.couldNotDownloadCfdi'), 'error');
    }
  };

  const viewing = detail ?? invoice;

  return (
    <Dialog open={viewing !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title={`${t(viewing?.type === 'credit_note' ? 'invoices.creditNote' : 'invoices.invoice')} ${viewing?.number ?? ''}`}
        />
        {loading ? <LoadingBlock /> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading && viewing ? (
          <div>
            <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('common.status')}</div>
                <div className="mt-0.5 block">
                  <Badge
                    tone={viewing.status === 'issued' ? 'success' : viewing.status === 'draft' ? 'neutral' : 'danger'}
                  >
                    {viewing.status}
                  </Badge>
                </div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.customer')}</div>
                <div className="mt-0.5 block">{viewing.customer?.tradeName ?? '—'}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('tables.issueDate')}</div>
                <div className="mt-0.5 block">{formatDate(viewing.issueDate)}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.dueDate')}</div>
                <div className="mt-0.5 block">{viewing.dueDate ? formatDate(viewing.dueDate) : '—'}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.subtotal')}</div>
                <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.subtotal)}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.discount')}</div>
                <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.discount)}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.tax')}</div>
                <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.tax)}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('tables.total')}</div>
                <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.total)}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('invoices.paid')}</div>
                <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.paidAmount)}</div>
              </div>
              <div className="detail-item">
                <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('invoices.balanceDue')}</div>
                <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.balanceDue)}</div>
              </div>
            </div>
            <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th>{t('fields.product')}</th>
                    <th className="text-right tabular-nums">{t('fields.qty')}</th>
                    <th className="text-right tabular-nums">{t('fields.unitPrice')}</th>
                    <th className="text-right tabular-nums">{t('fields.tax')}</th>
                    <th className="text-right tabular-nums">{t('invoices.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.description ?? item.product?.name ?? item.productId}</td>
                      <td className="text-right tabular-nums">{item.quantity}</td>
                      <td className="text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                      <td className="text-right tabular-nums">{formatMoney(item.taxAmount)}</td>
                      <td className="text-right tabular-nums">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(viewing.payments ?? []).length > 0 ? (
              <>
                <h4 className="mb-2 mt-4 text-[14px]">{t('invoices.payments')}</h4>
                <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th>{t('tables.date')}</th>
                        <th>{t('invoices.method')}</th>
                        <th className="text-right tabular-nums">{t('fields.amount')}</th>
                        <th>{t('invoices.reference')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewing.payments ?? []).map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.receivedAt)}</td>
                          <td>{payment.method}</td>
                          <td className="text-right tabular-nums">{formatMoney(payment.amount)}</td>
                          <td>{payment.reference ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {viewing.notes ? <div className="mt-2">{viewing.notes}</div> : null}
            <div className="flex items-center justify-between gap-2">
              <h4 className="mb-2 mt-4 text-[14px]">{t('invoices.cfdi')}</h4>
              <Button variant="ghost" size="sm" onClick={() => void downloadPdf(viewing)}>
                {t('common.pdf')}
              </Button>
              {!cfdiLoading && cfdi ? (
                <Button variant="ghost" size="sm" onClick={() => void downloadCfd(cfdi)}>
                  {t('invoices.downloadXml')}
                </Button>
              ) : null}
            </div>
            {cfdiLoading ? <LoadingBlock /> : null}
            {!cfdiLoading && cfdi ? (
              <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('invoices.uuid')}</div>
                  <div className="mt-0.5 block">{cfdi.uuid}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('common.status')}</div>
                  <div className="mt-0.5 block">
                    <Badge
                      tone={cfdi.status === 'stamped' ? 'success' : cfdi.status === 'pending' ? 'neutral' : 'danger'}
                    >
                      {cfdi.status}
                    </Badge>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('tables.total')}</div>
                  <div className="mt-0.5 text-right tabular-nums">{formatMoney(cfdi.total)}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('invoices.stamped')}</div>
                  <div className="mt-0.5 block">{cfdi.stampedAt ? formatDate(cfdi.stampedAt) : '—'}</div>
                </div>
              </div>
            ) : null}
            {!cfdiLoading && !cfdi ? <p className="mt-2">{t('invoices.noCfdi')}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
