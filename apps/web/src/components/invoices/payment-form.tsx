import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        toast.toast(t('invoices.paymentRecorded'));
        onSaved();
        void invalidate(['paged', '/api/v1/sales/invoices']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  return (
    <Dialog open={invoice !== null} onOpenChange={(next) => !busy && !next && onClose()}>
      <DialogContent>
        <DialogHeader title={t('invoices.paymentFor', { number: invoice?.number })} />
        <form onSubmit={(event) => void submit(event)}>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-method">
              {t('invoices.method')} <span className="text-danger">*</span>
            </label>
            <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="payment-method" {...register('method')}>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-amount">
              {t('fields.amount')} <span className="text-danger">*</span>
            </label>
            {invoice ? (
              <div className="text-[12px] font-normal text-muted">{t('invoices.balanceDueHint', { amount: formatMoney(invoice.balanceDue) })}</div>
            ) : null}
            <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="payment-amount" type="number" min="0.01" step="0.01" {...register('amount')} />
            {errors.amount ? <div className="text-[12px] font-normal text-danger">{errors.amount.message}</div> : null}
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-date">{t('invoices.receivedAt')}</label>
            <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="payment-date" type="date" {...register('receivedAt')} />
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-reference">{t('invoices.reference')}</label>
            <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="payment-reference" {...register('reference')} />
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="payment-notes">{t('fields.notes')}</label>
            <textarea className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="payment-notes" rows={2} {...register('notes')} />
          </div>
          {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
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
