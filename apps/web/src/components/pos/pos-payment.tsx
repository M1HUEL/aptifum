import { type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../ui';
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
          <div className="field">
            <label htmlFor="payment-method">
              {t('invoices.method')}<span className="field-required"> *</span>
            </label>
            <select
              id="payment-method"
              value={form.method}
              onChange={(event) => onFormChange('method', event.target.value)}
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="payment-amount">
              {t('fields.amount')}<span className="field-required"> *</span>
            </label>
            <input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => onFormChange('amount', event.target.value)}
            />
            {invoice ? (
              <div className="field-hint">
                {t('pos.totalDue', { amount: formatMoney(invoice.total, invoice.currency) })}
                {invoice.currency !== FUNCTIONAL_CURRENCY ? t('pos.rateSuffix', { rate: invoice.exchangeRate }) : ''}
              </div>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="payment-date">{t('invoices.receivedAt')}</label>
            <input
              id="payment-date"
              type="date"
              value={form.receivedAt}
              onChange={(event) => onFormChange('receivedAt', event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="payment-reference">{t('invoices.reference')}</label>
            <input
              id="payment-reference"
              value={form.reference}
              onChange={(event) => onFormChange('reference', event.target.value)}
            />
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
          <DialogFooter>
            <Button variant="default" type="submit" disabled={busy}>
              {busy ? t('invoices.recording') : t('invoices.recordPayment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
