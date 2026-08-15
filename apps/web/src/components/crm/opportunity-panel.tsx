import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { Customer, Opportunity } from '../../api/types';
import { opportunityFormSchema, type OpportunityFormValues } from '../../api/schemas';
import { useApiMutation, useApiMutationVoid } from '../../api/hooks';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatDate,
  formatMoney,
  PageHeader,
  Pagination,
  TableSkeleton,
} from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { exportRowsToCsv } from '../../lib/csv';
import { stageTone, stages } from './crm-helpers';

type CreateOpportunityDto = components['schemas']['CreateOpportunityDto'];
type UpdateOpportunityDto = components['schemas']['UpdateOpportunityDto'];

const emptyOpportunity: OpportunityFormValues = {
  name: '',
  customerId: '',
  stage: 'prospecting',
  amount: '',
  currency: 'USD',
  probability: '',
  expectedCloseDate: '',
  notes: '',
};

function toOpportunityForm(opportunity: Opportunity): OpportunityFormValues {
  return {
    name: opportunity.name,
    customerId: opportunity.customerId ?? '',
    stage: opportunity.stage,
    amount: opportunity.amount ? String(opportunity.amount) : '',
    currency: opportunity.currency,
    probability: opportunity.probability ? String(opportunity.probability) : '',
    expectedCloseDate: opportunity.expectedCloseDate ?? '',
    notes: opportunity.notes ?? '',
  };
}

function opportunityToDto(form: OpportunityFormValues): CreateOpportunityDto {
  return {
    name: form.name.trim(),
    customerId: form.customerId || undefined,
    stage: form.stage,
    amount: form.amount === '' ? undefined : Number(form.amount),
    currency: form.currency.trim().toUpperCase() || undefined,
    probability: form.probability === '' ? undefined : Number(form.probability),
    expectedCloseDate: form.expectedCloseDate || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function OpportunityPanel({ customers }: { customers: Customer[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Opportunity | null>(null);
  const [stageAction, setStageAction] = useState<{
    id: string;
    action: 'mark-won' | 'mark-lost';
  } | null>(null);
  const [limit, setLimit] = useState(50);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Opportunity>({
    path: '/api/v1/crm/opportunities',
    page: 1,
    limit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: emptyOpportunity,
  });

  const createMutation = useApiMutation<CreateOpportunityDto>('/api/v1/crm/opportunities', 'POST');
  const updateMutation = useApiMutation<UpdateOpportunityDto>(
    `/api/v1/crm/opportunities/${editingId ?? ''}`,
    'PATCH',
  );
  const deleteMutation = useApiMutationVoid(`/api/v1/crm/opportunities/${deleting?.id ?? ''}`, 'DELETE');
  const stageActionMutation = useApiMutationVoid(
    stageAction ? `/api/v1/crm/opportunities/${stageAction.id}/${stageAction.action}` : '/api/v1/crm/opportunities',
    'POST',
  );

  const saving = createMutation.isPending || updateMutation.isPending;
  const deletingBusy = deleteMutation.isPending;

  useEffect(() => {
    if (!stageAction) return;
    stageActionMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(stageAction.action === 'mark-won' ? t('crm.opportunityWon') : t('crm.opportunityLost'));
        void reload();
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
      },
    });
    setStageAction(null);
  }, [stageAction]);

  const openCreate = () => {
    setEditingId(null);
    reset(emptyOpportunity);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (opportunity: Opportunity) => {
    setEditingId(opportunity.id);
    reset(toOpportunityForm(opportunity));
    setFormError(null);
    setOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? t('crm.opportunityUpdated') : t('crm.opportunityCreated'));
      setOpen(false);
      void reload();
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(opportunityToDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(opportunityToDto(values), { onSuccess, onError });
    }
  });

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t('crm.opportunityDeleted'));
        setDeleting(null);
        void reload();
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeleting(null);
      },
    });
  };

  const columns: Column<Opportunity>[] = [
    { key: 'name', header: t('fields.name') },
    { key: 'customer', header: t('fields.customer'), render: (row) => row.customer?.tradeName ?? '—' },
    { key: 'stage', header: t('crm.stage'), render: (row) => <Badge tone={stageTone(row.stage)}>{row.stage}</Badge> },
    { key: 'amount', header: t('fields.amount'), render: (row) => formatMoney(row.amount) },
    { key: 'probability', header: t('fields.probability'), render: (row) => `${row.probability}%` },
    {
      key: 'expectedCloseDate',
      header: t('crm.expectedClose'),
      render: (row) => formatDate(row.expectedCloseDate),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          {row.stage !== 'won' && row.stage !== 'lost' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStageAction({ id: row.id, action: 'mark-won' })}
              >
                {t('crm.won')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStageAction({ id: row.id, action: 'mark-lost' })}
              >
                {t('crm.lost')}
              </Button>
            </>
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
    exportRowsToCsv({ filename: 'opportunities', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('crm.opportunitiesTitle')}
        subtitle={t('crm.opportunitiesSubtitle')}
        action={
          <div className="flex justify-end gap-2">
            <button type="button" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </button>
            <Button onClick={openCreate}>{t('crm.newOpportunity')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('crm.noOpportunities')} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? t('crm.editOpportunity') : t('crm.newOpportunity')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-name">
                  {t('fields.name')}<span className="text-danger"> *</span>
                </label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-name" {...register('name')} />
                {errors.name ? <div className="text-[12px] font-normal text-danger">{errors.name.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-customer">{t('fields.customer')}</label>
                <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-customer" {...register('customerId')}>
                  <option value="">{t('crm.none')}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.tradeName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-stage">{t('crm.stage')}</label>
                <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-stage" {...register('stage')}>
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-amount">{t('fields.amount')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-amount" type="number" min="0" step="0.01" {...register('amount')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-currency">{t('fields.currency')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-currency" maxLength={3} {...register('currency')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-probability">{t('crm.probabilityPercent')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-probability" type="number" min="0" max="100" step="1" {...register('probability')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-close">{t('crm.expectedCloseDate')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-close" type="date" {...register('expectedCloseDate')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="opp-notes">{t('fields.notes')}</label>
                <textarea className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="opp-notes" rows={3} {...register('notes')} />
              </div>
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('crm.createOpportunity')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}>
        <DialogContent>
          <DialogHeader
            title={t('crm.deleteOpportunityTitle')}
            description={t('crm.deleteOpportunityMessage', { name: deleting?.name })}
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
