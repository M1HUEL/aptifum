import { zodResolver } from '@hookform/resolvers/zod';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useApiMutation, useApiMutationVoid } from '../../api/hooks';
import type { components } from '../../api/schema';
import { leadFormSchema, type LeadFormValues } from '../../api/schemas';
import type { Lead } from '../../api/types';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { exportRowsToCsv } from '../../lib/csv';
import { useToast } from '../toast';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatMoney,
  PageHeader,
  Pagination,
  TableSkeleton,
  Input,
  Select,
  Textarea,
} from '../ui';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';

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
  const [limit, setLimit] = useState(50);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Lead>({ path: '/api/v1/crm/leads', page: 1, limit });

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
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={leadStatusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
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

  const handleLimitChange = (next: number) => {
    setLimit(next);
  };

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'leads', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('crm.leadsTitle')}
        subtitle={t('crm.leadsSubtitle')}
        action={
          <div className="flex justify-end gap-2">
            <Button type="button" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </Button>
            <Button onClick={openCreate}>{t('crm.newLead')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('crm.noLeads')} icon={<UserRound className="size-6" />} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination
            page={data.meta.page}
            limit={data.meta.limit}
            total={data.meta.total}
            onPage={() => {}}
            onLimit={handleLimitChange}
          />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? t('crm.editLead') : t('crm.newLead')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-contact">
                  {t('fields.contactName')}
                  <span className="text-danger"> *</span>
                </label>
                <Input className="w-full" id="lead-contact" {...register('contactName')} />
                {errors.contactName ? (
                  <div className="text-[12px] font-normal text-danger">{errors.contactName.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-company">{t('crm.company')}</label>
                <Input className="w-full" id="lead-company" {...register('companyName')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-email">{t('fields.email')}</label>
                <Input className="w-full" id="lead-email" type="email" {...register('email')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-phone">{t('fields.phone')}</label>
                <Input className="w-full" id="lead-phone" {...register('phone')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-source">{t('crm.source')}</label>
                <Input className="w-full" id="lead-source" {...register('source')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-status">{t('common.status')}</label>
                <Select className="w-full" id="lead-status" {...register('status')}>
                  {leadStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-amount">{t('fields.estimatedAmount')}</label>
                <Input
                  className="w-full"
                  id="lead-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('estimatedAmount')}
                />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-currency">{t('fields.currency')}</label>
                <Input className="w-full" id="lead-currency" maxLength={3} {...register('currency')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="lead-notes">{t('fields.notes')}</label>
                <Textarea className="w-full" id="lead-notes" rows={3} {...register('notes')} />
              </div>
            </div>
            {formError ? (
              <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
                {formError}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('crm.createLead')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={converting !== null} onOpenChange={(isOpen) => !convertBusy && !isOpen && setConverting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader title={t('crm.convertLeadTitle', { number: converting?.number })} />
          <p className="text-muted">{t('crm.convertLeadMessage', { name: converting?.contactName })}</p>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="convert-code">{t('crm.customerCode')}</label>
            <Input
              className="w-full"
              id="convert-code"
              value={customerCode}
              onChange={(event) => setCustomerCode(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="default" type="button" disabled={convertBusy} onClick={() => void confirmConvert()}>
              {convertBusy ? t('crm.converting') : t('crm.convertToCustomer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}
        title={t('crm.deleteLeadTitle')}
        description={t('crm.deleteLeadMessage', { name: deleting?.contactName })}
        confirmLabel={t('common.delete')}
        busy={deletingBusy}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
