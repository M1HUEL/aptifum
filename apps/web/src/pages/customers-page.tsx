import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as core from '@aptifum/core';
import type { components } from '../api/schema';
import type { Customer } from '../api/types';
import { customerFormSchema, type CustomerFormValues } from '../api/schemas';
import {
  EmptyState,
  ErrorBanner,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useApiInvalidation, useApiMutation } from '../api/hooks';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

type CreateCustomerDto = components['schemas']['CreateCustomerDto'];

const emptyForm: CustomerFormValues = {
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

function toDto(form: CustomerFormValues): CreateCustomerDto {
  return {
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
    state: (form.state as CreateCustomerDto['state']) || undefined,
    taxExempt: form.taxExempt,
    active: form.active,
  };
}

function fromCustomer(customer: Customer): CustomerFormValues {
  return {
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
  };
}

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: emptyForm,
  });

  const { data, error } = usePagedQuery<Customer>({
    path: '/api/v1/sales/customers',
    page,
    query,
  });

  const taxExempt = watch('taxExempt');
  const active = watch('active');

  const createMutation = useApiMutation<CreateCustomerDto>('/api/v1/sales/customers', 'POST');
  const updateMutation = useApiMutation<CreateCustomerDto>(`/api/v1/sales/customers/${editingId ?? ''}`, 'PATCH');
  const deleteMutation = useApiMutation<Record<string, never>, unknown>(`/api/v1/sales/customers/${deleting?.id ?? ''}`, 'DELETE');

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

  const openEdit = (customer: Customer) => {
    setEditingId(customer.id);
    reset(fromCustomer(customer));
    setFormError(null);
    setModalOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const body = toDto(values);
    const onSuccess = () => {
      toast.toast(editingId ? 'Customer updated.' : 'Customer created.');
      setModalOpen(false);
      void invalidate(['paged', '/api/v1/sales/customers']);
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(body, { onSuccess, onError });
    } else {
      createMutation.mutate(body, { onSuccess, onError });
    }
  });

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      {},
      {
        onSuccess: () => {
          toast.toast('Customer deactivated.');
          setDeleting(null);
          void invalidate(['paged', '/api/v1/sales/customers']);
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
          setDeleting(null);
        },
      },
    );
  };

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'tradeName', header: 'Trade name' },
    { key: 'taxId', header: 'Tax ID', render: (row: Customer) => row.taxId ?? '—' },
    { key: 'email', header: 'Email', render: (row: Customer) => row.email ?? '—' },
    { key: 'creditLimit', header: 'Credit limit', render: (row: Customer) => formatMoney(row.creditLimit) },
    {
      key: 'active',
      header: 'Status',
      render: (row: Customer) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: Customer) => (
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
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key}>{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr key={row.id}>
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.render ? col.render(row) : String((row as unknown as Record<string, unknown>)[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingId ? 'Edit customer' : 'New customer'} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="customer-code">Code *</label>
                <input id="customer-code" {...register('code')} />
                {errors.code ? <div className="field-error">{errors.code.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="customer-trade">Trade name *</label>
                <input id="customer-trade" {...register('tradeName')} />
                {errors.tradeName ? <div className="field-error">{errors.tradeName.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="customer-legal">Legal name</label>
                <input id="customer-legal" {...register('legalName')} />
              </div>
              <div className="field">
                <label htmlFor="customer-tax">Tax ID</label>
                <input id="customer-tax" {...register('taxId')} />
              </div>
              <div className="field">
                <label htmlFor="customer-email">Email</label>
                <input id="customer-email" type="email" {...register('email')} />
                {errors.email ? <div className="field-error">{errors.email.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="customer-phone">Phone</label>
                <input id="customer-phone" {...register('phone')} />
              </div>
              <div className="field">
                <label htmlFor="customer-currency">Currency</label>
                <input id="customer-currency" maxLength={3} {...register('currency')} />
              </div>
              <div className="field">
                <label htmlFor="customer-credit">Credit limit</label>
                <input id="customer-credit" type="number" min="0" step="0.01" {...register('creditLimit')} />
                {errors.creditLimit ? <div className="field-error">{errors.creditLimit.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="customer-price">Price category</label>
                <input id="customer-price" placeholder="e.g. retail, wholesale" {...register('priceCategory')} />
              </div>
              <div className="field">
                <label htmlFor="customer-address">Address</label>
                <textarea id="customer-address" rows={2} {...register('address')} />
              </div>
              <div className="field">
                <label htmlFor="customer-state">State (US)</label>
                <div className="field-hint">Used to apply US sales tax automatically.</div>
                <select id="customer-state" {...register('state')}>
                  <option value="">No state</option>
                  {Object.entries(core.US_STATES).map(([code, info]) => (
                    <option key={code} value={code}>
                      {code} — {info.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tax status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox id="customer-tax-exempt" checked={taxExempt} onCheckedChange={(checked) => setValue('taxExempt', checked === true)} />
                  <label htmlFor="customer-tax-exempt" className="text-sm text-gray-700">
                    Tax exempt
                  </label>
                </div>
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox id="customer-active" checked={active} onCheckedChange={(checked) => setValue('active', checked === true)} />
                  <label htmlFor="customer-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !deleteBusy && !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader title="Deactivate customer" description={`Deactivate "${deleting?.tradeName}"? It will be excluded from new invoices.`} />
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
