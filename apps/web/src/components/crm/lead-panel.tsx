import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import type { Lead } from '../../api/types';
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
import { Button, ConfirmDialog, Field, Modal, Select, TextArea, TextInput } from '../forms';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { leadStatusTone, leadStatuses } from './crm-helpers';

interface LeadForm {
  source: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  estimatedAmount: string;
  currency: string;
  notes: string;
}

const emptyLead: LeadForm = {
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

export function LeadPanel() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyLead);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [convertBusy, setConvertBusy] = useState(false);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Lead>({ path: '/api/v1/crm/leads', page: 1, limit: 50 });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyLead);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    setForm({
      source: lead.source ?? '',
      companyName: lead.companyName ?? '',
      contactName: lead.contactName,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      status: lead.status,
      estimatedAmount: lead.estimatedAmount ? String(lead.estimatedAmount) : '',
      currency: lead.currency,
      notes: lead.notes ?? '',
    });
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    if (!saving) setOpen(false);
  };

  const setField = (key: keyof LeadForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.contactName.trim()) {
      setFormError('Contact name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
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
    try {
      if (editingId) {
        await apiFetch(`/api/v1/crm/leads/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Lead updated.');
      } else {
        await apiFetch('/api/v1/crm/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Lead created.');
      }
      setOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save lead.');
    } finally {
      setSaving(false);
    }
  };

  const confirmConvert = async () => {
    if (!converting) return;
    setConvertBusy(true);
    try {
      await apiFetch(`/api/v1/crm/leads/${converting.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerCode: customerCode.trim() || undefined }),
      });
      toast.toast('Lead converted to customer.');
      setConverting(null);
      setCustomerCode('');
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not convert lead.', 'error');
      setConverting(null);
    } finally {
      setConvertBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/crm/leads/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Lead deleted.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete.', 'error');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Lead>[] = [
    { key: 'number', header: 'Number' },
    { key: 'contactName', header: 'Contact' },
    { key: 'companyName', header: 'Company', render: (row) => row.companyName ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'estimatedAmount', header: 'Est. amount', render: (row) => formatMoney(row.estimatedAmount) },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={leadStatusTone(row.status)}>{row.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status !== 'converted' ? (
            <Button variant="ghost" size="sm" onClick={() => setConverting(row)}>
              Convert
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
        title="Leads"
        subtitle="Track and qualify sales leads"
        action={<Button onClick={openCreate}>New lead</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No leads." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} />
        </>
      ) : null}

      <Modal open={open} title={editingId ? 'Edit lead' : 'New lead'} onClose={close} width="lg">
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Contact name" htmlFor="lead-contact" required>
              <TextInput
                id="lead-contact"
                value={form.contactName}
                onChange={(event) => setField('contactName', event.target.value)}
              />
            </Field>
            <Field label="Company" htmlFor="lead-company">
              <TextInput
                id="lead-company"
                value={form.companyName}
                onChange={(event) => setField('companyName', event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="lead-email">
              <TextInput
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="lead-phone">
              <TextInput
                id="lead-phone"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </Field>
            <Field label="Source" htmlFor="lead-source">
              <TextInput
                id="lead-source"
                value={form.source}
                onChange={(event) => setField('source', event.target.value)}
              />
            </Field>
            <Field label="Status" htmlFor="lead-status">
              <Select
                id="lead-status"
                value={form.status}
                onChange={(event) => setField('status', event.target.value)}
              >
                {leadStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estimated amount" htmlFor="lead-amount">
              <TextInput
                id="lead-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.estimatedAmount}
                onChange={(event) => setField('estimatedAmount', event.target.value)}
              />
            </Field>
            <Field label="Currency" htmlFor="lead-currency">
              <TextInput
                id="lead-currency"
                maxLength={3}
                value={form.currency}
                onChange={(event) => setField('currency', event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="lead-notes">
              <TextArea
                id="lead-notes"
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
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create lead'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={converting !== null}
        title={`Convert lead ${converting?.number ?? ''}`}
        onClose={() => setConverting(null)}
        width="sm"
      >
        <p className="modal-message">
          Create a customer account for “{converting?.contactName}”. A customer code is generated
          automatically unless you provide one.
        </p>
        <Field label="Customer code" htmlFor="convert-code">
          <TextInput
            id="convert-code"
            value={customerCode}
            onChange={(event) => setCustomerCode(event.target.value)}
          />
        </Field>
        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setConverting(null)} disabled={convertBusy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void confirmConvert()} disabled={convertBusy}>
            {convertBusy ? 'Converting…' : 'Convert to customer'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete lead"
        message={`Delete lead for "${deleting?.contactName}"? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
