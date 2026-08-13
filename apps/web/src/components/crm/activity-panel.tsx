import { useEffect, useState } from 'react';
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
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
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
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CrmActivity | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CrmActivity | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<CrmActivity>({
    path: '/api/v1/crm/activities',
    page: 1,
    limit: 50,
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
          toast.toast('Activity completed.');
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
      toast.toast(editingId ? 'Activity updated.' : 'Activity created.');
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
        toast.toast('Activity deleted.');
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
      header: 'Type',
      render: (row) => <Badge tone={row.activityType === 'note' ? 'neutral' : 'info'}>{row.activityType}</Badge>,
    },
    { key: 'subject', header: 'Subject' },
    { key: 'description', header: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'dueAt',
      header: 'Due',
      render: (row) =>
        row.dueAt ? new Date(row.dueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—',
    },
    {
      key: 'completedAt',
      header: 'Completed',
      render: (row) =>
        row.completedAt
          ? new Date(row.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
          : '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {!row.completedAt ? (
            <Button variant="ghost" size="sm" onClick={() => setCompleteTarget(row)}>
              Complete
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Calls, meetings, tasks and notes"
        action={<Button onClick={openCreate}>New activity</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No activities." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? 'Edit activity' : 'New activity'} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="activity-type">
                  Type<span className="field-required"> *</span>
                </label>
                <select id="activity-type" {...register('activityType')}>
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="activity-subject">
                  Subject<span className="field-required"> *</span>
                </label>
                <input id="activity-subject" {...register('subject')} />
                {errors.subject ? <div className="field-error">{errors.subject.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="activity-due">Due at</label>
                <input id="activity-due" type="datetime-local" {...register('dueAt')} />
              </div>
              <div className="field">
                <label htmlFor="activity-completed">Completed at</label>
                <input id="activity-completed" type="datetime-local" {...register('completedAt')} />
              </div>
              <div className="field">
                <label htmlFor="activity-ref-type">Reference type</label>
                <input id="activity-ref-type" placeholder="e.g. lead, opportunity" {...register('referenceType')} />
              </div>
              <div className="field">
                <label htmlFor="activity-ref-id">Reference id</label>
                <input id="activity-ref-id" {...register('referenceId')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="activity-description">Description</label>
              <textarea id="activity-description" rows={3} {...register('description')} />
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create activity'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}>
        <DialogContent>
          <DialogHeader title="Delete activity" description={`Delete activity "${deleting?.subject}"?`} />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deletingBusy} onClick={() => void confirmDelete()}>
              {deletingBusy ? 'Working…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
