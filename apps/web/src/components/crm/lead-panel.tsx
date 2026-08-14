import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { Lead } from '../../api/types';
import { leadFormSchema, type LeadFormValues } from '../../api/schemas';
import { useApiMutation, useApiMutationVoid } from '../../api/hooks';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { leadStatusTone, leadStatuses } from './crm-helpers';

type CreateLeadDto = components['schemas']['CreateLeadDto'];
type UpdateLeadDto = components['schemas']['UpdateLeadDto'];

const emptyLead: LeadFormValues = {
  source: '',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  status: 'new',
  estimatedAmount: '',
  currency: 'USD',
  notes: '',
};

function toLeadForm(lead: Lead): LeadFormValues {
  return {
    source: lead.source ?? '',
    companyName: lead.companyName ?? '',
    contactName: lead.contactName,
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    status: lead.status,
    estimatedAmount: lead.estimatedAmount ? String(lead.estimatedAmount) : '',
    currency: lead.currency,
    notes: lead.notes ?? '',
  };
}

function leadToDto(form: LeadFormValues): CreateLeadDto {
  return {
    source: form.source.trim() || undefined,
    companyName: form.companyName.trim() || undefined,
    contactName: form.contactName.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    status: form.status,
    estimatedAmount: form.estimatedAmount === '' ? undefined : Number(form.estimatedAmount),
    currency: form.currency.trim().toUpperCase() || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function LeadPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Lead>({ path: '/api/v1/crm/leads', page: 1, limit: 50 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: emptyLead,
  });

  const createMutation = useApiMutation<CreateLeadDto>('/api/v1/crm/leads', 'POST');
  const updateMutation = useApiMutation<UpdateLeadDto>(`/api/v1/crm/leads/${editingId ?? ''}`, 'PATCH');
  const convertMutation = useApiMutation<{ customerCode?: string }>(
    `/api/v1/crm/leads/${converting?.id ?? ''}/convert`,
    'POST',
  );
  const deleteMutation = useApiMutationVoid(`/api/v1/crm/leads/${deleting?.id ?? ''}`, 'DELETE');

  const saving = createMutation.isPending || updateMutation.isPending;
  const convertBusy = convertMutation.isPending;
  const deletingBusy = deleteMutation.isPending;

  const openCreate = () => {
    setEditingId(null);
    reset(emptyLead);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    reset(toLeadForm(lead));
    setFormError(null);
    setOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? t('crm.leadUpdated') : t('crm.leadCreated'));
      setOpen(false);
      void reload();
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(leadToDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(leadToDto(values), { onSuccess, onError });
    }
  });

  const confirmConvert = () => {
    if (!converting) return;
    convertMutation.mutate(
      { customerCode: customerCode.trim() || undefined },
      {
        onSuccess: () => {
          toast.toast(t('crm.leadConverted'));
          setConverting(null);
          setCustomerCode('');
          void reload();
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
          setConverting(null);
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t('crm.leadDeleted'));
        setDeleting(null);
        void reload();
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeleting(null);
      },
    });
  };

  const columns: Column<Lead>[] = [
    { key: 'number', header: t('tables.number') },
    { key: 'contactName', header: t('crm.contact') },
    { key: 'companyName', header: t('crm.company'), render: (row) => row.companyName ?? '—' },
    { key: 'email', header: t('fields.email'), render: (row) => row.email ?? '—' },
    { key: 'estimatedAmount', header: t('fields.estimatedAmount'), render: (row) => formatMoney(row.estimatedAmount) },
    { key: 'status', header: t('common.status'), render: (row) => <Badge tone={leadStatusTone(row.status)}>{row.status}</Badge> },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="table-actions">
          {row.status !== 'converted' ? (
            <Button variant="ghost" size="sm" onClick={() => setConverting(row)}>
              {t('crm.convert')}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('crm.leadsTitle')}
        subtitle={t('crm.leadsSubtitle')}
        action={<Button onClick={openCreate}>{t('crm.newLead')}</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('crm.noLeads')} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? t('crm.editLead') : t('crm.newLead')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="lead-contact">
                  {t('fields.contactName')}<span className="field-required"> *</span>
                </label>
                <input id="lead-contact" {...register('contactName')} />
                {errors.contactName ? (
                  <div className="field-error">{errors.contactName.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="lead-company">{t('crm.company')}</label>
                <input id="lead-company" {...register('companyName')} />
              </div>
              <div className="field">
                <label htmlFor="lead-email">{t('fields.email')}</label>
                <input id="lead-email" type="email" {...register('email')} />
              </div>
              <div className="field">
                <label htmlFor="lead-phone">{t('fields.phone')}</label>
                <input id="lead-phone" {...register('phone')} />
              </div>
              <div className="field">
                <label htmlFor="lead-source">{t('crm.source')}</label>
                <input id="lead-source" {...register('source')} />
              </div>
              <div className="field">
                <label htmlFor="lead-status">{t('common.status')}</label>
                <select id="lead-status" {...register('status')}>
                  {leadStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="lead-amount">{t('fields.estimatedAmount')}</label>
                <input id="lead-amount" type="number" min="0" step="0.01" {...register('estimatedAmount')} />
              </div>
              <div className="field">
                <label htmlFor="lead-currency">{t('fields.currency')}</label>
                <input id="lead-currency" maxLength={3} {...register('currency')} />
              </div>
              <div className="field">
                <label htmlFor="lead-notes">{t('fields.notes')}</label>
                <textarea id="lead-notes" rows={3} {...register('notes')} />
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('crm.createLead')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={converting !== null} onOpenChange={(isOpen) => !convertBusy && !isOpen && setConverting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader title={t('crm.convertLeadTitle', { number: converting?.number })} />
          <p className="modal-message">{t('crm.convertLeadMessage', { name: converting?.contactName })}</p>
          <div className="field">
            <label htmlFor="convert-code">{t('crm.customerCode')}</label>
            <input id="convert-code" value={customerCode} onChange={(event) => setCustomerCode(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="default" type="button" disabled={convertBusy} onClick={() => void confirmConvert()}>
              {convertBusy ? t('crm.converting') : t('crm.convertToCustomer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}>
        <DialogContent>
          <DialogHeader
            title={t('crm.deleteLeadTitle')}
            description={t('crm.deleteLeadMessage', { name: deleting?.contactName })}
          />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deletingBusy} onClick={() => void confirmDelete()}>
              {deletingBusy ? t('common.working') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
