import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
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
} from '../components/ui';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

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
  const [page, setPage] = useState(1);
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
    message: string;
  } | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const { data, error } = usePagedQuery<SalesOrder>({
    path: '/api/v1/sales/orders',
    page,
    query,
    extraParams: { kind: kindFilter, status: statusFilter },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: emptyForm,
  });

  const items = watch('items');

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
        toast.toast(statusAction.message);
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
        toast.toast(values.kind === 'quote' ? 'Quote created.' : 'Sales order created.');
        setCreateOpen(false);
        void invalidate(['paged', '/api/v1/sales/orders']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  const runAction = (id: string, action: 'confirm' | 'convert' | 'cancel', message: string) => {
    setStatusAction({ id, action, message });
  };

  const openView = async (order: SalesOrder) => {
    setViewing(order);
    setViewLoading(true);
    try {
      const detail = await apiFetch<SalesOrder>(`/api/v1/sales/orders/${order.id}`);
      setViewing(detail);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not load sales order.', 'error');
    } finally {
      setViewLoading(false);
    }
  };

  const columns: Column<SalesOrder>[] = [
    { key: 'number', header: 'Number' },
    {
      key: 'kind',
      header: 'Kind',
      render: (row) => <Badge tone={row.kind === 'order' ? 'info' : 'neutral'}>{row.kind}</Badge>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => row.customer?.tradeName ?? '—',
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
          <Button variant="ghost" size="sm" onClick={() => void openView(row)}>
            View
          </Button>
          {row.status === 'draft' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runAction(row.id, 'confirm', 'Sales order confirmed.')}
            >
              Confirm
            </Button>
          ) : null}
          {row.status === 'draft' && row.kind === 'quote' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runAction(row.id, 'convert', 'Quote converted to order.')}
            >
              Convert
            </Button>
          ) : null}
          {row.status !== 'invoiced' && row.status !== 'cancelled' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => runAction(row.id, 'cancel', 'Sales order cancelled.')}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales orders"
        subtitle="Quotes and orders"
        action={<Button onClick={openCreate}>New sales order</Button>}
      />
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by number…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <select
          value={kindFilter}
          onChange={(event) => {
            setKindFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All kinds</option>
          <option value="quote">Quote</option>
          <option value="order">Order</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="invoiced">Invoiced</option>
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
            <EmptyState message="No sales orders." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title="New sales order" />
          <form onSubmit={(event) => void submitCreate(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="so-kind">Kind *</label>
                <select id="so-kind" {...register('kind')}>
                  <option value="order">Order</option>
                  <option value="quote">Quote</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="so-customer">Customer *</label>
                <select id="so-customer" {...register('customerId')}>
                  <option value="">— Select customer —</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.tradeName}
                    </option>
                  ))}
                </select>
                {errors.customerId ? <div className="field-error">{errors.customerId.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="so-warehouse">Warehouse *</label>
                <select id="so-warehouse" {...register('warehouseId')}>
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
                <label htmlFor="so-issue">Issue date</label>
                <input id="so-issue" type="date" {...register('issueDate')} />
              </div>
              <div className="field">
                <label htmlFor="so-due">Due date</label>
                <input id="so-due" type="date" {...register('dueDate')} />
              </div>
              <div className="field">
                <label htmlFor="so-discount">Discount</label>
                <input id="so-discount" type="number" min="0" step="0.01" {...register('discount')} />
                {errors.discount ? <div className="field-error">{errors.discount.message}</div> : null}
              </div>
            </div>
            <div className="invoice-items">
              {items.map((_, index) => (
                <div className="invoice-item" key={index}>
                  <div className="field">
                    <label htmlFor={`so-item-product-${index}`}>Product</label>
                    <select id={`so-item-product-${index}`} {...register(`items.${index}.productId`)}>
                      <option value="">— Select product —</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`so-item-qty-${index}`}>Qty</label>
                    <input
                      id={`so-item-qty-${index}`}
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
                    <label htmlFor={`so-item-price-${index}`}>Unit price</label>
                    <input
                      id={`so-item-price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="sale price"
                      {...register(`items.${index}.unitPrice`)}
                    />
                    {errors.items?.[index]?.unitPrice ? (
                      <div className="field-error">{errors.items[index]?.unitPrice?.message}</div>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor={`so-item-tax-${index}`}>Tax %</label>
                    <input
                      id={`so-item-tax-${index}`}
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
                  <div className="field">
                    <label htmlFor={`so-item-discount-${index}`}>Discount</label>
                    <input
                      id={`so-item-discount-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      {...register(`items.${index}.discount`)}
                    />
                    {errors.items?.[index]?.discount ? (
                      <div className="field-error">{errors.items[index]?.discount?.message}</div>
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
              <label htmlFor="so-notes">Notes</label>
              <textarea id="so-notes" rows={2} {...register('notes')} />
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create sales order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={`Sales order ${viewing?.number ?? ''}`} />
          {viewLoading ? <LoadingBlock /> : null}
          {!viewLoading && viewing ? (
            <div>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">Kind</div>
                  <div className="detail-value">{viewing.kind}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">
                    <Badge tone={statusTone(viewing.status)}>{viewing.status}</Badge>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Customer</div>
                  <div className="detail-value">{viewing.customer?.tradeName ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Warehouse</div>
                  <div className="detail-value">{viewing.warehouse?.name ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Issue date</div>
                  <div className="detail-value">{formatDate(viewing.issueDate)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Due date</div>
                  <div className="detail-value">{viewing.dueDate ? formatDate(viewing.dueDate) : '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Subtotal</div>
                  <div className="detail-value num">{formatMoney(viewing.subtotal)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Discount</div>
                  <div className="detail-value num">{formatMoney(viewing.discount)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Tax</div>
                  <div className="detail-value num">{formatMoney(viewing.tax)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Total</div>
                  <div className="detail-value num">{formatMoney(viewing.total)}</div>
                </div>
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit price</th>
                      <th className="num">Tax</th>
                      <th className="num">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.description ?? item.product?.name ?? item.productId}</td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{formatMoney(item.unitPrice)}</td>
                        <td className="num">{formatMoney(item.taxAmount)}</td>
                        <td className="num">{formatMoney(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewing.notes ? <div className="detail-notes">{viewing.notes}</div> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
