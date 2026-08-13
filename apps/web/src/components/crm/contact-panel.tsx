import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import type { CrmContact, Customer } from '../../api/types';
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
import { Button, Checkbox, ConfirmDialog, Field, Modal, Select, TextArea, TextInput } from '../forms';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';

interface ContactForm {
  fullName: string;
  customerId: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  notes: string;
  active: boolean;
}

const emptyContact: ContactForm = {
  fullName: '',
  customerId: '',
  title: '',
  email: '',
  phone: '',
  mobile: '',
  address: '',
  notes: '',
  active: true,
};

export function ContactPanel({ customers }: { customers: Customer[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyContact);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CrmContact | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<CrmContact>({
    path: '/api/v1/crm/contacts',
    page: 1,
    limit: 50,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyContact);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (contact: CrmContact) => {
    setEditingId(contact.id);
    setForm({
      fullName: contact.fullName,
      customerId: contact.customerId ?? '',
      title: contact.title ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      mobile: contact.mobile ?? '',
      address: contact.address ?? '',
      notes: contact.notes ?? '',
      active: contact.active,
    });
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    if (!saving) setOpen(false);
  };

  const setField = (key: keyof ContactForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      fullName: form.fullName.trim(),
      customerId: form.customerId || undefined,
      title: form.title.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      mobile: form.mobile.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      active: form.active,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/v1/crm/contacts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Contact updated.');
      } else {
        await apiFetch('/api/v1/crm/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Contact created.');
      }
      setOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save contact.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await apiFetch(`/api/v1/crm/contacts/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Contact deleted.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete contact.', 'error');
      setDeleting(null);
    }
  };

  const columns: Column<CrmContact>[] = [
    { key: 'fullName', header: 'Full name' },
    { key: 'customer', header: 'Customer', render: (row) => row.customer?.tradeName ?? '—' },
    { key: 'title', header: 'Title', render: (row) => row.title ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '—' },
    {
      key: 'active',
      header: 'Status',
      render: (row) => <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
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
        title="Contacts"
        subtitle="Contacts linked to customer accounts"
        action={<Button onClick={openCreate}>New contact</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No contacts." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} />
        </>
      ) : null}

      <Modal open={open} title={editingId ? 'Edit contact' : 'New contact'} onClose={close} width="lg">
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Full name" htmlFor="contact-name" required>
              <TextInput
                id="contact-name"
                value={form.fullName}
                onChange={(event) => setField('fullName', event.target.value)}
              />
            </Field>
            <Field label="Customer" htmlFor="contact-customer">
              <Select
                id="contact-customer"
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
            <Field label="Title" htmlFor="contact-title">
              <TextInput
                id="contact-title"
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="contact-email">
              <TextInput
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="contact-phone">
              <TextInput
                id="contact-phone"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </Field>
            <Field label="Mobile" htmlFor="contact-mobile">
              <TextInput
                id="contact-mobile"
                value={form.mobile}
                onChange={(event) => setField('mobile', event.target.value)}
              />
            </Field>
            <Field label="Address" htmlFor="contact-address">
              <TextArea
                id="contact-address"
                rows={2}
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="contact-notes">
              <TextArea
                id="contact-notes"
                rows={2}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </Field>
            <Field label="Status">
              <Checkbox
                label="Active"
                checked={form.active}
                onChange={(event) => setField('active', event.target.checked)}
              />
            </Field>
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create contact'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete contact"
        message={`Delete contact "${deleting?.fullName}"?`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
