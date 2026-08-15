import { useEffect, useState, type FormEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, ApiError } from '../api/client';
import type { components } from '../api/schema';
import type {
  Paginated,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  Supplier,
  Warehouse,
} from '../api/types';
import {
  purchaseOrderFormSchema,
  purchaseReceiptFormSchema,
  type PurchaseOrderFormValues,
  type PurchaseReceiptFormValues,
} from '../api/schemas';
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
  PageHeader,
  Pagination,
  StatusSelect,
  TableSkeleton,
  Input,
  Select,
  Textarea,
} from '../components/ui';
import { ShoppingBag } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { SearchableSelect } from '../components/ui/searchable-select';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';

type CreatePurchaseOrderDto = components['schemas']['CreatePurchaseOrderDto'];
type CreatePurchaseOrderItemDto = components['schemas']['CreatePurchaseOrderItemDto'];
type CreateGoodsReceiptDto = components['schemas']['CreateGoodsReceiptDto'];
type CreateGoodsReceiptItemDto = components['schemas']['CreateGoodsReceiptItemDto'];

function statusTone(status: PurchaseOrderStatus): BadgeTone {
  if (status === 'received') return 'success';
  if (status === 'approved') return 'info';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

const emptyItem: PurchaseOrderFormValues['items'][number] = {
  productId: '',
  quantity: '1',
  unitCost: '',
  taxRate: '',
};

const emptyForm: PurchaseOrderFormValues = {
  supplierId: '',
  warehouseId: '',
  expectedAt: '',
  discount: '',
  notes: '',
  items: [emptyItem],
};

function toDto(form: PurchaseOrderFormValues): CreatePurchaseOrderDto {
  const items = form.items
    .filter((item) => item.productId)
    .map((item) => {
      const dto: CreatePurchaseOrderItemDto = {
        productId: item.productId,
        quantity: Number(item.quantity),
        unitCost: item.unitCost === '' ? undefined : Number(item.unitCost),
        taxRate: item.taxRate === '' ? undefined : Number(item.taxRate),
      };
      return dto;
    });
  return {
    supplierId: form.supplierId,
    warehouseId: form.warehouseId,
    expectedAt: form.expectedAt || undefined,
    discount: form.discount === '' ? undefined : Number(form.discount),
    notes: form.notes.trim() || undefined,
    items,
  };
}

const emptyReceipt: PurchaseReceiptFormValues = {
  notes: '',
  items: [],
};

export function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [statusAction, setStatusAction] = useState<{
    id: string;
    action: 'approve' | 'cancel';
    messageKey: 'purchaseOrders.orderApproved' | 'purchaseOrders.orderCancelled';
  } | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const { data, error } = usePagedQuery<PurchaseOrder>({
    path: '/api/v1/purchasing/purchase-orders',
    page,
    limit,
    query,
    extraParams: { status: statusFilter },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: emptyForm,
  });

  const items = watch('items');
  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.id,
    label: supplier.tradeName,
  }));
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.sku} · ${product.name}`,
  }));

  const receiveForm = useForm<PurchaseReceiptFormValues>({
    resolver: zodResolver(purchaseReceiptFormSchema),
    defaultValues: emptyReceipt,
  });

  const {
    register: receiveRegister,
    handleSubmit: receiveHandleSubmit,
    reset: resetReceive,
  } = receiveForm;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Paginated<Supplier>>('/api/v1/purchasing/suppliers?page=1&limit=100'),
      apiFetch<Paginated<Product>>('/api/v1/inventory/products?page=1&limit=100'),
      apiFetch<Paginated<Warehouse>>('/api/v1/inventory/warehouses?page=1&limit=100'),
    ])
      .then(([suppliersResult, productsResult, warehousesResult]) => {
        if (cancelled) return;
        setSuppliers(suppliersResult.data);
        setProducts(productsResult.data);
        setWarehouses(warehousesResult.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const createMutation = useApiMutation<CreatePurchaseOrderDto>(
    '/api/v1/purchasing/purchase-orders',
    'POST',
  );
  const receiveMutation = useApiMutation<CreateGoodsReceiptDto>(
    `/api/v1/purchasing/purchase-orders/${receiving?.id ?? ''}/receipts`,
    'POST',
  );
  const statusMutation = useApiMutationVoid(
    statusAction
      ? `/api/v1/purchasing/purchase-orders/${statusAction.id}/${statusAction.action}`
      : '/api/v1/purchasing/purchase-orders',
    'POST',
  );

  const saving = createMutation.isPending;
  const receiveBusy = receiveMutation.isPending;

  useEffect(() => {
    if (!statusAction) return;
    statusMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t(statusAction.messageKey));
        void invalidate(['paged', '/api/v1/purchasing/purchase-orders']);
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
      setFormError(t('purchaseOrders.addAtLeastOneLine'));
      return;
    }
    createMutation.mutate(body, {
      onSuccess: () => {
        toast.toast(t('purchaseOrders.orderCreated'));
        setCreateOpen(false);
        void invalidate(['paged', '/api/v1/purchasing/purchase-orders']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  const runAction = (
    id: string,
    action: 'approve' | 'cancel',
    messageKey: 'purchaseOrders.orderApproved' | 'purchaseOrders.orderCancelled',
  ) => {
    setStatusAction({ id, action, messageKey });
  };

  const openReceive = async (order: PurchaseOrder) => {
    setReceiveError(null);
    resetReceive(emptyReceipt);
    setReceiving(order);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/api/v1/purchasing/purchase-orders/${order.id}`);
      resetReceive({
        notes: '',
        items: detail.items.map((item) => ({
          orderItemId: item.id,
          quantity: String(Math.max(0, item.quantity - item.receivedQuantity)),
        })),
      });
      setReceiving(detail);
    } catch (err) {
      setReceiveError(err instanceof ApiError ? err.message : t('purchaseOrders.couldNotLoad'));
    }
  };

  const submitReceive = receiveHandleSubmit((values) => {
    setReceiveError(null);
    const itemsDto = values.items
      .filter((item) => Number(item.quantity) > 0)
      .map((item) => {
        const dto: CreateGoodsReceiptItemDto = {
          orderItemId: item.orderItemId,
          quantity: Number(item.quantity),
        };
        return dto;
      });
    if (itemsDto.length === 0) {
      setReceiveError(t('purchaseOrders.enterQuantityToReceive'));
      return;
    }
    receiveMutation.mutate(
      { notes: values.notes.trim() || undefined, items: itemsDto },
      {
        onSuccess: () => {
          toast.toast(t('purchaseOrders.receiptRecorded'));
          setReceiving(null);
          void invalidate(['paged', '/api/v1/purchasing/purchase-orders']);
        },
        onError: (err) => setReceiveError(err.message),
      },
    );
  });

  const columns: Column<PurchaseOrder>[] = [
    { key: 'number', header: t('tables.number') },
    {
      key: 'supplier',
      header: t('purchaseOrders.supplier'),
      render: (row) => row.supplier?.tradeName ?? '—',
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
          {row.status === 'draft' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => runAction(row.id, 'approve', 'purchaseOrders.orderApproved')}
              >
                {t('purchaseOrders.approve')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => runAction(row.id, 'cancel', 'purchaseOrders.orderCancelled')}
              >
                {t('purchaseOrders.cancel')}
              </Button>
            </>
          ) : null}
          {row.status === 'approved' ? (
            <Button variant="ghost" size="sm" onClick={() => void openReceive(row)}>
              {t('purchaseOrders.receive')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'purchase-orders', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('purchaseOrders.title')}
        subtitle={t('purchaseOrders.subtitle')}
        action={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              aria-label={t('common.export')}
              onClick={handleExport}
            >
              {t('common.export')}
            </Button>
            <Button onClick={openCreate}>{t('purchaseOrders.newOrder')}</Button>
          </div>
        }
      />
      <form className="mb-4 flex gap-2.5" onSubmit={(event) => void submitSearch(event)}>
        <Input
          className="max-w-[320px] flex-1 w-full"
          type="search"
          placeholder={t('purchaseOrders.searchByNumber')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <StatusSelect
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          ariaLabel={t('common.status')}
          options={[
            { value: '', label: t('purchaseOrders.allStatuses') },
            { value: 'draft', label: t('purchaseOrders.draft') },
            { value: 'approved', label: t('purchaseOrders.approved') },
            { value: 'received', label: t('purchaseOrders.received') },
            { value: 'cancelled', label: t('purchaseOrders.cancelled') },
          ]}
        />
        <Button
          type="submit"
        >
          {t('common.search')}
        </Button>
      </form>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('purchaseOrders.noOrders')} icon={<ShoppingBag className="size-6" />} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('purchaseOrders.newOrder')} />
          <form onSubmit={(event) => void submitCreate(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="po-supplier">{t('purchaseOrders.supplier')} *</label>
                <Controller
                  control={control}
                  name="supplierId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={supplierOptions}
                      placeholder={t('purchaseOrders.selectSupplier')}
                      ariaLabel={t('purchaseOrders.supplier')}
                    />
                  )}
                />
                {errors.supplierId ? <div className="text-[12px] font-normal text-danger">{errors.supplierId.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="po-warehouse">{t('fields.warehouse')} *</label>
                <Select id="po-warehouse" className="w-full" {...register('warehouseId')}>
                  <option value="">{t('purchaseOrders.selectWarehouse')}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </Select>
                {errors.warehouseId ? <div className="text-[12px] font-normal text-danger">{errors.warehouseId.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="po-expected">{t('purchaseOrders.expectedAt')}</label>
                <Input id="po-expected" type="date" className="w-full" {...register('expectedAt')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="po-discount">{t('fields.discount')}</label>
                <Input id="po-discount" type="number" min="0" step="0.01" className="w-full" {...register('discount')} />
                {errors.discount ? <div className="text-[12px] font-normal text-danger">{errors.discount.message}</div> : null}
              </div>
            </div>
            <div className="mb-3 rounded-ui border border-border p-3">
              {items.map((_, index) => (
                <div className="grid grid-cols-[3fr_1fr_1.5fr_1fr_auto] items-start gap-2.5" key={index}>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`po-item-product-${index}`}>{t('fields.product')}</label>
                    <Controller
                      control={control}
                      name={`items.${index}.productId`}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={productOptions}
                          placeholder={t('purchaseOrders.selectProduct')}
                          ariaLabel={t('fields.product')}
                        />
                      )}
                    />
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`po-item-qty-${index}`}>{t('fields.qty')}</label>
                    <Input
                      id={`po-item-qty-${index}`}
                      type="number"
                      min="0.0001"
                      step="any"
                      className="w-full"
                      {...register(`items.${index}.quantity`)}
                    />
                    {errors.items?.[index]?.quantity ? (
                      <div className="text-[12px] font-normal text-danger">{errors.items[index]?.quantity?.message}</div>
                    ) : null}
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`po-item-cost-${index}`}>{t('fields.unitCost')}</label>
                    <Input
                      id={`po-item-cost-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t('purchaseOrders.purchasePricePlaceholder')}
                      className="w-full"
                      {...register(`items.${index}.unitCost`)}
                    />
                    {errors.items?.[index]?.unitCost ? (
                      <div className="text-[12px] font-normal text-danger">{errors.items[index]?.unitCost?.message}</div>
                    ) : null}
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`po-item-tax-${index}`}>{t('fields.taxRate')} %</label>
                    <Input
                      id={`po-item-tax-${index}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder={t('purchaseOrders.taxPlaceholder')}
                      className="w-full"
                      {...register(`items.${index}.taxRate`)}
                    />
                    {errors.items?.[index]?.taxRate ? (
                      <div className="text-[12px] font-normal text-danger">{errors.items[index]?.taxRate?.message}</div>
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
              <label htmlFor="po-notes">{t('fields.notes')}</label>
              <Textarea id="po-notes" rows={2} className="w-full" {...register('notes')} />
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('common.saving') : t('purchaseOrders.createOrder')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiving !== null}
        onOpenChange={(open) => !receiveBusy && !open && setReceiving(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('purchaseOrders.receiveTitle', { number: receiving?.number ?? '' })} />
          <form onSubmit={(event) => void submitReceive(event)}>
            {receiving ? (
              <div className="mb-3 rounded-ui border border-border p-3">
                {receiving.items.map((item: PurchaseOrderItem, index) => {
                  const maxReceive = Math.max(0, item.quantity - item.receivedQuantity);
                  return (
                    <div className="grid grid-cols-[3fr_1fr_1.5fr_1fr_auto] items-start gap-2.5" key={item.id}>
                      <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                        <label>{t('fields.product')}</label>
                        <Input value={item.description ?? item.productId} readOnly className="w-full" />
                      </div>
                      <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                        <label>{t('purchaseOrders.ordered')}</label>
                        <Input value={String(item.quantity)} readOnly className="w-full" />
                      </div>
                      <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                        <label>{t('purchaseOrders.received')}</label>
                        <Input value={String(item.receivedQuantity)} readOnly className="w-full" />
                      </div>
                      <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                        <label htmlFor={`receive-qty-${item.id}`}>{t('purchaseOrders.toReceive')}</label>
                        <Input
                          id={`receive-qty-${item.id}`}
                          type="number"
                          min="0"
                          max={maxReceive}
                          step="any"
                          className="w-full"
                          {...receiveRegister(`items.${index}.quantity`)}
                        />
                      </div>
                      <div className="pt-6" />
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="receive-notes">{t('fields.notes')}</label>
              <Textarea id="receive-notes" rows={2} className="w-full" {...receiveRegister('notes')} />
            </div>
            {receiveError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{receiveError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={receiveBusy || !receiving} loading={receiveBusy || !receiving}>
                {receiveBusy ? t('purchaseOrders.receiving') : t('purchaseOrders.recordReceipt')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
