import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { Invoice } from '../../api/types';
import { paymentFormSchema, type PaymentFormValues } from '../../api/schemas';
import { useApiInvalidation, useApiMutation } from '../../api/hooks';
import { formatMoney } from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';

type CreatePaymentDto = components['schemas']['CreatePaymentDto'];

const paymentMethods = ['cash', 'card', 'transfer', 'other'] as const;

const emptyPayment: PaymentFormValues = {
  method: 'cash',
  amount: '',
  receivedAt: '',
  reference: '',
  notes: '',
};

function toDto(form: PaymentFormValues): CreatePaymentDto {
  return {
    method: form.method,
    amount: Number(form.amount),
    receivedAt: form.receivedAt || undefined,
    reference: form.reference.trim() || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function PaymentFormModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: emptyPayment,
  });

  const paymentMutation = useApiMutation<CreatePaymentDto>(
    `/api/v1/sales/invoices/${invoice?.id ?? ''}/payments`,
    'POST',
  );
  const busy = paymentMutation.isPending;

  useEffect(() => {
    if (invoice) {
      reset({ ...emptyPayment, amount: String(invoice.balanceDue) });
      setFormError(null);
    }
  }, [invoice, reset]);

  const submit = handleSubmit((values) => {
    if (!invoice) return;
    setFormError(null);
    paymentMutation.mutate(toDto(values), {
      onSuccess: () => {
        toast.toast('Payment recorded.');
        onSaved();
        void invalidate(['paged', '/api/v1/sales/invoices']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  return (
    <Dialog open={invoice !== null} onOpenChange={(next) => !busy && !next && onClose()}>
      <DialogContent>
        <DialogHeader title={`Payment for ${invoice?.number ?? ''}`} />
        <form onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor="payment-method">Method *</label>
            <select id="payment-method" {...register('method')}>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="payment-amount">Amount *</label>
            {invoice ? (
              <div className="field-hint">Balance due: {formatMoney(invoice.balanceDue)}</div>
            ) : null}
            <input id="payment-amount" type="number" min="0.01" step="0.01" {...register('amount')} />
            {errors.amount ? <div className="field-error">{errors.amount.message}</div> : null}
          </div>
          <div className="field">
            <label htmlFor="payment-date">Received at</label>
            <input id="payment-date" type="date" {...register('receivedAt')} />
          </div>
          <div className="field">
            <label htmlFor="payment-reference">Reference</label>
            <input id="payment-reference" {...register('reference')} />
          </div>
          <div className="field">
            <label htmlFor="payment-notes">Notes</label>
            <textarea id="payment-notes" rows={2} {...register('notes')} />
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <DialogFooter>
            <Button variant="default" type="submit" disabled={busy}>
              {busy ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
