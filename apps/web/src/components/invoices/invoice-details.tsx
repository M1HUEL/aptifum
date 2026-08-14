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
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">{t('common.status')}</div>
                <div className="detail-value">
                  <Badge
                    tone={viewing.status === 'issued' ? 'success' : viewing.status === 'draft' ? 'neutral' : 'danger'}
                  >
                    {viewing.status}
                  </Badge>
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('fields.customer')}</div>
                <div className="detail-value">{viewing.customer?.tradeName ?? '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('tables.issueDate')}</div>
                <div className="detail-value">{formatDate(viewing.issueDate)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('fields.dueDate')}</div>
                <div className="detail-value">{viewing.dueDate ? formatDate(viewing.dueDate) : '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('fields.subtotal')}</div>
                <div className="detail-value num">{formatMoney(viewing.subtotal)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('fields.discount')}</div>
                <div className="detail-value num">{formatMoney(viewing.discount)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('fields.tax')}</div>
                <div className="detail-value num">{formatMoney(viewing.tax)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('tables.total')}</div>
                <div className="detail-value num">{formatMoney(viewing.total)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('invoices.paid')}</div>
                <div className="detail-value num">{formatMoney(viewing.paidAmount)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">{t('invoices.balanceDue')}</div>
                <div className="detail-value num">{formatMoney(viewing.balanceDue)}</div>
              </div>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('fields.product')}</th>
                    <th className="num">{t('fields.qty')}</th>
                    <th className="num">{t('fields.unitPrice')}</th>
                    <th className="num">{t('fields.tax')}</th>
                    <th className="num">{t('invoices.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.description ?? item.product?.name ?? item.productId}</td>
                      <td className="num">{item.quantity}</td>
                      <td className="num">{formatMoney(item.unitPrice)}</td>
                      <td className="num">{formatMoney(item.taxAmount)}</td>
                      <td className="num">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(viewing.payments ?? []).length > 0 ? (
              <>
                <h4 className="detail-section-title">{t('invoices.payments')}</h4>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('tables.date')}</th>
                        <th>{t('invoices.method')}</th>
                        <th className="num">{t('fields.amount')}</th>
                        <th>{t('invoices.reference')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewing.payments ?? []).map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.receivedAt)}</td>
                          <td>{payment.method}</td>
                          <td className="num">{formatMoney(payment.amount)}</td>
                          <td>{payment.reference ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {viewing.notes ? <div className="detail-notes">{viewing.notes}</div> : null}
            <div className="detail-section-title-row">
              <h4 className="detail-section-title">{t('invoices.cfdi')}</h4>
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
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">{t('invoices.uuid')}</div>
                  <div className="detail-value">{cfdi.uuid}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('common.status')}</div>
                  <div className="detail-value">
                    <Badge
                      tone={cfdi.status === 'stamped' ? 'success' : cfdi.status === 'pending' ? 'neutral' : 'danger'}
                    >
                      {cfdi.status}
                    </Badge>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('tables.total')}</div>
                  <div className="detail-value num">{formatMoney(cfdi.total)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('invoices.stamped')}</div>
                  <div className="detail-value">{cfdi.stampedAt ? formatDate(cfdi.stampedAt) : '—'}</div>
                </div>
              </div>
            ) : null}
            {!cfdiLoading && !cfdi ? <p className="detail-notes">{t('invoices.noCfdi')}</p> : null}
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
