import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { CrmActivity } from '../../api/types';
import { activityFormSchema, type ActivityFormValues } from '../../api/schemas';
import { useApiMutation, useApiMutationVoid } from '../../api/hooks';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pagination,
  TableSkeleton,
} from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { exportRowsToCsv } from '../../lib/csv';
import { activityTypes, toLocalInput } from './crm-helpers';

type CreateActivityDto = components['schemas']['CreateActivityDto'];
type UpdateActivityDto = components['schemas']['UpdateActivityDto'];

const emptyActivity: ActivityFormValues = {
  activityType: 'task',
  subject: '',
  description: '',
  dueAt: '',
  completedAt: '',
  referenceType: '',
  referenceId: '',
};

function toActivityForm(activity: CrmActivity): ActivityFormValues {
  return {
    activityType: activity.activityType,
    subject: activity.subject,
    description: activity.description ?? '',
    dueAt: toLocalInput(activity.dueAt),
    completedAt: toLocalInput(activity.completedAt),
    referenceType: activity.referenceType ?? '',
    referenceId: activity.referenceId ?? '',
  };
}

function activityToDto(form: ActivityFormValues): CreateActivityDto {
  return {
    activityType: form.activityType,
    subject: form.subject.trim(),
    description: form.description.trim() || undefined,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
    completedAt: form.completedAt ? new Date(form.completedAt).toISOString() : undefined,
    referenceType: form.referenceType.trim() || undefined,
    referenceId: form.referenceId.trim() || undefined,
  };
}

export function ActivityPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CrmActivity | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CrmActivity | null>(null);
  const [limit, setLimit] = useState(50);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<CrmActivity>({
    path: '/api/v1/crm/activities',
    page: 1,
    limit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: emptyActivity,
  });

  const createMutation = useApiMutation<CreateActivityDto>('/api/v1/crm/activities', 'POST');
  const updateMutation = useApiMutation<UpdateActivityDto>(
    `/api/v1/crm/activities/${editingId ?? ''}`,
    'PATCH',
  );
  const deleteMutation = useApiMutationVoid(`/api/v1/crm/activities/${deleting?.id ?? ''}`, 'DELETE');
  const completeMutation = useApiMutation<{ completedAt: string }>(
    `/api/v1/crm/activities/${completeTarget?.id ?? ''}`,
    'PATCH',
  );

  const saving = createMutation.isPending || updateMutation.isPending;
  const deletingBusy = deleteMutation.isPending;

  useEffect(() => {
    if (!completeTarget) return;
    completeMutation.mutate(
      { completedAt: new Date().toISOString() },
      {
        onSuccess: () => {
          toast.toast(t('crm.activityCompleted'));
          void reload();
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
        },
      },
    );
    setCompleteTarget(null);
  }, [completeTarget]);

  const openCreate = () => {
    setEditingId(null);
    reset(emptyActivity);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (activity: CrmActivity) => {
    setEditingId(activity.id);
    reset(toActivityForm(activity));
    setFormError(null);
    setOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? t('crm.activityUpdated') : t('crm.activityCreated'));
      setOpen(false);
      void reload();
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(activityToDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(activityToDto(values), { onSuccess, onError });
    }
  });

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t('crm.activityDeleted'));
        setDeleting(null);
        void reload();
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeleting(null);
      },
    });
  };

  const columns: Column<CrmActivity>[] = [
    {
      key: 'activityType',
      header: t('crm.type'),
      render: (row) => <Badge tone={row.activityType === 'note' ? 'neutral' : 'info'}>{row.activityType}</Badge>,
    },
    { key: 'subject', header: t('fields.subject') },
    { key: 'description', header: t('fields.description'), render: (row) => row.description ?? '—' },
    {
      key: 'dueAt',
      header: t('crm.due'),
      render: (row) =>
        row.dueAt ? new Date(row.dueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—',
    },
    {
      key: 'completedAt',
      header: t('crm.completed'),
      render: (row) =>
        row.completedAt
          ? new Date(row.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
          : '—',
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          {!row.completedAt ? (
            <Button variant="ghost" size="sm" onClick={() => setCompleteTarget(row)}>
              {t('crm.complete')}
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
    exportRowsToCsv({ filename: 'activities', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('crm.activitiesTitle')}
        subtitle={t('crm.activitiesSubtitle')}
        action={
          <div className="flex justify-end gap-2">
            <button type="button" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </button>
            <Button onClick={openCreate}>{t('crm.newActivity')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('crm.noActivities')} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? t('crm.editActivity') : t('crm.newActivity')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="activity-type">
                  {t('crm.type')}<span className="text-danger"> *</span>
                </label>
                <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="activity-type" {...register('activityType')}>
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="activity-subject">
                  {t('fields.subject')}<span className="text-danger"> *</span>
                </label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="activity-subject" {...register('subject')} />
                {errors.subject ? <div className="text-[12px] font-normal text-danger">{errors.subject.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="activity-due">{t('crm.dueAt')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="activity-due" type="datetime-local" {...register('dueAt')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="activity-completed">{t('crm.completedAt')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="activity-completed" type="datetime-local" {...register('completedAt')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="activity-ref-type">{t('crm.referenceType')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                  id="activity-ref-type"
                  placeholder={t('crm.referenceTypePlaceholder')}
                  {...register('referenceType')}
                />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="activity-ref-id">{t('crm.referenceId')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="activity-ref-id" {...register('referenceId')} />
              </div>
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="activity-description">{t('fields.description')}</label>
              <textarea className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="activity-description" rows={3} {...register('description')} />
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('crm.createActivity')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}>
        <DialogContent>
          <DialogHeader
            title={t('crm.deleteActivityTitle')}
            description={t('crm.deleteActivityMessage', { subject: deleting?.subject })}
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
