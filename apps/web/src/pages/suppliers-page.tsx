import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
  PageHeader,
  Pagination,
  TableSkeleton,
  Toolbar,
  Input,
  Textarea,
} from '../components/ui';
import { Truck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { CsvImportDialog } from '../components/csv-import-dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';

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

export function SuppliersPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => parsePageNumber(searchParams.get('page')));
  const [limit, setLimit] = useState(() => parseLimitNumber(searchParams.get('limit')));
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [input, setInput] = useState(() => searchParams.get('q') ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [importOpen, setImportOpen] = useState(false);
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
    limit,
    query,
  });

  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    setInput(urlQuery);
    setQuery(urlQuery);
    setPage(parsePageNumber(searchParams.get('page')));
    setLimit(parseLimitNumber(searchParams.get('limit')));
  }, [searchParams]);

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
      toast.toast(editingId ? t('suppliers.supplierUpdated') : t('suppliers.supplierCreated'));
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
          toast.toast(t('suppliers.supplierDeactivated'));
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
    { key: 'code', header: t('fields.code') },
    { key: 'tradeName', header: t('suppliers.tradeName') },
    { key: 'taxId', header: t('fields.taxId'), render: (row) => row.taxId ?? 'â€”' },
    { key: 'email', header: t('fields.email'), render: (row) => row.email ?? 'â€”' },
    { key: 'phone', header: t('fields.phone'), render: (row) => row.phone ?? 'â€”' },
    {
      key: 'creditLimit',
      header: t('fields.creditLimit'),
      render: (row) => (row.creditLimit != null ? formatMoney(row.creditLimit) : 'â€”'),
    },
    {
      key: 'active',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? t('common.active') : t('common.inactive')}</Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {t('common.edit')}
          </Button>
          {row.active ? (
            <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
              {t('common.deactivate')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'suppliers', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
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
            <Button onClick={openCreate}>{t('suppliers.newSupplier')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      <Toolbar as="form" onSubmit={(event) => void submitSearch(event)}>
        <Input
          className="max-w-[320px] flex-1 w-full"
          type="search"
          placeholder={t('suppliers.searchPlaceholder')}
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
            <EmptyState message={t('suppliers.noSuppliersFound')} icon={<Truck className="size-6" />} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={handlePageChange} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingId ? t('suppliers.editSupplier') : t('suppliers.newSupplier')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-code">{t('fields.code')} *</label>
                <Input id="supplier-code" className="w-full" {...register('code')} />
                {errors.code ?               <div className="text-[12px] font-normal text-danger">{errors.code.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-trade">{t('suppliers.tradeName')} *</label>
                <Input id="supplier-trade" className="w-full" {...register('tradeName')} />
                {errors.tradeName ?               <div className="text-[12px] font-normal text-danger">{errors.tradeName.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-legal">{t('fields.legalName')}</label>
                <Input id="supplier-legal" className="w-full" {...register('legalName')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-tax">{t('fields.taxId')}</label>
                <Input id="supplier-tax" className="w-full" {...register('taxId')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-email">{t('fields.email')}</label>
                <Input id="supplier-email" type="email" className="w-full" {...register('email')} />
                {errors.email ?               <div className="text-[12px] font-normal text-danger">{errors.email.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-phone">{t('fields.phone')}</label>
                <Input id="supplier-phone" className="w-full" {...register('phone')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-currency">{t('fields.currency')}</label>
                <Input id="supplier-currency" maxLength={3} className="w-full" {...register('currency')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-terms">{t('suppliers.paymentTerms')}</label>
                <Input id="supplier-terms" placeholder={t('suppliers.paymentTermsPlaceholder')} className="w-full" {...register('paymentTerms')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-credit">{t('fields.creditLimit')}</label>
                <Input id="supplier-credit" type="number" min="0" step="0.01" className="w-full" {...register('creditLimit')} />
                {errors.creditLimit ?               <div className="text-[12px] font-normal text-danger">{errors.creditLimit.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="supplier-address">{t('fields.address')}</label>
                <Textarea id="supplier-address" rows={2} className="w-full" {...register('address')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label>{t('common.status')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="supplier-active"
                    checked={active}
                    onCheckedChange={(checked) => setValue('active', checked === true)}
                  />
                  <label htmlFor="supplier-active" className="text-sm text-gray-700">
                    {t('common.active')}
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('suppliers.createSupplier')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !deleteBusy && !open && setDeleting(null)}
        title={t('suppliers.deactivateSupplierTitle')}
        description={t('suppliers.deactivateSupplierMessage', { name: deleting?.tradeName ?? '' })}
        confirmLabel={t('common.deactivate')}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
      />
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        type="suppliers"
        onImported={() =>
          void invalidate(['paged', '/api/v1/purchasing/suppliers']).then(() =>
            toast.toast(t('suppliers.imported')),
          )
        }
      />
    </>
  );
}
