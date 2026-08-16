import { type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, Input, Select } from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { FUNCTIONAL_CURRENCY } from './pos-ticket';

const paymentMethods = ['cash', 'card', 'transfer', 'other'] as const;

export interface InvoiceLike {
  id: string;
  number: string;
  total: number;
  balanceDue: number;
  paidAmount: number;
  currency: string;
  exchangeRate: number;
}

export interface PaymentForm {
  method: string;
  amount: string;
  receivedAt: string;
  reference: string;
}

export function PosPaymentModal({
  invoice,
  form,
  onFormChange,
  error,
  busy,
  onSubmit,
  onClose,
}: {
  invoice: InvoiceLike | null;
  form: PaymentForm;
  onFormChange: (key: keyof PaymentForm, value: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={invoice !== null} onOpenChange={(isOpen) => !busy && !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader title={t('invoices.paymentFor', { number: invoice?.number })} />
        <form onSubmit={onSubmit}>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-method">
              {t('invoices.method')}
              <span className="text-danger"> *</span>
            </label>
            <Select
              className="w-full"
              id="payment-method"
              value={form.method}
              onChange={(event) => onFormChange('method', event.target.value)}
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-amount">
              {t('fields.amount')}
              <span className="text-danger"> *</span>
            </label>
            <Input
              className="w-full"
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => onFormChange('amount', event.target.value)}
            />
            {invoice ? (
              <div className="text-[12px] font-normal text-muted">
                {t('pos.totalDue', { amount: formatMoney(invoice.total, invoice.currency) })}
                {invoice.currency !== FUNCTIONAL_CURRENCY ? t('pos.rateSuffix', { rate: invoice.exchangeRate }) : ''}
              </div>
            ) : null}
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-date">{t('invoices.receivedAt')}</label>
            <Input
              className="w-full"
              id="payment-date"
              type="date"
              value={form.receivedAt}
              onChange={(event) => onFormChange('receivedAt', event.target.value)}
            />
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-reference">{t('invoices.reference')}</label>
            <Input
              className="w-full"
              id="payment-reference"
              value={form.reference}
              onChange={(event) => onFormChange('reference', event.target.value)}
            />
          </div>
          {error ? (
            <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
              {error}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="default" type="submit" disabled={busy} loading={busy}>
              {busy ? t('invoices.recording') : t('invoices.recordPayment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
