import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import type { CrmActivity } from '../../api/types';
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
import { Button, ConfirmDialog, Field, Modal, Select, TextArea, TextInput } from '../forms';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { activityTypes, toLocalInput } from './crm-helpers';

interface ActivityForm {
  activityType: string;
  subject: string;
  description: string;
  dueAt: string;
  completedAt: string;
  referenceType: string;
  referenceId: string;
}

const emptyActivity: ActivityForm = {
  activityType: 'task',
  subject: '',
  description: '',
  dueAt: '',
  completedAt: '',
  referenceType: '',
  referenceId: '',
};

export function ActivityPanel() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyActivity);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CrmActivity | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<CrmActivity>({
    path: '/api/v1/crm/activities',
    page: 1,
    limit: 50,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyActivity);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (activity: CrmActivity) => {
    setEditingId(activity.id);
    setForm({
      activityType: activity.activityType,
      subject: activity.subject,
      description: activity.description ?? '',
      dueAt: toLocalInput(activity.dueAt),
      completedAt: toLocalInput(activity.completedAt),
      referenceType: activity.referenceType ?? '',
      referenceId: activity.referenceId ?? '',
    });
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    if (!saving) setOpen(false);
  };

  const setField = (key: keyof ActivityForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.subject.trim()) {
      setFormError('Subject is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      activityType: form.activityType,
      subject: form.subject.trim(),
      description: form.description.trim() || undefined,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      completedAt: form.completedAt ? new Date(form.completedAt).toISOString() : undefined,
      referenceType: form.referenceType.trim() || undefined,
      referenceId: form.referenceId.trim() || undefined,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/v1/crm/activities/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Activity updated.');
      } else {
        await apiFetch('/api/v1/crm/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Activity created.');
      }
      setOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save activity.');
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (activity: CrmActivity) => {
    try {
      await apiFetch(`/api/v1/crm/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      toast.toast('Activity completed.');
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not complete activity.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await apiFetch(`/api/v1/crm/activities/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Activity deleted.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete activity.', 'error');
      setDeleting(null);
    }
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
            <Button variant="ghost" size="sm" onClick={() => void markComplete(row)}>
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

      <Modal open={open} title={editingId ? 'Edit activity' : 'New activity'} onClose={close} width="lg">
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Type" htmlFor="activity-type" required>
              <Select
                id="activity-type"
                value={form.activityType}
                onChange={(event) => setField('activityType', event.target.value)}
              >
                {activityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" htmlFor="activity-subject" required>
              <TextInput
                id="activity-subject"
                value={form.subject}
                onChange={(event) => setField('subject', event.target.value)}
              />
            </Field>
            <Field label="Due at" htmlFor="activity-due">
              <TextInput
                id="activity-due"
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => setField('dueAt', event.target.value)}
              />
            </Field>
            <Field label="Completed at" htmlFor="activity-completed">
              <TextInput
                id="activity-completed"
                type="datetime-local"
                value={form.completedAt}
                onChange={(event) => setField('completedAt', event.target.value)}
              />
            </Field>
            <Field label="Reference type" htmlFor="activity-ref-type">
              <TextInput
                id="activity-ref-type"
                placeholder="e.g. lead, opportunity"
                value={form.referenceType}
                onChange={(event) => setField('referenceType', event.target.value)}
              />
            </Field>
            <Field label="Reference id" htmlFor="activity-ref-id">
              <TextInput
                id="activity-ref-id"
                value={form.referenceId}
                onChange={(event) => setField('referenceId', event.target.value)}
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="activity-description">
            <TextArea
              id="activity-description"
              rows={3}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </Field>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create activity'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete activity"
        message={`Delete activity "${deleting?.subject}"?`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
