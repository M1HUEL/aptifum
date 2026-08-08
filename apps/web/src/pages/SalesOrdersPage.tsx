import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type {
  Customer,
  Paginated,
  Product,
  SalesOrder,
  SalesOrderStatus,
  Warehouse,
} from '../api/types';
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
import {
  Button,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/usePagedQuery';

function statusTone(status: SalesOrderStatus): BadgeTone {
  if (status === 'invoiced') return 'success';
  if (status === 'confirmed') return 'info';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

interface OrderItemForm {
  productId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  discount: string;
}

interface OrderForm {
  kind: string;
  customerId: string;
  warehouseId: string;
  issueDate: string;
  dueDate: string;
  discount: string;
  notes: string;
  items: OrderItemForm[];
}

const emptyItem: OrderItemForm = { productId: '', quantity: '1', unitPrice: '', taxRate: '', discount: '' };

export function SalesOrdersPage() {
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<OrderForm>({
    kind: 'order',
    customerId: '',
    warehouseId: '',
    issueDate: '',
    dueDate: '',
    discount: '',
    notes: '',
    items: [emptyItem],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<SalesOrder | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<SalesOrder>({
    path: '/api/v1/sales/orders',
    page,
  });

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

  const openCreate = () => {
    setForm({
      kind: 'order',
      customerId: '',
      warehouseId: '',
      issueDate: '',
      dueDate: '',
      discount: '',
      notes: '',
      items: [emptyItem],
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (!saving) setCreateOpen(false);
  };

  const setFormField = (key: keyof OrderForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setItemField = (index: number, key: keyof OrderItemForm, value: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };

  const addItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, emptyItem] }));
  };

  const removeItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.customerId || !form.warehouseId) {
      setFormError('Customer and warehouse are required.');
      return;
    }
    const items = form.items
      .filter((item) => item.productId)
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? undefined : Number(item.unitPrice),
        taxRate: item.taxRate === '' ? undefined : Number(item.taxRate),
        discount: item.discount === '' ? undefined : Number(item.discount),
      }));
    if (items.length === 0) {
      setFormError('Add at least one line item.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      kind: form.kind,
      customerId: form.customerId,
      warehouseId: form.warehouseId,
      issueDate: form.issueDate || undefined,
      dueDate: form.dueDate || undefined,
      discount: form.discount === '' ? undefined : Number(form.discount),
      notes: form.notes.trim() || undefined,
      items,
    };
    try {
      await apiFetch('/api/v1/sales/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast(form.kind === 'quote' ? 'Quote created.' : 'Sales order created.');
      setCreateOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create sales order.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: 'confirm' | 'convert' | 'cancel', message: string) => {
    try {
      await apiFetch(`/api/v1/sales/orders/${id}/${action}`, { method: 'POST' });
      toast.toast(message);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    }
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
              onClick={() => void runAction(row.id, 'confirm', 'Sales order confirmed.')}
            >
              Confirm
            </Button>
          ) : null}
          {row.status === 'draft' && row.kind === 'quote' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void runAction(row.id, 'convert', 'Quote converted to order.')}
            >
              Convert
            </Button>
          ) : null}
          {row.status !== 'invoiced' && row.status !== 'cancelled' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void runAction(row.id, 'cancel', 'Sales order cancelled.')}
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

      <Modal open={createOpen} title="New sales order" onClose={closeCreate} width="lg">
        <form onSubmit={(event) => void submitCreate(event)}>
          <div className="form-grid">
            <Field label="Kind" htmlFor="so-kind" required>
              <Select
                id="so-kind"
                value={form.kind}
                onChange={(event) => setFormField('kind', event.target.value)}
              >
                <option value="order">Order</option>
                <option value="quote">Quote</option>
              </Select>
            </Field>
            <Field label="Customer" htmlFor="so-customer" required>
              <Select
                id="so-customer"
                value={form.customerId}
                onChange={(event) => setFormField('customerId', event.target.value)}
              >
                <option value="">— Select customer —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Warehouse" htmlFor="so-warehouse" required>
              <Select
                id="so-warehouse"
                value={form.warehouseId}
                onChange={(event) => setFormField('warehouseId', event.target.value)}
              >
                <option value="">— Select warehouse —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Issue date" htmlFor="so-issue">
              <TextInput
                id="so-issue"
                type="date"
                value={form.issueDate}
                onChange={(event) => setFormField('issueDate', event.target.value)}
              />
            </Field>
            <Field label="Due date" htmlFor="so-due">
              <TextInput
                id="so-due"
                type="date"
                value={form.dueDate}
                onChange={(event) => setFormField('dueDate', event.target.value)}
              />
            </Field>
            <Field label="Discount" htmlFor="so-discount">
              <TextInput
                id="so-discount"
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(event) => setFormField('discount', event.target.value)}
              />
            </Field>
          </div>
          <div className="invoice-items">
            {form.items.map((item, index) => (
              <div className="invoice-item" key={index}>
                <Field label="Product" htmlFor={`so-item-product-${index}`}>
                  <Select
                    id={`so-item-product-${index}`}
                    value={item.productId}
                    onChange={(event) => setItemField(index, 'productId', event.target.value)}
                  >
                    <option value="">— Select product —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Qty" htmlFor={`so-item-qty-${index}`}>
                  <TextInput
                    id={`so-item-qty-${index}`}
                    type="number"
                    min="0.0001"
                    step="any"
                    value={item.quantity}
                    onChange={(event) => setItemField(index, 'quantity', event.target.value)}
                  />
                </Field>
                <Field label="Unit price" htmlFor={`so-item-price-${index}`}>
                  <TextInput
                    id={`so-item-price-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="sale price"
                    value={item.unitPrice}
                    onChange={(event) => setItemField(index, 'unitPrice', event.target.value)}
                  />
                </Field>
                <Field label="Tax %" htmlFor={`so-item-tax-${index}`}>
                  <TextInput
                    id={`so-item-tax-${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 18"
                    value={item.taxRate}
                    onChange={(event) => setItemField(index, 'taxRate', event.target.value)}
                  />
                </Field>
                <Field label="Discount" htmlFor={`so-item-discount-${index}`}>
                  <TextInput
                    id={`so-item-discount-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.discount}
                    onChange={(event) => setItemField(index, 'discount', event.target.value)}
                  />
                </Field>
                <div className="invoice-item-remove">
                  {form.items.length > 1 ? (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={addItem}>
            + Add line
          </Button>
          <Field label="Notes" htmlFor="so-notes">
            <TextArea
              id="so-notes"
              rows={2}
              value={form.notes}
              onChange={(event) => setFormField('notes', event.target.value)}
            />
          </Field>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeCreate} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create sales order'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={viewing !== null} title={`Sales order ${viewing?.number ?? ''}`} onClose={() => setViewing(null)} width="lg">
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
        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setViewing(null)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
