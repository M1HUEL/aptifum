import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as core from '@aptifum/core';
import type { components } from '../api/schema';
import type { Customer } from '../api/types';
import { apiFetch } from '../api/client';
import { customerFormSchema, type CustomerFormValues } from '../api/schemas';
import {
  DataTable,
  EmptyState,
  ErrorBanner,
  formatMoney,
  PageHeader,
  Pagination,
  TableSkeleton,
  Toolbar,
  Input,
  Select,
  Textarea,
  type Column,
  type DataTableSort,
} from '../components/ui';
import { Users } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { CsvImportDialog } from '../components/csv-import-dialog';
import { useApiInvalidation, useApiMutation } from '../api/hooks';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { useNewRecordShortcut } from '../hooks/use-new-record-shortcut';
import { exportRowsToCsv } from '../lib/csv';

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

function parsePageNumber(raw: string | null): number {
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function parseLimitNumber(raw: string | null): number {
  if (!raw) return 20;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 20 : parsed;
}

export function CustomersPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => parsePageNumber(searchParams.get('page')));
  const [limit, setLimit] = useState(() => parseLimitNumber(searchParams.get('limit')));
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [input, setInput] = useState(() => searchParams.get('q') ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sort, setSort] = useState<DataTableSort | null>(() => {
    const key = searchParams.get('sort');
    const dir = searchParams.get('order');
    return key && (dir === 'asc' || dir === 'desc') ? { key, dir } : null;
  });
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
    limit,
    query,
  });

  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    setInput(urlQuery);
    setQuery(urlQuery);
    setPage(parsePageNumber(searchParams.get('page')));
    setLimit(parseLimitNumber(searchParams.get('limit')));
    const sortKey = searchParams.get('sort');
    const sortDir = searchParams.get('order');
    setSort(sortKey && (sortDir === 'asc' || sortDir === 'desc') ? { key: sortKey, dir: sortDir } : null);
  }, [searchParams]);

  const taxExempt = watch('taxExempt');
  const active = watch('active');

  const createMutation = useApiMutation<CreateCustomerDto>('/api/v1/sales/customers', 'POST');
  const updateMutation = useApiMutation<CreateCustomerDto>(`/api/v1/sales/customers/${editingId ?? ''}`, 'PATCH');
  const deleteMutation = useApiMutation<Record<string, never>, unknown>(`/api/v1/sales/customers/${deleting?.id ?? ''}`, 'DELETE');

  const saving = createMutation.isPending || updateMutation.isPending;
  const deleteBusy = deleteMutation.isPending;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = input.trim();
    setQuery(nextQuery);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (nextQuery) params.set('q', nextQuery);
    else params.delete('q');
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (next: number) => {
    setPage(next);
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params);
  };

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    params.set('limit', String(next));
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleSortChange = (next: DataTableSort | null) => {
    setSort(next);
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set('sort', next.key);
      params.set('order', next.dir);
    } else {
      params.delete('sort');
      params.delete('order');
    }
    setSearchParams(params);
  };

  const openCreate = () => {
    setEditingId(null);
    reset(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  useNewRecordShortcut(openCreate);

  const clearSearch = () => {
    setInput('');
    setQuery('');
    setPage(1);
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    params.set('page', '1');
    setSearchParams(params);
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
      toast.toast(editingId ? t('customers.customerUpdated') : t('customers.customerCreated'));
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
    const customerId = deleting.id;
    deleteMutation.mutate(
      {},
      {
        onSuccess: () => {
          toast.toast(t('customers.customerDeactivated'), 'success', {
            label: t('common.undo'),
            onClick: () => {
              void apiFetch(`/api/v1/sales/customers/${customerId}`, {
                method: 'PATCH',
                body: JSON.stringify({ active: true }),
              }).then(() => {
                void invalidate(['paged', '/api/v1/sales/customers']);
              });
            },
          });
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

  const columns: Column<Customer>[] = [
    { key: 'code', header: t('fields.code') },
    { key: 'tradeName', header: t('fields.tradeName') },
    { key: 'taxId', header: t('fields.taxId'), render: (row: Customer) => row.taxId ?? '—' },
    { key: 'email', header: t('fields.email'), render: (row: Customer) => row.email ?? '—' },
    { key: 'creditLimit', header: t('fields.creditLimit'), render: (row: Customer) => formatMoney(row.creditLimit) },
    {
      key: 'active',
      header: t('common.status'),
      render: (row: Customer) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? t('common.active') : t('common.inactive')}</Badge>
      ),
      sortValue: (row: Customer) => (row.active ? 1 : 0),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row: Customer) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {t('common.edit')}
          </Button>
          {row.active ? (
            <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
              {t('customers.deactivate')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'customers', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        action={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              aria-label={t('common.export')}
              onClick={handleExport}
            >
              {t('common.export')}
            </Button>
            <Button type="button" onClick={() => setImportOpen(true)}>
              {t('common.import')}
            </Button>
            <Button onClick={openCreate}>{t('customers.newCustomer')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      <Toolbar as="form" onSubmit={(event) => void submitSearch(event)}>
        <Input
          className="max-w-[320px] flex-1 w-full"
          type="search"
          placeholder={t('customers.searchByTradeName')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button
          type="submit"
        >
          {t('common.search')}
        </Button>
      </Toolbar>
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState
              message={t('customers.noCustomers')}
              icon={<Users className="size-6" />}
              action={
                query ? (
                  <Button variant="ghost" onClick={clearSearch}>
                    {t('common.clearFilters')}
                  </Button>
                ) : (
                  <Button onClick={openCreate}>{t('customers.newCustomer')}</Button>
                )
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={data.data}
              rowKey={(row) => row.id}
              sort={sort}
              onSortChange={handleSortChange}
            />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={handlePageChange} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingId ? t('customers.editCustomer') : t('customers.newCustomer')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-code">{t('fields.code')} *</label>
                <Input id="customer-code" className="w-full" {...register('code')} />
                {errors.code ?               <div className="text-[12px] font-normal text-danger">{errors.code.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-trade">{t('fields.tradeName')} *</label>
                <Input id="customer-trade" className="w-full" {...register('tradeName')} />
                {errors.tradeName ?               <div className="text-[12px] font-normal text-danger">{errors.tradeName.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-legal">{t('fields.legalName')}</label>
                <Input id="customer-legal" className="w-full" {...register('legalName')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-tax">{t('fields.taxId')}</label>
                <Input id="customer-tax" className="w-full" {...register('taxId')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-email">{t('fields.email')}</label>
                <Input id="customer-email" type="email" className="w-full" {...register('email')} />
                {errors.email ?               <div className="text-[12px] font-normal text-danger">{errors.email.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-phone">{t('fields.phone')}</label>
                <Input id="customer-phone" className="w-full" {...register('phone')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-currency">{t('fields.currency')}</label>
                <Input id="customer-currency" maxLength={3} className="w-full" {...register('currency')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-credit">{t('fields.creditLimit')}</label>
                <Input id="customer-credit" type="number" min="0" step="0.01" className="w-full" {...register('creditLimit')} />
                {errors.creditLimit ?               <div className="text-[12px] font-normal text-danger">{errors.creditLimit.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-price">{t('fields.priceCategory')}</label>
                <Input id="customer-price" placeholder={t('customers.priceCategoryPlaceholder')} className="w-full" {...register('priceCategory')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-address">{t('fields.address')}</label>
                <Textarea id="customer-address" rows={2} className="w-full" {...register('address')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="customer-state">{t('customers.stateUs')}</label>
                <div className="text-[12px] font-normal text-muted">{t('customers.stateHint')}</div>
                <Select id="customer-state" className="w-full" {...register('state')}>
                  <option value="">{t('customers.noState')}</option>
                  {Object.entries(core.US_STATES).map(([code, info]) => (
                    <option key={code} value={code}>
                      {code} â€” {info.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label>{t('customers.taxStatus')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox id="customer-tax-exempt" checked={taxExempt} onCheckedChange={(checked) => setValue('taxExempt', checked === true)} />
                  <label htmlFor="customer-tax-exempt" className="text-sm text-gray-700">
                    {t('fields.taxExempt')}
                  </label>
                </div>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label>{t('common.status')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox id="customer-active" checked={active} onCheckedChange={(checked) => setValue('active', checked === true)} />
                  <label htmlFor="customer-active" className="text-sm text-gray-700">
                    {t('common.active')}
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('customers.createCustomer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !deleteBusy && !open && setDeleting(null)}
        title={t('customers.deactivateCustomerTitle')}
        description={t('customers.deactivateCustomerMessage', { name: deleting?.tradeName ?? '' })}
        confirmLabel={t('customers.deactivate')}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
      />
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        type="customers"
        onImported={() =>
          void invalidate(['paged', '/api/v1/sales/customers']).then(() => toast.toast(t('customers.imported')))
        }
      />
    </>
  );
}
