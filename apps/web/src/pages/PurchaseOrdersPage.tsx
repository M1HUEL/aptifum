import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
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

function statusTone(status: PurchaseOrderStatus): BadgeTone {
  if (status === 'received') return 'success';
  if (status === 'approved') return 'info';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

interface PoItemForm {
  productId: string;
  quantity: string;
  unitCost: string;
  taxRate: string;
}

interface PoForm {
  supplierId: string;
  warehouseId: string;
  expectedAt: string;
  discount: string;
  notes: string;
  items: PoItemForm[];
}

const emptyItem: PoItemForm = { productId: '', quantity: '1', unitCost: '', taxRate: '' };

interface ReceiveItem {
  orderItemId: string;
  quantity: string;
}

export function PurchaseOrdersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<PoForm>({
    supplierId: '',
    warehouseId: '',
    expectedAt: '',
    discount: '',
    notes: '',
    items: [emptyItem],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveBusy, setReceiveBusy] = useState(false);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<PurchaseOrder>({
    path: '/api/v1/purchasing/purchase-orders',
    page,
    query,
    extraParams: { status: statusFilter },
  });

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

  const openCreate = () => {
    setForm({
      supplierId: '',
      warehouseId: '',
      expectedAt: '',
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

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  const setFormField = (key: keyof PoForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setItemField = (index: number, key: keyof PoItemForm, value: string) => {
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
    if (!form.supplierId || !form.warehouseId) {
      setFormError('Supplier and warehouse are required.');
      return;
    }
    const items = form.items
      .filter((item) => item.productId)
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitCost: item.unitCost === '' ? undefined : Number(item.unitCost),
        taxRate: item.taxRate === '' ? undefined : Number(item.taxRate),
      }));
    if (items.length === 0) {
      setFormError('Add at least one line item.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      supplierId: form.supplierId,
      warehouseId: form.warehouseId,
      expectedAt: form.expectedAt || undefined,
      discount: form.discount === '' ? undefined : Number(form.discount),
      notes: form.notes.trim() || undefined,
      items,
    };
    try {
      await apiFetch('/api/v1/purchasing/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Purchase order created.');
      setCreateOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create purchase order.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: 'approve' | 'cancel', message: string) => {
    try {
      await apiFetch(`/api/v1/purchasing/purchase-orders/${id}/${action}`, { method: 'POST' });
      toast.toast(message);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    }
  };

  const openReceive = async (order: PurchaseOrder) => {
    setReceiveError(null);
    setReceiveNotes('');
    setReceiving(order);
    setReceiveItems([]);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/api/v1/purchasing/purchase-orders/${order.id}`);
      setReceiveItems(
        detail.items.map((item) => ({
          orderItemId: item.id,
          quantity: String(Math.max(0, item.quantity - item.receivedQuantity)),
        })),
      );
      setReceiving(detail);
    } catch (err) {
      setReceiveError(err instanceof ApiError ? err.message : 'Could not load purchase order.');
    }
  };

  const closeReceive = () => {
    if (!receiveBusy) setReceiving(null);
  };

  const setReceiveItemQty = (orderItemId: string, value: string) => {
    setReceiveItems((current) =>
      current.map((item) => (item.orderItemId === orderItemId ? { ...item, quantity: value } : item)),
    );
  };

  const submitReceive = async (event: FormEvent) => {
    event.preventDefault();
    if (!receiving) return;
    const items = receiveItems
      .filter((item) => Number(item.quantity) > 0)
      .map((item) => ({ orderItemId: item.orderItemId, quantity: Number(item.quantity) }));
    if (items.length === 0) {
      setReceiveError('Enter at least one quantity to receive.');
      return;
    }
    setReceiveBusy(true);
    setReceiveError(null);
    const body = {
      notes: receiveNotes.trim() || undefined,
      items,
    };
    try {
      await apiFetch(`/api/v1/purchasing/purchase-orders/${receiving.id}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Goods receipt recorded.');
      setReceiving(null);
      void reload();
    } catch (err) {
      setReceiveError(err instanceof ApiError ? err.message : 'Could not record receipt.');
    } finally {
      setReceiveBusy(false);
    }
  };

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
                onClick={() => void runAction(row.id, 'approve', 'Purchase order approved.')}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void runAction(row.id, 'cancel', 'Purchase order cancelled.')}
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
        <Select
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
        </Select>
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

      <Modal open={createOpen} title="New purchase order" onClose={closeCreate} width="lg">
        <form onSubmit={(event) => void submitCreate(event)}>
          <div className="form-grid">
            <Field label="Supplier" htmlFor="po-supplier" required>
              <Select
                id="po-supplier"
                value={form.supplierId}
                onChange={(event) => setFormField('supplierId', event.target.value)}
              >
                <option value="">— Select supplier —</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.tradeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Warehouse" htmlFor="po-warehouse" required>
              <Select
                id="po-warehouse"
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
            <Field label="Expected at" htmlFor="po-expected">
              <TextInput
                id="po-expected"
                type="date"
                value={form.expectedAt}
                onChange={(event) => setFormField('expectedAt', event.target.value)}
              />
            </Field>
            <Field label="Discount" htmlFor="po-discount">
              <TextInput
                id="po-discount"
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
                <Field label="Product" htmlFor={`po-item-product-${index}`}>
                  <Select
                    id={`po-item-product-${index}`}
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
                <Field label="Qty" htmlFor={`po-item-qty-${index}`}>
                  <TextInput
                    id={`po-item-qty-${index}`}
                    type="number"
                    min="0.0001"
                    step="any"
                    value={item.quantity}
                    onChange={(event) => setItemField(index, 'quantity', event.target.value)}
                  />
                </Field>
                <Field label="Unit cost" htmlFor={`po-item-cost-${index}`}>
                  <TextInput
                    id={`po-item-cost-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="purchase price"
                    value={item.unitCost}
                    onChange={(event) => setItemField(index, 'unitCost', event.target.value)}
                  />
                </Field>
                <Field label="Tax %" htmlFor={`po-item-tax-${index}`}>
                  <TextInput
                    id={`po-item-tax-${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 18"
                    value={item.taxRate}
                    onChange={(event) => setItemField(index, 'taxRate', event.target.value)}
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
          <Field label="Notes" htmlFor="po-notes">
            <TextArea
              id="po-notes"
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
              {saving ? 'Creating…' : 'Create purchase order'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={receiving !== null}
        title={`Receive goods for ${receiving?.number ?? ''}`}
        onClose={closeReceive}
        width="lg"
      >
        <form onSubmit={(event) => void submitReceive(event)}>
          {receiving ? (
            <div className="invoice-items">
              {receiving.items.map((item: PurchaseOrderItem) => {
                const maxReceive = Math.max(0, item.quantity - item.receivedQuantity);
                return (
                  <div className="invoice-item" key={item.id}>
                    <Field label="Product">
                      <TextInput value={item.description ?? item.productId} readOnly />
                    </Field>
                    <Field label="Ordered">
                      <TextInput value={String(item.quantity)} readOnly />
                    </Field>
                    <Field label="Received">
                      <TextInput value={String(item.receivedQuantity)} readOnly />
                    </Field>
                    <Field label="To receive" htmlFor={`receive-qty-${item.id}`}>
                      <TextInput
                        id={`receive-qty-${item.id}`}
                        type="number"
                        min="0"
                        max={maxReceive}
                        step="any"
                        value={receiveItems.find((r) => r.orderItemId === item.id)?.quantity ?? '0'}
                        onChange={(event) => setReceiveItemQty(item.id, event.target.value)}
                      />
                    </Field>
                    <div className="invoice-item-remove" />
                  </div>
                );
              })}
            </div>
          ) : null}
          <Field label="Notes" htmlFor="receive-notes">
            <TextArea
              id="receive-notes"
              rows={2}
              value={receiveNotes}
              onChange={(event) => setReceiveNotes(event.target.value)}
            />
          </Field>
          {receiveError ? <div className="error-banner">{receiveError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeReceive} disabled={receiveBusy}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={receiveBusy || !receiving}>
              {receiveBusy ? 'Receiving…' : 'Record receipt'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
