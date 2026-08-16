import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError, downloadFile } from '../../api/client';
import type { CfdiDocument, Invoice } from '../../api/types';
import { Badge, ErrorBanner, formatDate, formatMoney, LoadingBlock } from '../ui';
import { Button } from '../ui/button';
import { DetailTable, SectionHeading } from '../ui/detail-table';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';

const PAYMENT_METHOD_KEYS: Record<string, string> = {
  cash: 'invoices.methods.cash',
  card: 'invoices.methods.card',
  transfer: 'invoices.methods.transfer',
  other: 'invoices.methods.other',
};

function statusTone(status: string): 'success' | 'neutral' | 'danger' {
  switch (status) {
    case 'issued':
    case 'stamped':
      return 'success';
    case 'draft':
    case 'pending':
      return 'neutral';
    default:
      return 'danger';
  }
}

export function InvoiceDetailsModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfdi, setCfdi] = useState<CfdiDocument | null>(null);
  const [cfdiLoading, setCfdiLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setDetail(null);
    setError(null);
    setCfdi(null);
    if (!invoice) return;
    setLoading(true);
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
            <DetailTable
              rows={[
                {
                  label: t('common.status'),
                  value: <Badge tone={statusTone(viewing.status)}>{t(`invoices.${viewing.status}`)}</Badge>,
                },
                { label: t('fields.customer'), value: viewing.customer?.tradeName ?? '—' },
                { label: t('tables.issueDate'), value: formatDate(viewing.issueDate) },
                { label: t('fields.dueDate'), value: viewing.dueDate ? formatDate(viewing.dueDate) : '—' },
                { label: t('fields.subtotal'), value: formatMoney(viewing.subtotal) },
                { label: t('fields.discount'), value: formatMoney(viewing.discount) },
                { label: t('fields.tax'), value: formatMoney(viewing.tax) },
                { label: t('tables.total'), value: formatMoney(viewing.total) },
                { label: t('invoices.paid'), value: formatMoney(viewing.paidAmount) },
                { label: t('invoices.balanceDue'), value: formatMoney(viewing.balanceDue) },
              ]}
            />
            <SectionHeading>{t('invoices.items')}</SectionHeading>
            <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="h-10 bg-bg px-[14px] text-left align-middle text-xs font-medium uppercase tracking-wide text-muted">
                      {t('fields.product')}
                    </th>
                    <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                      {t('fields.qty')}
                    </th>
                    <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                      {t('fields.unitPrice')}
                    </th>
                    <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                      {t('fields.tax')}
                    </th>
                    <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                      {t('invoices.lineTotal')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-[14px] py-2.5 align-middle">{item.description ?? item.product?.name ?? item.productId}</td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">{item.quantity}</td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">{formatMoney(item.unitPrice)}</td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">{formatMoney(item.taxAmount)}</td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(viewing.payments ?? []).length > 0 ? (
              <>
                <SectionHeading>{t('invoices.payments')}</SectionHeading>
                <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="h-10 bg-bg px-[14px] text-left align-middle text-xs font-medium uppercase tracking-wide text-muted">
                          {t('tables.date')}
                        </th>
                        <th className="h-10 bg-bg px-[14px] text-left align-middle text-xs font-medium uppercase tracking-wide text-muted">
                          {t('invoices.method')}
                        </th>
                        <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                          {t('fields.amount')}
                        </th>
                        <th className="h-10 bg-bg px-[14px] text-left align-middle text-xs font-medium uppercase tracking-wide text-muted">
                          {t('invoices.reference')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewing.payments ?? []).map((payment) => (
                        <tr key={payment.id} className="border-t border-border">
                          <td className="px-[14px] py-2.5 align-middle">{formatDate(payment.receivedAt)}</td>
                          <td className="px-[14px] py-2.5 align-middle">{t(PAYMENT_METHOD_KEYS[payment.method] ?? payment.method)}</td>
                          <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">{formatMoney(payment.amount)}</td>
                          <td className="px-[14px] py-2.5 align-middle">{payment.reference ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {viewing.notes ? (
              <div className="mt-5 rounded-ui border border-border bg-bg p-3 text-sm text-text">{viewing.notes}</div>
            ) : null}
            <div className="mb-2 mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
              <h4 className="text-[14px] font-semibold text-text">{t('invoices.cfdi')}</h4>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => void downloadPdf(viewing)}>
                  {t('common.pdf')}
                </Button>
                {!cfdiLoading && cfdi ? (
                  <Button variant="ghost" size="sm" onClick={() => void downloadCfd(cfdi)}>
                    {t('invoices.downloadXml')}
                  </Button>
                ) : null}
              </div>
            </div>
            {cfdiLoading ? <LoadingBlock /> : null}
            {!cfdiLoading && cfdi ? (
              <DetailTable
                rows={[
                  { label: t('invoices.uuid'), value: cfdi.uuid },
                  {
                    label: t('common.status'),
                    value: (
                      <Badge tone={statusTone(cfdi.status)}>
                        {t(cfdi.status === 'stamped' ? 'invoices.stamped' : cfdi.status === 'pending' ? 'invoices.pending' : 'invoices.cancelled')}
                      </Badge>
                    ),
                  },
                  { label: t('tables.total'), value: formatMoney(cfdi.total) },
                  { label: t('invoices.stamped'), value: cfdi.stampedAt ? formatDate(cfdi.stampedAt) : '—' },
                ]}
              />
            ) : null}
            {!cfdiLoading && !cfdi ? <p className="mt-2">{t('invoices.noCfdi')}</p> : null}
          </div>
        ) : null}
        <DialogFooter cancelLabel={t('common.close')} />
      </DialogContent>
    </Dialog>
  );
}
