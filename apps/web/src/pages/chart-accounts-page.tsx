import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type {
  AccountNormalBalance,
  AccountType,
  ChartAccount,
  Paginated,
} from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
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

const accountTypes: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const normalBalances: AccountNormalBalance[] = ['debit', 'credit'];

function typeTone(type: AccountType) {
  if (type === 'asset' || type === 'expense') return 'info';
  if (type === 'liability' || type === 'equity' || type === 'revenue') return 'warning';
  return 'neutral';
}

interface AccountForm {
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  parentId: string;
  active: boolean;
  description: string;
}

const emptyForm: AccountForm = {
  code: '',
  name: '',
  type: 'asset',
  normalBalance: 'debit',
  parentId: '',
  active: true,
  description: '',
};

export function ChartAccountsPage() {
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ChartAccount | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const reload = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: '50' });
      const result = await apiFetch<Paginated<ChartAccount>>(`/api/v1/accounting/accounts?${params.toString()}`);
      setAccounts(result.data);
      setTotal(result.meta.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (account: ChartAccount) => {
    setEditingId(account.id);
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      parentId: account.parentId ?? '',
      active: account.active,
      description: account.description ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const setField = (key: keyof AccountForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Code and name are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type,
      normalBalance: form.normalBalance,
      parentId: form.parentId || undefined,
      active: form.active,
      description: form.description.trim() || undefined,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/v1/accounting/accounts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            type: form.type,
            normalBalance: form.normalBalance,
            parentId: form.parentId || undefined,
            active: form.active,
            description: form.description.trim() || undefined,
          }),
        });
        toast.toast('Account updated.');
      } else {
        await apiFetch('/api/v1/accounting/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.toast('Account created.');
      }
      setModalOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save account.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/accounting/accounts/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Account deleted.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete account.', 'error');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<ChartAccount>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge tone={typeTone(row.type)}>{row.type}</Badge>,
    },
    { key: 'normalBalance', header: 'Normal balance', render: (row) => row.normalBalance },
    {
      key: 'parent',
      header: 'Parent',
      render: (row) => (row.parent ? `${row.parent.code} · ${row.parent.name}` : '—'),
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
        title="Chart of accounts"
        subtitle="Accounting chart"
        action={<Button onClick={openCreate}>New account</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {loading && accounts.length === 0 ? <LoadingBlock /> : null}
      {!loading && accounts.length === 0 && !error ? <EmptyState message="No accounts." /> : null}
      {accounts.length > 0 ? (
        <>
          <DataTable columns={columns} rows={accounts} rowKey={(row) => row.id} />
          <Pagination page={page} limit={50} total={total} onPage={(next) => {
            setPage(next);
            void reload(next);
          }} />
        </>
      ) : null}

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit account' : 'New account'}
        onClose={() => !saving && setModalOpen(false)}
        width="lg"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Code" htmlFor="acc-code" required>
              <TextInput
                id="acc-code"
                disabled={editingId !== null}
                value={form.code}
                onChange={(event) => setField('code', event.target.value)}
              />
            </Field>
            <Field label="Name" htmlFor="acc-name" required>
              <TextInput
                id="acc-name"
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
              />
            </Field>
            <Field label="Type" htmlFor="acc-type" required>
              <Select
                id="acc-type"
                value={form.type}
                onChange={(event) => setField('type', event.target.value)}
              >
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Normal balance" htmlFor="acc-balance" required>
              <Select
                id="acc-balance"
                value={form.normalBalance}
                onChange={(event) => setField('normalBalance', event.target.value)}
              >
                {normalBalances.map((balance) => (
                  <option key={balance} value={balance}>
                    {balance}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Parent" htmlFor="acc-parent">
              <Select
                id="acc-parent"
                value={form.parentId}
                onChange={(event) => setField('parentId', event.target.value)}
              >
                <option value="">— None —</option>
                {accounts
                  .filter((account) => account.id !== editingId)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Description" htmlFor="acc-description">
              <TextArea
                id="acc-description"
                rows={2}
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
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
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create account'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete account"
        message={`Delete account "${deleting?.code} · ${deleting?.name}"?`}
        confirmLabel="Delete"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
