import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import type { Invoice } from '../../api/types';
import { formatMoney } from '../ui';
import { Button, Field, Modal, Select, TextArea, TextInput } from '../forms';
import { useToast } from '../toast';

const paymentMethods = ['cash', 'card', 'transfer', 'other'] as const;

interface PaymentForm {
  method: string;
  amount: string;
  receivedAt: string;
  reference: string;
  notes: string;
}

const emptyPayment: PaymentForm = {
  method: 'cash',
  amount: '',
  receivedAt: '',
  reference: '',
  notes: '',
};

export function PaymentFormModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PaymentForm>(emptyPayment);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (invoice) {
      setForm({ ...emptyPayment, amount: String(invoice.balanceDue) });
      setFormError(null);
    }
  }, [invoice]);

  const close = () => {
    if (!busy) onClose();
  };

  const setField = (key: keyof PaymentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!invoice) return;
    setBusy(true);
    setFormError(null);
    const body = {
      method: form.method,
      amount: Number(form.amount),
      receivedAt: form.receivedAt || undefined,
      reference: form.reference.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      await apiFetch(`/api/v1/sales/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Payment recorded.');
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not record payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={invoice !== null} title={`Payment for ${invoice?.number ?? ''}`} onClose={close} width="sm">
      <form onSubmit={(event) => void submit(event)}>
        <Field label="Method" htmlFor="payment-method" required>
          <Select
            id="payment-method"
            value={form.method}
            onChange={(event) => setField('method', event.target.value)}
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
          hint={invoice ? `Balance due: ${formatMoney(invoice.balanceDue)}` : undefined}
        >
          <TextInput
            id="payment-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => setField('amount', event.target.value)}
          />
        </Field>
        <Field label="Received at" htmlFor="payment-date">
          <TextInput
            id="payment-date"
            type="date"
            value={form.receivedAt}
            onChange={(event) => setField('receivedAt', event.target.value)}
          />
        </Field>
        <Field label="Reference" htmlFor="payment-reference">
          <TextInput
            id="payment-reference"
            value={form.reference}
            onChange={(event) => setField('reference', event.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor="payment-notes">
          <TextArea
            id="payment-notes"
            rows={2}
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </Field>
        {formError ? <div className="error-banner">{formError}</div> : null}
        <div className="modal-footer">
          <Button variant="ghost" onClick={close} disabled={busy}>
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
