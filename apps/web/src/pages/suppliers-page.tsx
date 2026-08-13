import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Supplier } from '../api/types';
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
  TextArea,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

interface SupplierForm {
  code: string;
  tradeName: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  paymentTerms: string;
  creditLimit: string;
  active: boolean;
}

const emptyForm: SupplierForm = {
  code: '',
  tradeName: '',
  legalName: '',
  taxId: '',
  email: '',
  phone: '',
  address: '',
  currency: 'USD',
  paymentTerms: '',
  creditLimit: '',
  active: true,
};

export function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Supplier>({
    path: '/api/v1/purchasing/suppliers',
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

  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      code: supplier.code,
      tradeName: supplier.tradeName,
      legalName: supplier.legalName ?? '',
      taxId: supplier.taxId ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      currency: supplier.currency ?? 'USD',
      paymentTerms: supplier.paymentTerms ?? '',
      creditLimit: supplier.creditLimit != null ? String(supplier.creditLimit) : '',
      active: supplier.active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const setField = (key: keyof SupplierForm, value: string | boolean) => {
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
      paymentTerms: form.paymentTerms.trim() || undefined,
      creditLimit: form.creditLimit === '' ? undefined : Number(form.creditLimit),
      active: form.active,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/v1/purchasing/suppliers/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Supplier updated.');
      } else {
        await apiFetch('/api/v1/purchasing/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Supplier created.');
      }
      setModalOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/purchasing/suppliers/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Supplier deactivated.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not deactivate supplier.', 'error');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Supplier>[] = [
    { key: 'code', header: 'Code' },
    { key: 'tradeName', header: 'Trade name' },
    { key: 'taxId', header: 'Tax ID', render: (row) => row.taxId ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '—' },
    {
      key: 'creditLimit',
      header: 'Credit limit',
      render: (row) => (row.creditLimit != null ? formatMoney(row.creditLimit) : '—'),
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
        title="Suppliers"
        subtitle="Supplier accounts"
        action={<Button onClick={openCreate}>New supplier</Button>}
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
            <EmptyState message="No suppliers found." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit supplier' : 'New supplier'}
        onClose={closeModal}
        width="lg"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Code" htmlFor="supplier-code" required>
              <TextInput
                id="supplier-code"
                value={form.code}
                onChange={(event) => setField('code', event.target.value)}
              />
            </Field>
            <Field label="Trade name" htmlFor="supplier-trade" required>
              <TextInput
                id="supplier-trade"
                value={form.tradeName}
                onChange={(event) => setField('tradeName', event.target.value)}
              />
            </Field>
            <Field label="Legal name" htmlFor="supplier-legal">
              <TextInput
                id="supplier-legal"
                value={form.legalName}
                onChange={(event) => setField('legalName', event.target.value)}
              />
            </Field>
            <Field label="Tax ID" htmlFor="supplier-tax">
              <TextInput
                id="supplier-tax"
                value={form.taxId}
                onChange={(event) => setField('taxId', event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="supplier-email">
              <TextInput
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="supplier-phone">
              <TextInput
                id="supplier-phone"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </Field>
            <Field label="Currency" htmlFor="supplier-currency">
              <TextInput
                id="supplier-currency"
                maxLength={3}
                value={form.currency}
                onChange={(event) => setField('currency', event.target.value)}
              />
            </Field>
            <Field label="Payment terms" htmlFor="supplier-terms">
              <TextInput
                id="supplier-terms"
                placeholder="e.g. net 30"
                value={form.paymentTerms}
                onChange={(event) => setField('paymentTerms', event.target.value)}
              />
            </Field>
            <Field label="Credit limit" htmlFor="supplier-credit">
              <TextInput
                id="supplier-credit"
                type="number"
                min="0"
                step="0.01"
                value={form.creditLimit}
                onChange={(event) => setField('creditLimit', event.target.value)}
              />
            </Field>
            <Field label="Address" htmlFor="supplier-address">
              <TextArea
                id="supplier-address"
                rows={2}
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
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
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create supplier'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Deactivate supplier"
        message={`Deactivate "${deleting?.tradeName}"? It will be excluded from new purchase orders.`}
        confirmLabel="Deactivate"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
