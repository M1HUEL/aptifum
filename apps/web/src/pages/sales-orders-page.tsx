import { useEffect, useState, type FormEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, ApiError } from '../api/client';
import type { components } from '../api/schema';
import type {
  Customer,
  Paginated,
  Product,
  SalesOrder,
  SalesOrderStatus,
  Warehouse,
} from '../api/types';
import { salesOrderFormSchema, type SalesOrderFormValues } from '../api/schemas';
import { useApiInvalidation, useApiMutation, useApiMutationVoid } from '../api/hooks';
import {
  Badge,
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatDate,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
  StatusSelect,
  TableSkeleton,
} from '../components/ui';
import { ClipboardList } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { SearchableSelect } from '../components/ui/searchable-select';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';

type CreateOrderDto = components['schemas']['CreateOrderDto'];
type CreateOrderItemDto = components['schemas']['CreateOrderItemDto'];

function statusTone(status: SalesOrderStatus): BadgeTone {
  if (status === 'invoiced') return 'success';
  if (status === 'confirmed') return 'info';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

const emptyItem: SalesOrderFormValues['items'][number] = {
  productId: '',
  quantity: '1',
  unitPrice: '',
  taxRate: '',
  discount: '',
};

const emptyForm: SalesOrderFormValues = {
  kind: 'order',
  customerId: '',
  warehouseId: '',
  issueDate: '',
  dueDate: '',
  discount: '',
  notes: '',
  items: [emptyItem],
};

function toDto(form: SalesOrderFormValues): CreateOrderDto {
  const items = form.items
    .filter((item) => item.productId)
    .map((item) => {
      const dto: CreateOrderItemDto = {
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? undefined : Number(item.unitPrice),
        taxRate: item.taxRate === '' ? undefined : Number(item.taxRate),
        discount: item.discount === '' ? undefined : Number(item.discount),
      };
      return dto;
    });
  return {
    kind: form.kind,
    customerId: form.customerId,
    warehouseId: form.warehouseId,
    issueDate: form.issueDate || undefined,
    dueDate: form.dueDate || undefined,
    discount: form.discount === '' ? undefined : Number(form.discount),
    notes: form.notes.trim() || undefined,
    items,
  };
}

export function SalesOrdersPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SalesOrder | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [statusAction, setStatusAction] = useState<{
    id: string;
    action: 'confirm' | 'convert' | 'cancel';
    messageKey: 'salesOrders.orderConfirmed' | 'salesOrders.quoteConverted' | 'salesOrders.orderCancelled';
  } | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const { data, error } = usePagedQuery<SalesOrder>({
    path: '/api/v1/sales/orders',
    page,
    limit,
    query,
    extraParams: { kind: kindFilter, status: statusFilter },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: emptyForm,
  });

  const items = watch('items');
  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: customer.tradeName,
  }));
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.sku} · ${product.name}`,
  }));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Paginated<Customer>>('/api/v1/sales/customers?page=1&limit=100'),
      apiFetch<Paginated<Product>>('/api/v1/inventory/products?page=1&limit=100'),
      apiFetch<Paginated<Warehouse>>('/api/v1/inventory/warehouses?page=1&limit=100'),
    ])
      .then(([customersResult, productsResult, warehousesResult]) => {
        if (cancelled) return;
        setCustomers(customersResult.data);
        setProducts(productsResult.data);
        setWarehouses(warehousesResult.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const createMutation = useApiMutation<CreateOrderDto>('/api/v1/sales/orders', 'POST');
  const statusMutation = useApiMutationVoid(
    statusAction
      ? `/api/v1/sales/orders/${statusAction.id}/${statusAction.action}`
      : '/api/v1/sales/orders',
    'POST',
  );

  const saving = createMutation.isPending;

  useEffect(() => {
    if (!statusAction) return;
    statusMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t(statusAction.messageKey));
        void invalidate(['paged', '/api/v1/sales/orders']);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
      },
    });
    setStatusAction(null);
  }, [statusAction]);

  const openCreate = () => {
    reset(emptyForm);
    setFormError(null);
    setCreateOpen(true);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
  };

  const addItem = () => {
    setValue('items', [...items, emptyItem]);
  };

  const removeItem = (index: number) => {
    setValue('items', items.filter((_, i) => i !== index));
  };

  const submitCreate = handleSubmit((values) => {
    setFormError(null);
    const body = toDto(values);
    if (body.items.length === 0) {
      setFormError(t('salesOrders.addAtLeastOneLine'));
      return;
    }
    createMutation.mutate(body, {
      onSuccess: () => {
        toast.toast(values.kind === 'quote' ? t('salesOrders.quoteCreated') : t('salesOrders.orderCreated'));
        setCreateOpen(false);
        void invalidate(['paged', '/api/v1/sales/orders']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  const runAction = (
    id: string,
    action: 'confirm' | 'convert' | 'cancel',
    messageKey: 'salesOrders.orderConfirmed' | 'salesOrders.quoteConverted' | 'salesOrders.orderCancelled',
  ) => {
    setStatusAction({ id, action, messageKey });
  };

  const openView = async (order: SalesOrder) => {
    setViewing(order);
    setViewLoading(true);
    try {
      const detail = await apiFetch<SalesOrder>(`/api/v1/sales/orders/${order.id}`);
      setViewing(detail);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : t('salesOrders.couldNotLoad'), 'error');
    } finally {
      setViewLoading(false);
    }
  };

  const columns: Column<SalesOrder>[] = [
    { key: 'number', header: t('tables.number') },
    {
      key: 'kind',
      header: t('fields.kind'),
      render: (row) => <Badge tone={row.kind === 'order' ? 'info' : 'neutral'}>{row.kind}</Badge>,
    },
    {
      key: 'customer',
      header: t('tables.customer'),
      render: (row) => row.customer?.tradeName ?? '—',
    },
    {
      key: 'warehouse',
      header: t('fields.warehouse'),
      render: (row) => row.warehouse?.name ?? '—',
    },
    {
      key: 'issueDate',
      header: t('tables.issueDate'),
      render: (row) => formatDate(row.issueDate),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'total',
      header: t('tables.total'),
      render: (row) => formatMoney(row.total),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => void openView(row)}>
            {t('common.view')}
          </Button>
          {row.status === 'draft' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runAction(row.id, 'confirm', 'salesOrders.orderConfirmed')}
            >
              {t('salesOrders.confirm')}
            </Button>
          ) : null}
          {row.status === 'draft' && row.kind === 'quote' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runAction(row.id, 'convert', 'salesOrders.quoteConverted')}
            >
              {t('salesOrders.convert')}
            </Button>
          ) : null}
          {row.status !== 'invoiced' && row.status !== 'cancelled' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => runAction(row.id, 'cancel', 'salesOrders.orderCancelled')}
            >
              {t('salesOrders.cancel')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'sales-orders', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('salesOrders.title')}
        subtitle={t('salesOrders.subtitle')}
        action={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('common.export')}
              onClick={handleExport}
            >
              {t('common.export')}
            </button>
            <Button onClick={openCreate}>{t('salesOrders.newOrder')}</Button>
          </div>
        }
      />
      <form className="mb-4 flex gap-2.5" onSubmit={(event) => void submitSearch(event)}>
        <input
          className="max-w-[320px] flex-1 w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          type="search"
          placeholder={t('salesOrders.searchByNumber')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <select className="rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text"
          value={kindFilter}
          onChange={(event) => {
            setKindFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('salesOrders.allKinds')}</option>
          <option value="quote">{t('salesOrders.quote')}</option>
          <option value="order">{t('salesOrders.order')}</option>
        </select>
        <StatusSelect
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          ariaLabel={t('common.status')}
          options={[
            { value: '', label: t('salesOrders.allStatuses') },
            { value: 'draft', label: t('salesOrders.draft') },
            { value: 'confirmed', label: t('salesOrders.confirmed') },
            { value: 'invoiced', label: t('salesOrders.invoiced') },
            { value: 'cancelled', label: t('salesOrders.cancelled') },
          ]}
        />
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('common.search')}
        </button>
      </form>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('salesOrders.noOrders')} icon={<ClipboardList className="size-6" />} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('salesOrders.newOrder')} />
          <form onSubmit={(event) => void submitCreate(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="so-kind">{t('fields.kind')} *</label>
                <select id="so-kind" className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" {...register('kind')}>
                  <option value="order">{t('salesOrders.order')}</option>
                  <option value="quote">{t('salesOrders.quote')}</option>
                </select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="so-customer">{t('fields.customer')} *</label>
                <Controller
                  control={control}
                  name="customerId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={customerOptions}
                      placeholder={t('salesOrders.selectCustomer')}
                      ariaLabel={t('fields.customer')}
                    />
                  )}
                />
                {errors.customerId ? <div className="text-[12px] font-normal text-danger">{errors.customerId.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="so-warehouse">{t('fields.warehouse')} *</label>
                <select id="so-warehouse" className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" {...register('warehouseId')}>
                  <option value="">{t('salesOrders.selectWarehouse')}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                {errors.warehouseId ? <div className="text-[12px] font-normal text-danger">{errors.warehouseId.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="so-issue">{t('fields.issueDate')}</label>
                <input id="so-issue" type="date" className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" {...register('issueDate')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="so-due">{t('fields.dueDate')}</label>
                <input id="so-due" type="date" className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" {...register('dueDate')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="so-discount">{t('fields.discount')}</label>
                <input id="so-discount" type="number" min="0" step="0.01" className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" {...register('discount')} />
                {errors.discount ? <div className="text-[12px] font-normal text-danger">{errors.discount.message}</div> : null}
              </div>
            </div>
            <div className="mb-3 rounded-ui border border-border p-3">
              {items.map((_, index) => (
                <div className="grid grid-cols-[3fr_1fr_1.5fr_1fr_auto] items-start gap-2.5" key={index}>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`so-item-product-${index}`}>{t('fields.product')}</label>
                    <Controller
                      control={control}
                      name={`items.${index}.productId`}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={productOptions}
                          placeholder={t('salesOrders.selectProduct')}
                          ariaLabel={t('fields.product')}
                        />
                      )}
                    />
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`so-item-qty-${index}`}>{t('fields.qty')}</label>
                    <input
                      id={`so-item-qty-${index}`}
                      type="number"
                      min="0.0001"
                      step="any"
                      className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                      {...register(`items.${index}.quantity`)}
                    />
                    {errors.items?.[index]?.quantity ? (
                      <div className="text-[12px] font-normal text-danger">{errors.items[index]?.quantity?.message}</div>
                    ) : null}
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`so-item-price-${index}`}>{t('fields.unitPrice')}</label>
                    <input
                      id={`so-item-price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t('salesOrders.salePricePlaceholder')}
                      className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                      {...register(`items.${index}.unitPrice`)}
                    />
                    {errors.items?.[index]?.unitPrice ? (
                      <div className="text-[12px] font-normal text-danger">{errors.items[index]?.unitPrice?.message}</div>
                    ) : null}
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`so-item-tax-${index}`}>{t('fields.taxRate')} %</label>
                    <input
                      id={`so-item-tax-${index}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder={t('salesOrders.taxPlaceholder')}
                      className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                      {...register(`items.${index}.taxRate`)}
                    />
                    {errors.items?.[index]?.taxRate ? (
                      <div className="text-[12px] font-normal text-danger">{errors.items[index]?.taxRate?.message}</div>
                    ) : null}
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`so-item-discount-${index}`}>{t('fields.discount')}</label>
                    <input
                      id={`so-item-discount-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                      {...register(`items.${index}.discount`)}
                    />
                    {errors.items?.[index]?.discount ? (
                      <div className="text-[12px] font-normal text-danger">{errors.items[index]?.discount?.message}</div>
                    ) : null}
                  </div>
                  <div className="pt-6">
                    {items.length > 1 ? (
                      <Button variant="ghost" size="sm" type="button" onClick={() => removeItem(index)}>
                        {t('common.remove')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addItem}>
              {t('common.addLine')}
            </Button>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="so-notes">{t('fields.notes')}</label>
              <textarea id="so-notes" rows={2} className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" {...register('notes')} />
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('salesOrders.createOrder')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('salesOrders.orderTitle', { number: viewing?.number ?? '' })} />
          {viewLoading ? <LoadingBlock /> : null}
          {!viewLoading && viewing ? (
            <div>
              <div className="mb-2 grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1 gap-y-3">
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.kind')}</div>
                  <div className="mt-0.5 block">{viewing.kind}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('common.status')}</div>
                  <div className="mt-0.5 block">
                    <Badge tone={statusTone(viewing.status)}>{viewing.status}</Badge>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.customer')}</div>
                  <div className="mt-0.5 block">{viewing.customer?.tradeName ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.warehouse')}</div>
                  <div className="mt-0.5 block">{viewing.warehouse?.name ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.issueDate')}</div>
                  <div className="mt-0.5 block">{formatDate(viewing.issueDate)}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.dueDate')}</div>
                  <div className="mt-0.5 block">{viewing.dueDate ? formatDate(viewing.dueDate) : '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.subtotal')}</div>
                  <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.subtotal)}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.discount')}</div>
                  <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.discount)}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.tax')}</div>
                  <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.tax)}</div>
                </div>
                <div className="detail-item">
                  <div className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.total')}</div>
                  <div className="mt-0.5 text-right tabular-nums">{formatMoney(viewing.total)}</div>
                </div>
              </div>
              <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th>{t('fields.product')}</th>
                      <th className="text-right tabular-nums">{t('fields.qty')}</th>
                      <th className="text-right tabular-nums">{t('fields.unitPrice')}</th>
                      <th className="text-right tabular-nums">{t('fields.tax')}</th>
                      <th className="text-right tabular-nums">{t('salesOrders.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.description ?? item.product?.name ?? item.productId}</td>
                        <td className="text-right tabular-nums">{item.quantity}</td>
                        <td className="text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                        <td className="text-right tabular-nums">{formatMoney(item.taxAmount)}</td>
                        <td className="text-right tabular-nums">{formatMoney(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewing.notes ? <div className="mt-2">{viewing.notes}</div> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setViewing(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
