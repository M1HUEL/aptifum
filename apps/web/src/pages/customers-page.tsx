import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Customer } from '../api/types';
import * as core from '@aptifum/core';
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
} from '../components/ui';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

interface CustomerForm {
  code: string;
  tradeName: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  creditLimit: string;
  priceCategory: string;
  state: string;
  taxExempt: boolean;
  active: boolean;
}

const emptyForm: CustomerForm = {
  code: '',
  tradeName: '',
  legalName: '',
  taxId: '',
  email: '',
  phone: '',
  address: '',
  currency: 'USD',
  creditLimit: '',
  priceCategory: '',
  state: '',
  taxExempt: false,
  active: true,
};

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Customer>({
    path: '/api/v1/sales/customers',
    page,
    query,
  });

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setForm({
      code: customer.code,
      tradeName: customer.tradeName,
      legalName: customer.legalName ?? '',
      taxId: customer.taxId ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      currency: customer.currency ?? 'USD',
      creditLimit: customer.creditLimit ? String(customer.creditLimit) : '',
      priceCategory: customer.priceCategory ?? '',
      state: customer.state ?? '',
      taxExempt: customer.taxExempt,
      active: customer.active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const setField = (key: keyof CustomerForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.tradeName.trim()) {
      setFormError('Code and trade name are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      code: form.code.trim(),
      tradeName: form.tradeName.trim(),
      legalName: form.legalName.trim() || undefined,
      taxId: form.taxId.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      currency: form.currency.trim().toUpperCase() || undefined,
      creditLimit: form.creditLimit === '' ? undefined : Number(form.creditLimit),
      priceCategory: form.priceCategory.trim() || undefined,
      state: form.state.trim() || undefined,
      taxExempt: form.taxExempt,
      active: form.active,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/v1/sales/customers/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Customer updated.');
      } else {
        await apiFetch('/api/v1/sales/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Customer created.');
      }
      setModalOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save customer.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/sales/customers/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Customer deactivated.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not deactivate customer.', 'error');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Customer>[] = [
    { key: 'code', header: 'Code' },
    { key: 'tradeName', header: 'Trade name' },
    { key: 'taxId', header: 'Tax ID', render: (row) => row.taxId ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    {
      key: 'creditLimit',
      header: 'Credit limit',
      render: (row) => formatMoney(row.creditLimit),
    },
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
          {row.active ? (
            <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
              Deactivate
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Customer accounts"
        action={<Button onClick={openCreate}>New customer</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by trade name…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No customers found." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit customer' : 'New customer'}
        onClose={closeModal}
        width="lg"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Code" htmlFor="customer-code" required>
              <TextInput
                id="customer-code"
                value={form.code}
                onChange={(event) => setField('code', event.target.value)}
              />
            </Field>
            <Field label="Trade name" htmlFor="customer-trade" required>
              <TextInput
                id="customer-trade"
                value={form.tradeName}
                onChange={(event) => setField('tradeName', event.target.value)}
              />
            </Field>
            <Field label="Legal name" htmlFor="customer-legal">
              <TextInput
                id="customer-legal"
                value={form.legalName}
                onChange={(event) => setField('legalName', event.target.value)}
              />
            </Field>
            <Field label="Tax ID" htmlFor="customer-tax">
              <TextInput
                id="customer-tax"
                value={form.taxId}
                onChange={(event) => setField('taxId', event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="customer-email">
              <TextInput
                id="customer-email"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="customer-phone">
              <TextInput
                id="customer-phone"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </Field>
            <Field label="Currency" htmlFor="customer-currency">
              <TextInput
                id="customer-currency"
                maxLength={3}
                value={form.currency}
                onChange={(event) => setField('currency', event.target.value)}
              />
            </Field>
            <Field label="Credit limit" htmlFor="customer-credit">
              <TextInput
                id="customer-credit"
                type="number"
                min="0"
                step="0.01"
                value={form.creditLimit}
                onChange={(event) => setField('creditLimit', event.target.value)}
              />
            </Field>
            <Field label="Price category" htmlFor="customer-price">
              <TextInput
                id="customer-price"
                placeholder="e.g. retail, wholesale"
                value={form.priceCategory}
                onChange={(event) => setField('priceCategory', event.target.value)}
              />
            </Field>
            <Field label="Address" htmlFor="customer-address">
              <TextArea
                id="customer-address"
                rows={2}
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
              />
            </Field>
            <Field label="State (US)" htmlFor="customer-state" hint="Used to apply US sales tax automatically.">
              <Select
                id="customer-state"
                value={form.state}
                onChange={(event) => setField('state', event.target.value)}
              >
                <option value="">No state</option>
                {Object.entries(core.US_STATES).map(([code, info]) => (
                  <option key={code} value={code}>
                    {code} — {info.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tax status">
              <Checkbox
                label="Tax exempt"
                checked={form.taxExempt}
                onChange={(event) => setField('taxExempt', event.target.checked)}
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
            <Button variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create customer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Deactivate customer"
        message={`Deactivate "${deleting?.tradeName}"? It will be excluded from new invoices.`}
        confirmLabel="Deactivate"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
