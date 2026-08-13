import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
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
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

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
  const [page, setPage] = useState(1);
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
    message: string;
  } | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const { data, error } = usePagedQuery<PurchaseOrder>({
    path: '/api/v1/purchasing/purchase-orders',
    page,
    query,
    extraParams: { status: statusFilter },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: emptyForm,
  });

  const items = watch('items');

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
        toast.toast(statusAction.message);
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
      setFormError('Add at least one line item.');
      return;
    }
    createMutation.mutate(body, {
      onSuccess: () => {
        toast.toast('Purchase order created.');
        setCreateOpen(false);
        void invalidate(['paged', '/api/v1/purchasing/purchase-orders']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  const runAction = (id: string, action: 'approve' | 'cancel', message: string) => {
    setStatusAction({ id, action, message });
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
      setReceiveError(err instanceof ApiError ? err.message : 'Could not load purchase order.');
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
      setReceiveError('Enter at least one quantity to receive.');
      return;
    }
    receiveMutation.mutate(
      { notes: values.notes.trim() || undefined, items: itemsDto },
      {
        onSuccess: () => {
          toast.toast('Goods receipt recorded.');
          setReceiving(null);
          void invalidate(['paged', '/api/v1/purchasing/purchase-orders']);
        },
        onError: (err) => setReceiveError(err.message),
      },
    );
  });

  const columns: Column<PurchaseOrder>[] = [
    { key: 'number', header: 'Number' },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (row) => row.supplier?.tradeName ?? '—',
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row) => row.warehouse?.name ?? '—',
    },
    {
      key: 'issueDate',
      header: 'Issue date',
      render: (row) => formatDate(row.issueDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => formatMoney(row.total),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'draft' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => runAction(row.id, 'approve', 'Purchase order approved.')}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => runAction(row.id, 'cancel', 'Purchase order cancelled.')}
              >
                Cancel
              </Button>
            </>
          ) : null}
          {row.status === 'approved' ? (
            <Button variant="ghost" size="sm" onClick={() => void openReceive(row)}>
              Receive
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="Procurement"
        action={<Button onClick={openCreate}>New purchase order</Button>}
      />
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by number…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No purchase orders." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title="New purchase order" />
          <form onSubmit={(event) => void submitCreate(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="po-supplier">Supplier *</label>
                <select id="po-supplier" {...register('supplierId')}>
                  <option value="">— Select supplier —</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.tradeName}
                    </option>
                  ))}
                </select>
                {errors.supplierId ? <div className="field-error">{errors.supplierId.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="po-warehouse">Warehouse *</label>
                <select id="po-warehouse" {...register('warehouseId')}>
                  <option value="">— Select warehouse —</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                {errors.warehouseId ? <div className="field-error">{errors.warehouseId.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="po-expected">Expected at</label>
                <input id="po-expected" type="date" {...register('expectedAt')} />
              </div>
              <div className="field">
                <label htmlFor="po-discount">Discount</label>
                <input id="po-discount" type="number" min="0" step="0.01" {...register('discount')} />
                {errors.discount ? <div className="field-error">{errors.discount.message}</div> : null}
              </div>
            </div>
            <div className="invoice-items">
              {items.map((_, index) => (
                <div className="invoice-item" key={index}>
                  <div className="field">
                    <label htmlFor={`po-item-product-${index}`}>Product</label>
                    <select id={`po-item-product-${index}`} {...register(`items.${index}.productId`)}>
                      <option value="">— Select product —</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`po-item-qty-${index}`}>Qty</label>
                    <input
                      id={`po-item-qty-${index}`}
                      type="number"
                      min="0.0001"
                      step="any"
                      {...register(`items.${index}.quantity`)}
                    />
                    {errors.items?.[index]?.quantity ? (
                      <div className="field-error">{errors.items[index]?.quantity?.message}</div>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor={`po-item-cost-${index}`}>Unit cost</label>
                    <input
                      id={`po-item-cost-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="purchase price"
                      {...register(`items.${index}.unitCost`)}
                    />
                    {errors.items?.[index]?.unitCost ? (
                      <div className="field-error">{errors.items[index]?.unitCost?.message}</div>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor={`po-item-tax-${index}`}>Tax %</label>
                    <input
                      id={`po-item-tax-${index}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 18"
                      {...register(`items.${index}.taxRate`)}
                    />
                    {errors.items?.[index]?.taxRate ? (
                      <div className="field-error">{errors.items[index]?.taxRate?.message}</div>
                    ) : null}
                  </div>
                  <div className="invoice-item-remove">
                    {items.length > 1 ? (
                      <Button variant="ghost" size="sm" type="button" onClick={() => removeItem(index)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addItem}>
              + Add line
            </Button>
            <div className="field">
              <label htmlFor="po-notes">Notes</label>
              <textarea id="po-notes" rows={2} {...register('notes')} />
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create purchase order'}
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
          <DialogHeader title={`Receive goods for ${receiving?.number ?? ''}`} />
          <form onSubmit={(event) => void submitReceive(event)}>
            {receiving ? (
              <div className="invoice-items">
                {receiving.items.map((item: PurchaseOrderItem, index) => {
                  const maxReceive = Math.max(0, item.quantity - item.receivedQuantity);
                  return (
                    <div className="invoice-item" key={item.id}>
                      <div className="field">
                        <label>Product</label>
                        <input value={item.description ?? item.productId} readOnly />
                      </div>
                      <div className="field">
                        <label>Ordered</label>
                        <input value={String(item.quantity)} readOnly />
                      </div>
                      <div className="field">
                        <label>Received</label>
                        <input value={String(item.receivedQuantity)} readOnly />
                      </div>
                      <div className="field">
                        <label htmlFor={`receive-qty-${item.id}`}>To receive</label>
                        <input
                          id={`receive-qty-${item.id}`}
                          type="number"
                          min="0"
                          max={maxReceive}
                          step="any"
                          {...receiveRegister(`items.${index}.quantity`)}
                        />
                      </div>
                      <div className="invoice-item-remove" />
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="receive-notes">Notes</label>
              <textarea id="receive-notes" rows={2} {...receiveRegister('notes')} />
            </div>
            {receiveError ? <div className="error-banner">{receiveError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={receiveBusy || !receiving}>
                {receiveBusy ? 'Receiving…' : 'Record receipt'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
