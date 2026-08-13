import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../api/schema';
import type { Supplier } from '../api/types';
import { supplierFormSchema, type SupplierFormValues } from '../api/schemas';
import { useApiInvalidation, useApiMutation } from '../api/hooks';
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
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

type CreateSupplierDto = components['schemas']['CreateSupplierDto'];

const emptyForm: SupplierFormValues = {
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

function toDto(form: SupplierFormValues): CreateSupplierDto {
  return {
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
}

function fromSupplier(supplier: Supplier): SupplierFormValues {
  return {
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
  };
}

export function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: emptyForm,
  });

  const active = watch('active');

  const { data, error } = usePagedQuery<Supplier>({
    path: '/api/v1/purchasing/suppliers',
    page,
    query,
  });

  const createMutation = useApiMutation<CreateSupplierDto>('/api/v1/purchasing/suppliers', 'POST');
  const updateMutation = useApiMutation<CreateSupplierDto>(
    `/api/v1/purchasing/suppliers/${editingId ?? ''}`,
    'PATCH',
  );
  const deleteMutation = useApiMutation<Record<string, never>, unknown>(
    `/api/v1/purchasing/suppliers/${deleting?.id ?? ''}`,
    'DELETE',
  );

  const saving = createMutation.isPending || updateMutation.isPending;
  const deleteBusy = deleteMutation.isPending;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    reset(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    reset(fromSupplier(supplier));
    setFormError(null);
    setModalOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? 'Supplier updated.' : 'Supplier created.');
      setModalOpen(false);
      void invalidate(['paged', '/api/v1/purchasing/suppliers']);
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(toDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(toDto(values), { onSuccess, onError });
    }
  });

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      {},
      {
        onSuccess: () => {
          toast.toast('Supplier deactivated.');
          setDeleting(null);
          void invalidate(['paged', '/api/v1/purchasing/suppliers']);
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
          setDeleting(null);
        },
      },
    );
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
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>
      ),
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

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingId ? 'Edit supplier' : 'New supplier'} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="supplier-code">Code *</label>
                <input id="supplier-code" {...register('code')} />
                {errors.code ? <div className="field-error">{errors.code.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="supplier-trade">Trade name *</label>
                <input id="supplier-trade" {...register('tradeName')} />
                {errors.tradeName ? <div className="field-error">{errors.tradeName.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="supplier-legal">Legal name</label>
                <input id="supplier-legal" {...register('legalName')} />
              </div>
              <div className="field">
                <label htmlFor="supplier-tax">Tax ID</label>
                <input id="supplier-tax" {...register('taxId')} />
              </div>
              <div className="field">
                <label htmlFor="supplier-email">Email</label>
                <input id="supplier-email" type="email" {...register('email')} />
                {errors.email ? <div className="field-error">{errors.email.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="supplier-phone">Phone</label>
                <input id="supplier-phone" {...register('phone')} />
              </div>
              <div className="field">
                <label htmlFor="supplier-currency">Currency</label>
                <input id="supplier-currency" maxLength={3} {...register('currency')} />
              </div>
              <div className="field">
                <label htmlFor="supplier-terms">Payment terms</label>
                <input id="supplier-terms" placeholder="e.g. net 30" {...register('paymentTerms')} />
              </div>
              <div className="field">
                <label htmlFor="supplier-credit">Credit limit</label>
                <input id="supplier-credit" type="number" min="0" step="0.01" {...register('creditLimit')} />
                {errors.creditLimit ? <div className="field-error">{errors.creditLimit.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="supplier-address">Address</label>
                <textarea id="supplier-address" rows={2} {...register('address')} />
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="supplier-active"
                    checked={active}
                    onCheckedChange={(checked) => setValue('active', checked === true)}
                  />
                  <label htmlFor="supplier-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !deleteBusy && !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader
            title="Deactivate supplier"
            description={`Deactivate "${deleting?.tradeName}"? It will be excluded from new purchase orders.`}
          />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy ? 'Working…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
