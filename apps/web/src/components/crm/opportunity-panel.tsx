import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import type { Customer, Opportunity } from '../../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatDate,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../ui';
import { Button, ConfirmDialog, Field, Modal, Select, TextArea, TextInput } from '../forms';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { stageTone, stages } from './crm-helpers';

interface OpportunityForm {
  name: string;
  customerId: string;
  stage: string;
  amount: string;
  currency: string;
  probability: string;
  expectedCloseDate: string;
  notes: string;
}

const emptyOpportunity: OpportunityForm = {
  name: '',
  customerId: '',
  stage: 'prospecting',
  amount: '',
  currency: 'USD',
  probability: '',
  expectedCloseDate: '',
  notes: '',
};

export function OpportunityPanel({ customers }: { customers: Customer[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityForm>(emptyOpportunity);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Opportunity | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Opportunity>({
    path: '/api/v1/crm/opportunities',
    page: 1,
    limit: 50,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyOpportunity);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (opportunity: Opportunity) => {
    setEditingId(opportunity.id);
    setForm({
      name: opportunity.name,
      customerId: opportunity.customerId ?? '',
      stage: opportunity.stage,
      amount: opportunity.amount ? String(opportunity.amount) : '',
      currency: opportunity.currency,
      probability: opportunity.probability ? String(opportunity.probability) : '',
      expectedCloseDate: opportunity.expectedCloseDate ?? '',
      notes: opportunity.notes ?? '',
    });
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    if (!saving) setOpen(false);
  };

  const setField = (key: keyof OpportunityForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      customerId: form.customerId || undefined,
      stage: form.stage,
      amount: form.amount === '' ? undefined : Number(form.amount),
      currency: form.currency.trim().toUpperCase() || undefined,
      probability: form.probability === '' ? undefined : Number(form.probability),
      expectedCloseDate: form.expectedCloseDate || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/v1/crm/opportunities/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Opportunity updated.');
      } else {
        await apiFetch('/api/v1/crm/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Opportunity created.');
      }
      setOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save opportunity.');
    } finally {
      setSaving(false);
    }
  };

  const runStageAction = async (id: string, action: 'mark-won' | 'mark-lost', message: string) => {
    try {
      await apiFetch(`/api/v1/crm/opportunities/${id}/${action}`, { method: 'POST' });
      toast.toast(message);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/crm/opportunities/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Opportunity deleted.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete.', 'error');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Opportunity>[] = [
    { key: 'name', header: 'Name' },
    { key: 'customer', header: 'Customer', render: (row) => row.customer?.tradeName ?? '—' },
    { key: 'stage', header: 'Stage', render: (row) => <Badge tone={stageTone(row.stage)}>{row.stage}</Badge> },
    { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
    { key: 'probability', header: 'Probability', render: (row) => `${row.probability}%` },
    { key: 'expectedCloseDate', header: 'Expected close', render: (row) => formatDate(row.expectedCloseDate) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.stage !== 'won' && row.stage !== 'lost' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void runStageAction(row.id, 'mark-won', 'Opportunity marked as won.')}
              >
                Won
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void runStageAction(row.id, 'mark-lost', 'Opportunity marked as lost.')}
              >
                Lost
              </Button>
            </>
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
        title="Opportunities"
        subtitle="Manage sales opportunities and stages"
        action={<Button onClick={openCreate}>New opportunity</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No opportunities." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} />
        </>
      ) : null}

      <Modal open={open} title={editingId ? 'Edit opportunity' : 'New opportunity'} onClose={close} width="lg">
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Name" htmlFor="opp-name" required>
              <TextInput
                id="opp-name"
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
              />
            </Field>
            <Field label="Customer" htmlFor="opp-customer">
              <Select
                id="opp-customer"
                value={form.customerId}
                onChange={(event) => setField('customerId', event.target.value)}
              >
                <option value="">— None —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stage" htmlFor="opp-stage">
              <Select
                id="opp-stage"
                value={form.stage}
                onChange={(event) => setField('stage', event.target.value)}
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" htmlFor="opp-amount">
              <TextInput
                id="opp-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setField('amount', event.target.value)}
              />
            </Field>
            <Field label="Currency" htmlFor="opp-currency">
              <TextInput
                id="opp-currency"
                maxLength={3}
                value={form.currency}
                onChange={(event) => setField('currency', event.target.value)}
              />
            </Field>
            <Field label="Probability (%)" htmlFor="opp-probability">
              <TextInput
                id="opp-probability"
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.probability}
                onChange={(event) => setField('probability', event.target.value)}
              />
            </Field>
            <Field label="Expected close date" htmlFor="opp-close">
              <TextInput
                id="opp-close"
                type="date"
                value={form.expectedCloseDate}
                onChange={(event) => setField('expectedCloseDate', event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="opp-notes">
              <TextArea
                id="opp-notes"
                rows={3}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </Field>
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create opportunity'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete opportunity"
        message={`Delete opportunity "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
