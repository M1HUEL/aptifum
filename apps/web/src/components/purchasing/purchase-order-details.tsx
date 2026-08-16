import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError } from '../../api/client';
import type { PurchaseOrder } from '../../api/types';
import { Badge, type BadgeTone, ErrorBanner, formatDate, formatMoney, LoadingBlock } from '../ui';
import { DetailTable, SectionHeading } from '../ui/detail-table';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';

function statusTone(status: PurchaseOrder['status']): BadgeTone {
  if (status === 'received') return 'success';
  if (status === 'approved') return 'info';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

export function PurchaseOrderDetailsModal({ order, onClose }: { order: PurchaseOrder | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!order) return;
    setLoading(true);
    void apiFetch<PurchaseOrder>(`/api/v1/purchasing/purchase-orders/${order.id}`)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t('purchaseOrders.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [order]);

  const viewing = detail ?? order;

  return (
    <Dialog open={viewing !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader title={`${t('purchaseOrders.order')} ${viewing?.number ?? ''}`} />
        {loading ? <LoadingBlock /> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading && viewing ? (
          <div>
            <DetailTable
              rows={[
                {
                  label: t('common.status'),
                  value: <Badge tone={statusTone(viewing.status)}>{t(`purchaseOrders.${viewing.status}`)}</Badge>,
                },
                { label: t('purchaseOrders.supplier'), value: viewing.supplier?.tradeName ?? '—' },
                { label: t('fields.warehouse'), value: viewing.warehouse?.name ?? '—' },
                { label: t('tables.issueDate'), value: formatDate(viewing.issueDate) },
                {
                  label: t('purchaseOrders.expectedAt'),
                  value: viewing.expectedAt ? formatDate(viewing.expectedAt) : '—',
                },
                { label: t('fields.subtotal'), value: formatMoney(viewing.subtotal) },
                { label: t('fields.discount'), value: formatMoney(viewing.discount) },
                { label: t('fields.tax'), value: formatMoney(viewing.tax) },
                { label: t('tables.total'), value: formatMoney(viewing.total) },
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
                      {t('fields.unitCost')}
                    </th>
                    <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                      {t('purchaseOrders.received')}
                    </th>
                    <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                      {t('invoices.lineTotal')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-[14px] py-2.5 align-middle">
                        {item.description ?? item.product?.name ?? item.productId}
                      </td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">{item.quantity}</td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">
                        {formatMoney(item.unitCost)}
                      </td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">{item.receivedQuantity}</td>
                      <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">
                        {formatMoney(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewing.notes ? (
              <div className="mt-5 rounded-ui border border-border bg-bg p-3 text-sm text-text">{viewing.notes}</div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter cancelLabel={t('common.close')} />
      </DialogContent>
    </Dialog>
  );
}
