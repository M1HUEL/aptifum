import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
} from '../components/ui';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

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
  const [tab, setTab] = useState<'boms' | 'orders'>('boms');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bomsForSelect, setBomsForSelect] = useState<ProductionBom[]>([]);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    data: boms,
    error: bomsError,
  } = usePagedQuery<ProductionBom>({ path: '/api/v1/production/boms', page: 1, limit: 50 });

  const {
    data: orders,
    error: ordersError,
  } = usePagedQuery<ProductionOrder>({ path: '/api/v1/production/orders', page: 1, limit: 50 });

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
    formState: { errors: orderErrors },
  } = orderForm;

  const bomLines = watchBom('lines');
  const bomActive = watchBom('active');
  const orderProductId = watchOrder('productId');

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
      setBomError('Add at least one component product.');
      return;
    }
    setBomError(null);
    const onSuccess = () => {
      toast.toast(editingBomId ? 'BOM updated.' : 'BOM created.');
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
        toast.toast('BOM deleted.');
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
      toast.toast(editingOrderId ? 'Production order updated.' : 'Production order created.');
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
      toast.toast(err instanceof ApiError ? err.message : 'Could not load order.', 'error');
    } finally {
      setViewBusy(false);
    }
  };

  const runAction = () => {
    if (!action) return;
    const messages: Record<PendingAction, string> = {
      start: 'Production order started.',
      complete: 'Production order completed.',
      cancel: 'Production order cancelled.',
    };
    actionMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(messages[action.kind]);
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
      title: 'Start production order',
      message: `Start order ${action?.order.number ?? ''}? The order will move to "in progress".`,
      confirm: 'Start',
    },
    complete: {
      title: 'Complete production order',
      message:
        'This consumes component stock and receives finished goods, and posts a journal entry. This cannot be undone.',
      confirm: 'Complete',
    },
    cancel: {
      title: 'Cancel production order',
      message: `Cancel order ${action?.order.number ?? ''}?`,
      confirm: 'Cancel',
    },
  };

  const bomColumns: Column<ProductionBom>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'product',
      header: 'Finished product',
      render: (row) => `${row.product.sku} · ${row.product.name}`,
    },
    {
      key: 'outputQuantity',
      header: 'Output qty',
      render: (row) => formatNumber(row.outputQuantity),
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) =>
        row.active ? <Badge tone="success">active</Badge> : <Badge tone="neutral">inactive</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openBomEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingBom(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const orderColumns: Column<ProductionOrder>[] = [
    { key: 'number', header: 'Number' },
    { key: 'product', header: 'Product', render: (row) => `${row.product.sku} · ${row.product.name}` },
    { key: 'quantity', header: 'Quantity', render: (row) => formatNumber(row.quantity) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => void viewOrder(row)} disabled={viewBusy}>
            View
          </Button>
          {row.status === 'planned' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setAction({ kind: 'start', order: row })}>
                Start
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openOrderEdit(row)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setAction({ kind: 'cancel', order: row })}>
                Delete
              </Button>
            </>
          ) : null}
          {row.status === 'in_progress' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setAction({ kind: 'complete', order: row })}>
                Complete
              </Button>
              <Button variant="danger" size="sm" onClick={() => setAction({ kind: 'cancel', order: row })}>
                Cancel
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

  return (
    <>
      <PageHeader
        title="Production"
        subtitle="BOMs and production orders"
        action={
          tab === 'boms' ? (
            <Button onClick={openBomCreate}>New BOM</Button>
          ) : (
            <Button onClick={openOrderCreate}>New production order</Button>
          )
        }
      />
      <div className="tabs">
        <button type="button" className={tab === 'boms' ? 'tab tab-active' : 'tab'} onClick={() => setTab('boms')}>
          BOMs
        </button>
        <button
          type="button"
          className={tab === 'orders' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('orders')}
        >
          Orders
        </button>
      </div>
      {tab === 'boms' ? (
        <>
          {bomsError ? <ErrorBanner message={bomsError} /> : null}
          {!boms && !bomsError ? <LoadingBlock /> : null}
          {boms ? (
            <>
              {boms.data.length === 0 ? (
                <EmptyState message="No BOMs yet." />
              ) : (
                <DataTable columns={bomColumns} rows={boms.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={boms.meta.page} limit={boms.meta.limit} total={boms.meta.total} onPage={() => {}} />
            </>
          ) : null}
        </>
      ) : (
        <>
          {ordersError ? <ErrorBanner message={ordersError} /> : null}
          {!orders && !ordersError ? <LoadingBlock /> : null}
          {orders ? (
            <>
              {orders.data.length === 0 ? (
                <EmptyState message="No production orders yet." />
              ) : (
                <DataTable columns={orderColumns} rows={orders.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={orders.meta.page} limit={orders.meta.limit} total={orders.meta.total} onPage={() => {}} />
            </>
          ) : null}
        </>
      )}

      <Dialog open={bomOpen} onOpenChange={(open) => !bomSaving && setBomOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingBomId ? 'Edit BOM' : 'New BOM'} />
          <form onSubmit={(event) => void submitBom(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="bom-name">Name *</label>
                <input id="bom-name" {...registerBom('name')} />
                {bomErrors.name ? <div className="field-error">{bomErrors.name.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="bom-product">Finished product *</label>
                <select id="bom-product" {...registerBom('productId')}>
                  <option value="">— Select product —</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </select>
                {bomErrors.productId ? (
                  <div className="field-error">{bomErrors.productId.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="bom-output">Output quantity</label>
                <input
                  id="bom-output"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  {...registerBom('outputQuantity')}
                />
                {bomErrors.outputQuantity ? (
                  <div className="field-error">{bomErrors.outputQuantity.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="bom-active"
                    checked={bomActive}
                    onCheckedChange={(checked) => setBomValue('active', checked === true)}
                  />
                  <label htmlFor="bom-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="section-title">Component lines</div>
            {bomLines.map((line, index) => (
              <div className="form-grid form-grid-3" key={index}>
                <div className="field">
                  <label htmlFor={`bomline-${index}-product`}>Component</label>
                  <select
                    id={`bomline-${index}-product`}
                    value={line.productId}
                    onChange={(event) => setBomLine(index, 'productId', event.target.value)}
                  >
                    <option value="">— Select product —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`bomline-${index}-qty`}>Quantity</label>
                  <input
                    id={`bomline-${index}-qty`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={line.quantity}
                    onChange={(event) => setBomLine(index, 'quantity', event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`bomline-${index}-waste`}>Waste rate (%)</label>
                  <div className="inline-with-remove">
                    <input
                      id={`bomline-${index}-waste`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={line.wasteRate}
                      onChange={(event) => setBomLine(index, 'wasteRate', event.target.value)}
                    />
                    <Button variant="ghost" size="sm" type="button" onClick={() => removeBomLine(index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" type="button" onClick={addBomLine}>
              + Add line
            </Button>
            {bomError ? <div className="error-banner">{bomError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={bomSaving}>
                {bomSaving ? 'Saving…' : editingBomId ? 'Save changes' : 'Create BOM'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={orderOpen} onOpenChange={(open) => !orderSaving && setOrderOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingOrderId ? 'Edit production order' : 'New production order'} />
          <form onSubmit={(event) => void submitOrder(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="order-product">Product *</label>
                <select
                  id="order-product"
                  {...registerOrder('productId')}
                  onChange={(event) => {
                    void registerOrder('productId').onChange(event);
                    setOrderValue('bomId', '');
                  }}
                >
                  <option value="">— Select product —</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </select>
                {orderErrors.productId ? (
                  <div className="field-error">{orderErrors.productId.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="order-bom">BOM</label>
                <select id="order-bom" {...registerOrder('bomId')} disabled={!orderProductId}>
                  <option value="">— None (no BOM) —</option>
                  {bomOptionsForProduct.map((bom) => (
                    <option key={bom.id} value={bom.id}>
                      {bom.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="order-warehouse">Warehouse *</label>
                <select id="order-warehouse" {...registerOrder('warehouseId')}>
                  <option value="">— Select warehouse —</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} · {warehouse.name}
                    </option>
                  ))}
                </select>
                {orderErrors.warehouseId ? (
                  <div className="field-error">{orderErrors.warehouseId.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="order-quantity">Quantity *</label>
                <input
                  id="order-quantity"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  {...registerOrder('quantity')}
                />
                {orderErrors.quantity ? (
                  <div className="field-error">{orderErrors.quantity.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="order-labor">Labor cost</label>
                <input id="order-labor" type="number" min="0" step="0.01" {...registerOrder('laborCost')} />
                {orderErrors.laborCost ? (
                  <div className="field-error">{orderErrors.laborCost.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="order-overhead">Overhead</label>
                <input id="order-overhead" type="number" min="0" step="0.01" {...registerOrder('overhead')} />
                {orderErrors.overhead ? (
                  <div className="field-error">{orderErrors.overhead.message}</div>
                ) : null}
              </div>
              <div className="field field-wide">
                <label htmlFor="order-notes">Notes</label>
                <textarea id="order-notes" rows={3} {...registerOrder('notes')} />
              </div>
            </div>
            {orderError ? <div className="error-banner">{orderError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={orderSaving}>
                {orderSaving ? 'Saving…' : editingOrderId ? 'Save changes' : 'Create order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={`Order ${viewing?.number ?? ''}`} />
          {viewing ? (
            <>
              <div className="detail-grid">
                <div>
                  <span className="detail-label">Product</span>
                  <span className="detail-value">
                    {viewing.product.sku} · {viewing.product.name}
                  </span>
                </div>
                <div>
                  <span className="detail-label">BOM</span>
                  <span className="detail-value">{viewing.bom?.name ?? '—'}</span>
                </div>
                <div>
                  <span className="detail-label">Warehouse</span>
                  <span className="detail-value">
                    {viewing.warehouse ? `${viewing.warehouse.code} · ${viewing.warehouse.name}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Quantity</span>
                  <span className="detail-value">{formatNumber(viewing.quantity)}</span>
                </div>
                <div>
                  <span className="detail-label">Status</span>
                  <span className="detail-value">
                    <Badge tone={statusTone(viewing.status)}>{viewing.status}</Badge>
                  </span>
                </div>
                <div>
                  <span className="detail-label">Material cost</span>
                  <span className="detail-value">{formatMoney(viewing.materialCost)}</span>
                </div>
                <div>
                  <span className="detail-label">Labor + overhead</span>
                  <span className="detail-value">{formatMoney(viewing.laborCost + viewing.overhead)}</span>
                </div>
                <div>
                  <span className="detail-label">Total cost</span>
                  <span className="detail-value">{formatMoney(viewing.totalCost)}</span>
                </div>
              </div>
              {viewing.notes ? (
                <p className="detail-notes">
                  <span className="detail-label">Notes</span>
                  {viewing.notes}
                </p>
              ) : null}
              {viewing.lines.length > 0 ? (
                <>
                  <div className="section-title">Consumed materials</div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="num">Planned</th>
                        <th className="num">Consumed</th>
                        <th className="num">Unit cost</th>
                        <th className="num">Line cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewing.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {line.product.sku} · {line.product.name}
                          </td>
                          <td className="num">{formatNumber(line.plannedQuantity)}</td>
                          <td className="num">{formatNumber(line.consumedQuantity)}</td>
                          <td className="num">{formatMoney(line.unitCost)}</td>
                          <td className="num">{formatMoney(line.lineCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
              <div className="modal-footer">
                <Button variant="ghost" onClick={() => setViewing(null)}>
                  Close
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
              {actionBusy ? 'Working…' : action ? actionLabels[action.kind].confirm : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingBom !== null}
        onOpenChange={(open) => !deleteBomBusy && !open && setDeletingBom(null)}
      >
        <DialogContent>
          <DialogHeader title="Delete BOM" description={`Delete BOM "${deletingBom?.name}"? This cannot be undone.`} />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deleteBomBusy} onClick={() => void confirmDeleteBom()}>
              {deleteBomBusy ? 'Working…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
