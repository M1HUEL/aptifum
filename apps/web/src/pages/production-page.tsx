import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, ApiError } from '../api/client';
import type { components } from '../api/schema';
import type {
  Paginated,
  Product,
  ProductionBom,
  ProductionOrder,
  Warehouse,
} from '../api/types';
import {
  bomFormSchema,
  productionOrderFormSchema,
  type BomFormValues,
  type BomLineFormValues,
  type ProductionOrderFormValues,
} from '../api/schemas';
import { useApiInvalidation, useApiMutation, useApiMutationVoid } from '../api/hooks';
import {
  Badge,
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatMoney,
  formatNumber,
  LoadingBlock,
  PageHeader,
  Pagination,
  TableSkeleton,
} from '../components/ui';
import { Factory, ListTree } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { SearchableSelect } from '../components/ui/searchable-select';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';

type OrderStatus = ProductionOrder['status'];
type CreateBomDto = components['schemas']['CreateBomDto'];
type CreateBomLineDto = components['schemas']['BomLineInputDto'];
type CreateProductionOrderDto = components['schemas']['CreateProductionOrderDto'];
type PendingAction = 'start' | 'complete' | 'cancel';

const emptyBomLine: BomLineFormValues = { productId: '', quantity: '', wasteRate: '' };

const emptyBom: BomFormValues = {
  name: '',
  productId: '',
  outputQuantity: '1',
  active: true,
  lines: [emptyBomLine],
};

const emptyOrder: ProductionOrderFormValues = {
  productId: '',
  bomId: '',
  warehouseId: '',
  quantity: '',
  laborCost: '',
  overhead: '',
  notes: '',
};

function statusTone(status: OrderStatus): BadgeTone {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'info';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

function bomToDto(form: BomFormValues): CreateBomDto {
  const lines: CreateBomLineDto[] = form.lines
    .filter((line) => line.productId)
    .map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      wasteRate: line.wasteRate === '' ? undefined : Number(line.wasteRate),
    }));
  return {
    name: form.name.trim(),
    productId: form.productId,
    outputQuantity: form.outputQuantity === '' ? undefined : Number(form.outputQuantity),
    active: form.active,
    lines,
  };
}

function fromBom(bom: ProductionBom): BomFormValues {
  return {
    name: bom.name,
    productId: bom.productId,
    outputQuantity: String(bom.outputQuantity),
    active: bom.active,
    lines: bom.lines.map((line) => ({
      productId: line.productId,
      quantity: String(line.quantity),
      wasteRate: String(line.wasteRate),
    })),
  };
}

function orderToDto(form: ProductionOrderFormValues): CreateProductionOrderDto {
  return {
    productId: form.productId,
    bomId: form.bomId || undefined,
    quantity: Number(form.quantity),
    warehouseId: form.warehouseId,
    laborCost: form.laborCost === '' ? undefined : Number(form.laborCost),
    overhead: form.overhead === '' ? undefined : Number(form.overhead),
    notes: form.notes.trim() || undefined,
  };
}

function fromOrder(order: ProductionOrder): ProductionOrderFormValues {
  return {
    productId: order.productId,
    bomId: order.bomId ?? '',
    warehouseId: order.warehouseId,
    quantity: String(order.quantity),
    laborCost: order.laborCost ? String(order.laborCost) : '',
    overhead: order.overhead ? String(order.overhead) : '',
    notes: order.notes ?? '',
  };
}

export function ProductionPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'boms' | 'orders'>('boms');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bomsForSelect, setBomsForSelect] = useState<ProductionBom[]>([]);
  const [limit, setLimit] = useState(50);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    data: boms,
    error: bomsError,
  } = usePagedQuery<ProductionBom>({ path: '/api/v1/production/boms', page: 1, limit });

  const {
    data: orders,
    error: ordersError,
  } = usePagedQuery<ProductionOrder>({ path: '/api/v1/production/orders', page: 1, limit });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiFetch<Paginated<Product>>('/api/v1/inventory/products?page=1&limit=100'),
      apiFetch<Paginated<Warehouse>>('/api/v1/inventory/warehouses?page=1&limit=100'),
      apiFetch<Paginated<ProductionBom>>('/api/v1/production/boms?page=1&limit=100'),
    ])
      .then(([productResult, warehouseResult, bomResult]) => {
        if (cancelled) return;
        setProducts(productResult.data);
        setWarehouses(warehouseResult.data);
        setBomsForSelect(bomResult.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [bomOpen, setBomOpen] = useState(false);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [bomError, setBomError] = useState<string | null>(null);
  const [deletingBom, setDeletingBom] = useState<ProductionBom | null>(null);

  const [orderOpen, setOrderOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ProductionOrder | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const [action, setAction] = useState<{ kind: PendingAction; order: ProductionOrder } | null>(null);

  const bomForm = useForm<BomFormValues>({
    resolver: zodResolver(bomFormSchema),
    defaultValues: emptyBom,
  });
  const {
    register: registerBom,
    handleSubmit: submitBomForm,
    reset: resetBom,
    setValue: setBomValue,
    watch: watchBom,
    control: controlBom,
    formState: { errors: bomErrors },
  } = bomForm;

  const orderForm = useForm<ProductionOrderFormValues>({
    resolver: zodResolver(productionOrderFormSchema),
    defaultValues: emptyOrder,
  });
  const {
    register: registerOrder,
    handleSubmit: submitOrderForm,
    reset: resetOrder,
    setValue: setOrderValue,
    watch: watchOrder,
    control: controlOrder,
    formState: { errors: orderErrors },
  } = orderForm;

  const bomLines = watchBom('lines');
  const bomActive = watchBom('active');
  const orderProductId = watchOrder('productId');
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.sku} · ${product.name}`,
  }));

  const createBomMutation = useApiMutation<CreateBomDto>('/api/v1/production/boms', 'POST');
  const updateBomMutation = useApiMutation<CreateBomDto>(
    `/api/v1/production/boms/${editingBomId ?? ''}`,
    'PATCH',
  );
  const deleteBomMutation = useApiMutationVoid(`/api/v1/production/boms/${deletingBom?.id ?? ''}`, 'DELETE');

  const createOrderMutation = useApiMutation<CreateProductionOrderDto>('/api/v1/production/orders', 'POST');
  const updateOrderMutation = useApiMutation<CreateProductionOrderDto>(
    `/api/v1/production/orders/${editingOrderId ?? ''}`,
    'PATCH',
  );
  const actionMutation = useApiMutationVoid(
    action ? `/api/v1/production/orders/${action.order.id}/${action.kind}` : '/api/v1/production/orders',
    'POST',
  );

  const bomSaving = createBomMutation.isPending || updateBomMutation.isPending;
  const deleteBomBusy = deleteBomMutation.isPending;
  const orderSaving = createOrderMutation.isPending || updateOrderMutation.isPending;
  const actionBusy = actionMutation.isPending;

  const openBomCreate = () => {
    setEditingBomId(null);
    resetBom(emptyBom);
    setBomError(null);
    setBomOpen(true);
  };

  const openBomEdit = (bom: ProductionBom) => {
    setEditingBomId(bom.id);
    setBomError(null);
    resetBom({ ...fromBom(bom), lines: [] });
    setBomOpen(true);
    void apiFetch<ProductionBom>(`/api/v1/production/boms/${bom.id}`)
      .then((detail) => {
        setBomValue(
          'lines',
          detail.lines.map((line) => ({
            productId: line.productId,
            quantity: String(line.quantity),
            wasteRate: String(line.wasteRate),
          })),
        );
      })
      .catch(() => setBomValue('lines', []));
  };

  const setBomLine = (index: number, key: keyof BomLineFormValues, value: string) => {
    setBomValue('lines', bomLines.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const addBomLine = () => {
    setBomValue('lines', [...bomLines, { ...emptyBomLine }]);
  };

  const removeBomLine = (index: number) => {
    setBomValue('lines', bomLines.filter((_, i) => i !== index));
  };

  const submitBom = submitBomForm((values) => {
    const body = bomToDto(values);
    if (body.lines.length === 0) {
      setBomError(t('validation.addAtLeastOneComponent'));
      return;
    }
    setBomError(null);
    const onSuccess = () => {
      toast.toast(editingBomId ? t('production.bomUpdated') : t('production.bomCreated'));
      setBomOpen(false);
      void invalidate(['paged', '/api/v1/production/boms']);
    };
    const onError = (err: { message: string }) => setBomError(err.message);
    if (editingBomId) {
      updateBomMutation.mutate(body, { onSuccess, onError });
    } else {
      createBomMutation.mutate(body, { onSuccess, onError });
    }
  });

  const confirmDeleteBom = () => {
    if (!deletingBom) return;
    deleteBomMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t('production.bomDeleted'));
        setDeletingBom(null);
        void invalidate(['paged', '/api/v1/production/boms']);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeletingBom(null);
      },
    });
  };

  const openOrderCreate = () => {
    setEditingOrderId(null);
    resetOrder(emptyOrder);
    setOrderError(null);
    setOrderOpen(true);
  };

  const openOrderEdit = (order: ProductionOrder) => {
    setEditingOrderId(order.id);
    resetOrder(fromOrder(order));
    setOrderError(null);
    setOrderOpen(true);
  };

  const submitOrder = submitOrderForm((values) => {
    setOrderError(null);
    const onSuccess = () => {
      toast.toast(editingOrderId ? t('production.productionOrderUpdated') : t('production.productionOrderCreated'));
      setOrderOpen(false);
      void invalidate(['paged', '/api/v1/production/orders']);
    };
    const onError = (err: { message: string }) => setOrderError(err.message);
    if (editingOrderId) {
      updateOrderMutation.mutate(orderToDto(values), { onSuccess, onError });
    } else {
      createOrderMutation.mutate(orderToDto(values), { onSuccess, onError });
    }
  });

  const viewOrder = async (order: ProductionOrder) => {
    setViewBusy(true);
    try {
      const detail = await apiFetch<ProductionOrder>(`/api/v1/production/orders/${order.id}`);
      setViewing(detail);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : t('errors.couldNotLoadOrder'), 'error');
    } finally {
      setViewBusy(false);
    }
  };

  const runAction = () => {
    if (!action) return;
    const messageKeys: Record<PendingAction, string> = {
      start: 'production.productionOrderStarted',
      complete: 'production.productionOrderCompleted',
      cancel: 'production.productionOrderCancelled',
    };
    actionMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t(messageKeys[action.kind]));
        setAction(null);
        void invalidate(['paged', '/api/v1/production/orders']);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setAction(null);
      },
    });
  };

  const actionLabels: Record<PendingAction, { title: string; message: string; confirm: string }> = {
    start: {
      title: t('production.startTitle'),
      message: t('production.startMessage', { number: action?.order.number ?? '' }),
      confirm: t('production.start'),
    },
    complete: {
      title: t('production.completeTitle'),
      message: t('production.completeMessage'),
      confirm: t('production.complete'),
    },
    cancel: {
      title: t('production.cancelTitle'),
      message: t('production.cancelMessage', { number: action?.order.number ?? '' }),
      confirm: t('common.cancel'),
    },
  };

  const bomColumns: Column<ProductionBom>[] = [
    { key: 'name', header: t('fields.name') },
    {
      key: 'product',
      header: t('tables.finishedProduct'),
      render: (row) => `${row.product.sku} · ${row.product.name}`,
    },
    {
      key: 'outputQuantity',
      header: t('tables.outputQty'),
      render: (row) => formatNumber(row.outputQuantity),
    },
    {
      key: 'active',
      header: t('common.status'),
      render: (row) =>
        row.active ? (
          <Badge tone="success">{t('common.active')}</Badge>
        ) : (
          <Badge tone="neutral">{t('common.inactive')}</Badge>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => openBomEdit(row)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingBom(row)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  const orderColumns: Column<ProductionOrder>[] = [
    { key: 'number', header: t('tables.number') },
    { key: 'product', header: t('fields.product'), render: (row) => `${row.product.sku} · ${row.product.name}` },
    { key: 'quantity', header: t('fields.quantity'), render: (row) => formatNumber(row.quantity) },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => void viewOrder(row)} disabled={viewBusy}>
            {t('common.view')}
          </Button>
          {row.status === 'planned' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setAction({ kind: 'start', order: row })}>
                {t('production.start')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openOrderEdit(row)}>
                {t('common.edit')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setAction({ kind: 'cancel', order: row })}>
                {t('common.delete')}
              </Button>
            </>
          ) : null}
          {row.status === 'in_progress' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setAction({ kind: 'complete', order: row })}>
                {t('production.complete')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setAction({ kind: 'cancel', order: row })}>
                {t('common.cancel')}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const bomOptionsForProduct = bomsForSelect.filter(
    (bom) => bom.productId === orderProductId,
  );

  const handleLimitChange = (next: number) => {
    setLimit(next);
  };

  const handleExport = () => {
    if (tab === 'boms') {
      if (!boms || boms.data.length === 0) return;
      exportRowsToCsv({ filename: 'boms', columns: bomColumns, rows: boms.data });
    } else {
      if (!orders || orders.data.length === 0) return;
      exportRowsToCsv({ filename: 'production-orders', columns: orderColumns, rows: orders.data });
    }
  };

  return (
    <>
      <PageHeader
        title={t('production.title')}
        subtitle={t('production.subtitle')}
        action={
          <div className="flex justify-end gap-2">
            <button type="button" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </button>
            {tab === 'boms' ? (
              <Button onClick={openBomCreate}>{t('production.newBom')}</Button>
            ) : (
              <Button onClick={openOrderCreate}>{t('production.newProductionOrder')}</Button>
            )}
          </div>
        }
      />
      <div className="mb-4 flex gap-1">
        <button type="button" className={tab === 'boms' ? 'tab tab-active' : 'tab'} onClick={() => setTab('boms')}>
          {t('production.boms')}
        </button>
        <button
          type="button"
          className={tab === 'orders' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('orders')}
        >
          {t('production.orders')}
        </button>
      </div>
      {tab === 'boms' ? (
        <>
          {bomsError ? <ErrorBanner message={bomsError} /> : null}
          {!boms && !bomsError ? <TableSkeleton columns={bomColumns.length} /> : null}
          {boms ? (
            <>
              {boms.data.length === 0 ? (
                <EmptyState message={t('production.noBomsYet')} icon={<ListTree className="size-6" />} />
              ) : (
                <DataTable columns={bomColumns} rows={boms.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={boms.meta.page} limit={boms.meta.limit} total={boms.meta.total} onPage={() => {}} onLimit={handleLimitChange} />
            </>
          ) : null}
        </>
      ) : (
        <>
          {ordersError ? <ErrorBanner message={ordersError} /> : null}
          {!orders && !ordersError ? <TableSkeleton columns={orderColumns.length} /> : null}
          {orders ? (
            <>
              {orders.data.length === 0 ? (
                <EmptyState message={t('production.noProductionOrdersYet')} icon={<Factory className="size-6" />} />
              ) : (
                <DataTable columns={orderColumns} rows={orders.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={orders.meta.page} limit={orders.meta.limit} total={orders.meta.total} onPage={() => {}} onLimit={handleLimitChange} />
            </>
          ) : null}
        </>
      )}

      <Dialog open={bomOpen} onOpenChange={(open) => !bomSaving && setBomOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingBomId ? t('production.editBom') : t('production.newBomTitle')} />
          <form onSubmit={(event) => void submitBom(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="bom-name">{t('fields.name')} *</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="bom-name" {...registerBom('name')} />
                {bomErrors.name ? <div className="text-[12px] font-normal text-danger">{bomErrors.name.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="bom-product">{t('fields.finishedProduct')} *</label>
                <Controller
                  control={controlBom}
                  name="productId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={productOptions}
                      placeholder={t('production.selectProduct')}
                      ariaLabel={t('fields.finishedProduct')}
                    />
                  )}
                />
                {bomErrors.productId ? (
                  <div className="text-[12px] font-normal text-danger">{bomErrors.productId.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="bom-output">{t('fields.outputQuantity')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                  id="bom-output"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  {...registerBom('outputQuantity')}
                />
                {bomErrors.outputQuantity ? (
                  <div className="text-[12px] font-normal text-danger">{bomErrors.outputQuantity.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label>{t('common.status')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="bom-active"
                    checked={bomActive}
                    onCheckedChange={(checked) => setBomValue('active', checked === true)}
                  />
                  <label htmlFor="bom-active" className="text-sm text-gray-700">
                    {t('common.active')}
                  </label>
                </div>
              </div>
            </div>
            <div className="mb-2 mt-4 font-semibold">{t('production.componentLines')}</div>
            {bomLines.map((line, index) => (
              <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1 [grid-template-columns:3fr_1fr_1fr]" key={index}>
                <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                  <label htmlFor={`bomline-${index}-product`}>{t('production.component')}</label>
                  <SearchableSelect
                    value={line.productId}
                    onChange={(next) => setBomLine(index, 'productId', next)}
                    options={productOptions}
                    placeholder={t('production.selectProduct')}
                    ariaLabel={t('production.component')}
                  />
                </div>
                <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                  <label htmlFor={`bomline-${index}-qty`}>{t('fields.quantity')}</label>
                  <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                    id={`bomline-${index}-qty`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={line.quantity}
                    onChange={(event) => setBomLine(index, 'quantity', event.target.value)}
                  />
                </div>
                <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                  <label htmlFor={`bomline-${index}-waste`}>{t('fields.wasteRate')} (%)</label>
                  <div className="flex items-center gap-1.5">
                    <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                      id={`bomline-${index}-waste`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={line.wasteRate}
                      onChange={(event) => setBomLine(index, 'wasteRate', event.target.value)}
                    />
                    <Button variant="ghost" size="sm" type="button" onClick={() => removeBomLine(index)}>
                      {t('common.remove')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" type="button" onClick={addBomLine}>
              {t('common.addLine')}
            </Button>
            {bomError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{bomError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={bomSaving}>
                {bomSaving ? t('common.saving') : editingBomId ? t('common.saveChanges') : t('production.createBom')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={orderOpen} onOpenChange={(open) => !orderSaving && setOrderOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingOrderId ? t('production.editProductionOrder') : t('production.newProductionOrderTitle')} />
          <form onSubmit={(event) => void submitOrder(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="order-product">{t('fields.product')} *</label>
                <Controller
                  control={controlOrder}
                  name="productId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={(next) => {
                        field.onChange(next);
                        setOrderValue('bomId', '');
                      }}
                      options={productOptions}
                      placeholder={t('production.selectProduct')}
                      ariaLabel={t('fields.product')}
                    />
                  )}
                />
                {orderErrors.productId ? (
                  <div className="text-[12px] font-normal text-danger">{orderErrors.productId.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="order-bom">{t('production.bom')}</label>
                <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="order-bom" {...registerOrder('bomId')} disabled={!orderProductId}>
                  <option value="">{t('production.noneNoBom')}</option>
                  {bomOptionsForProduct.map((bom) => (
                    <option key={bom.id} value={bom.id}>
                      {bom.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="order-warehouse">{t('fields.warehouse')} *</label>
                <select className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="order-warehouse" {...registerOrder('warehouseId')}>
                  <option value="">{t('production.selectWarehouse')}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} · {warehouse.name}
                    </option>
                  ))}
                </select>
                {orderErrors.warehouseId ? (
                  <div className="text-[12px] font-normal text-danger">{orderErrors.warehouseId.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="order-quantity">{t('fields.quantity')} *</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                  id="order-quantity"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  {...registerOrder('quantity')}
                />
                {orderErrors.quantity ? (
                  <div className="text-[12px] font-normal text-danger">{orderErrors.quantity.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="order-labor">{t('fields.laborCost')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="order-labor" type="number" min="0" step="0.01" {...registerOrder('laborCost')} />
                {orderErrors.laborCost ? (
                  <div className="text-[12px] font-normal text-danger">{orderErrors.laborCost.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="order-overhead">{t('fields.overhead')}</label>
                <input className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="order-overhead" type="number" min="0" step="0.01" {...registerOrder('overhead')} />
                {orderErrors.overhead ? (
                  <div className="text-[12px] font-normal text-danger">{orderErrors.overhead.message}</div>
                ) : null}
              </div>
              <div className="col-span-2 mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="order-notes">{t('fields.notes')}</label>
                <textarea className="w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" id="order-notes" rows={3} {...registerOrder('notes')} />
              </div>
            </div>
            {orderError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{orderError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={orderSaving}>
                {orderSaving ? t('common.saving') : editingOrderId ? t('common.saveChanges') : t('production.createOrder')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('production.order', { number: viewing?.number ?? '' })} />
          {viewing ? (
            <>
              <div className="mb-2 grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1 gap-y-3">
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.product')}</span>
                  <span className="mt-0.5 block">
                    {viewing.product.sku} · {viewing.product.name}
                  </span>
                </div>
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('production.bom')}</span>
                  <span className="mt-0.5 block">{viewing.bom?.name ?? '—'}</span>
                </div>
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.warehouse')}</span>
                  <span className="mt-0.5 block">
                    {viewing.warehouse ? `${viewing.warehouse.code} · ${viewing.warehouse.name}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.quantity')}</span>
                  <span className="mt-0.5 block">{formatNumber(viewing.quantity)}</span>
                </div>
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('common.status')}</span>
                  <span className="mt-0.5 block">
                    <Badge tone={statusTone(viewing.status)}>{viewing.status}</Badge>
                  </span>
                </div>
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('tables.materialCost')}</span>
                  <span className="mt-0.5 block">{formatMoney(viewing.materialCost)}</span>
                </div>
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('tables.laborOverhead')}</span>
                  <span className="mt-0.5 block">{formatMoney(viewing.laborCost + viewing.overhead)}</span>
                </div>
                <div>
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('tables.totalCost')}</span>
                  <span className="mt-0.5 block">{formatMoney(viewing.totalCost)}</span>
                </div>
              </div>
              {viewing.notes ? (
                <p className="mt-2">
                  <span className="block text-[12px] uppercase tracking-[0.03em] text-muted">{t('fields.notes')}</span>
                  {viewing.notes}
                </p>
              ) : null}
              {viewing.lines.length > 0 ? (
                <>
                  <div className="mb-2 mt-4 font-semibold">{t('production.consumedMaterials')}</div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th>{t('fields.product')}</th>
                        <th className="text-right tabular-nums">{t('tables.planned')}</th>
                        <th className="text-right tabular-nums">{t('tables.consumed')}</th>
                        <th className="text-right tabular-nums">{t('fields.unitCost')}</th>
                        <th className="text-right tabular-nums">{t('tables.lineCost')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewing.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {line.product.sku} · {line.product.name}
                          </td>
                          <td className="text-right tabular-nums">{formatNumber(line.plannedQuantity)}</td>
                          <td className="text-right tabular-nums">{formatNumber(line.consumedQuantity)}</td>
                          <td className="text-right tabular-nums">{formatMoney(line.unitCost)}</td>
                          <td className="text-right tabular-nums">{formatMoney(line.lineCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3.5">
                <Button variant="ghost" onClick={() => setViewing(null)}>
                  {t('common.close')}
                </Button>
              </div>
            </>
          ) : (
            <LoadingBlock />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => !actionBusy && !open && setAction(null)}
      >
        <DialogContent>
          <DialogHeader
            title={action ? actionLabels[action.kind].title : ''}
            description={action ? actionLabels[action.kind].message : ''}
          />
          <DialogFooter>
            <Button
              variant={action?.kind === 'cancel' ? 'danger' : 'default'}
              type="button"
              disabled={actionBusy}
              onClick={() => void runAction()}
            >
              {actionBusy ? t('common.working') : action ? actionLabels[action.kind].confirm : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingBom !== null}
        onOpenChange={(open) => !deleteBomBusy && !open && setDeletingBom(null)}
      >
        <DialogContent>
          <DialogHeader
            title={t('production.deleteBomTitle')}
            description={t('production.deleteBomMessage', { name: deletingBom?.name ?? '' })}
          />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deleteBomBusy} onClick={() => void confirmDeleteBom()}>
              {deleteBomBusy ? t('common.working') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
