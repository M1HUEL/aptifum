import { type FormEvent } from 'react';
import { formatMoney } from '../ui';
import { Button, Field, Modal, Select, TextInput } from '../forms';
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
  return (
    <Modal open={invoice !== null} title={`Payment for ${invoice?.number ?? ''}`} onClose={onClose} width="sm">
      <form onSubmit={onSubmit}>
        <Field label="Method" htmlFor="payment-method" required>
          <Select
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
        </Field>
        <Field
          label="Amount"
          htmlFor="payment-amount"
          required
          hint={
            invoice
              ? `Total due: ${formatMoney(invoice.total, invoice.currency)}${
                  invoice.currency !== FUNCTIONAL_CURRENCY ? ` · rate ${invoice.exchangeRate}` : ''
                }`
              : undefined
          }
        >
          <TextInput
            id="payment-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => onFormChange('amount', event.target.value)}
          />
        </Field>
        <Field label="Received at" htmlFor="payment-date">
          <TextInput
            id="payment-date"
            type="date"
            value={form.receivedAt}
            onChange={(event) => onFormChange('receivedAt', event.target.value)}
          />
        </Field>
        <Field label="Reference" htmlFor="payment-reference">
          <TextInput
            id="payment-reference"
            value={form.reference}
            onChange={(event) => onFormChange('reference', event.target.value)}
          />
        </Field>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
