import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type {
  Paginated,
  Product,
  ProductionBom,
  ProductionOrder,
  Warehouse,
} from '../api/types';
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
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/usePagedQuery';

type OrderStatus = ProductionOrder['status'];

function statusTone(status: OrderStatus): BadgeTone {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'info';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

interface BomLineForm {
  productId: string;
  quantity: string;
  wasteRate: string;
}

interface BomForm {
  name: string;
  productId: string;
  outputQuantity: string;
  active: boolean;
}

const emptyBom: BomForm = { name: '', productId: '', outputQuantity: '1', active: true };

interface OrderForm {
  productId: string;
  bomId: string;
  warehouseId: string;
  quantity: string;
  laborCost: string;
  overhead: string;
  notes: string;
}

const emptyOrder: OrderForm = {
  productId: '',
  bomId: '',
  warehouseId: '',
  quantity: '',
  laborCost: '',
  overhead: '',
  notes: '',
};

type PendingAction = 'start' | 'complete' | 'cancel';

export function ProductionPage() {
  const [tab, setTab] = useState<'boms' | 'orders'>('boms');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bomsForSelect, setBomsForSelect] = useState<ProductionBom[]>([]);
  const toast = useToast();

  const {
    data: boms,
    error: bomsError,
    reload: reloadBoms,
  } = usePagedQuery<ProductionBom>({ path: '/api/v1/production/boms', page: 1, limit: 50 });

  const {
    data: orders,
    error: ordersError,
    reload: reloadOrders,
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
  const [bomForm, setBomForm] = useState<BomForm>(emptyBom);
  const [bomLines, setBomLines] = useState<BomLineForm[]>([]);
  const [bomError, setBomError] = useState<string | null>(null);
  const [bomSaving, setBomSaving] = useState(false);
  const [deletingBom, setDeletingBom] = useState<ProductionBom | null>(null);
  const [deleteBomBusy, setDeleteBomBusy] = useState(false);

  const [orderOpen, setOrderOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrder);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [viewing, setViewing] = useState<ProductionOrder | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const [action, setAction] = useState<{ kind: PendingAction; order: ProductionOrder } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const openBomCreate = () => {
    setEditingBomId(null);
    setBomForm(emptyBom);
    setBomLines([{ productId: '', quantity: '', wasteRate: '' }]);
    setBomError(null);
    setBomOpen(true);
  };

  const openBomEdit = async (bom: ProductionBom) => {
    setEditingBomId(bom.id);
    setBomForm({
      name: bom.name,
      productId: bom.productId,
      outputQuantity: String(bom.outputQuantity),
      active: bom.active,
    });
    setBomError(null);
    setBomOpen(true);
    try {
      const detail = await apiFetch<ProductionBom>(`/api/v1/production/boms/${bom.id}`);
      setBomLines(
        detail.lines.map((line) => ({
          productId: line.productId,
          quantity: String(line.quantity),
          wasteRate: String(line.wasteRate),
        })),
      );
    } catch {
      setBomLines([]);
    }
  };

  const closeBom = () => {
    if (!bomSaving) setBomOpen(false);
  };

  const setBomField = (key: keyof BomForm, value: string | boolean) => {
    setBomForm((current) => ({ ...current, [key]: value }));
  };

  const setBomLine = (index: number, key: keyof BomLineForm, value: string) => {
    setBomLines((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const addBomLine = () => {
    setBomLines((current) => [...current, { productId: '', quantity: '', wasteRate: '' }]);
  };

  const removeBomLine = (index: number) => {
    setBomLines((current) => current.filter((_, i) => i !== index));
  };

  const submitBom = async (event: FormEvent) => {
    event.preventDefault();
    if (!bomForm.name.trim() || !bomForm.productId) {
      setBomError('Name and finished product are required.');
      return;
    }
    const lines = bomLines
      .filter((line) => line.productId)
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        wasteRate: line.wasteRate === '' ? undefined : Number(line.wasteRate),
      }));
    if (lines.length === 0) {
      setBomError('Add at least one component product.');
      return;
    }
    setBomSaving(true);
    setBomError(null);
    const body = {
      name: bomForm.name.trim(),
      productId: bomForm.productId,
      outputQuantity: bomForm.outputQuantity === '' ? undefined : Number(bomForm.outputQuantity),
      active: bomForm.active,
      lines,
    };
    try {
      if (editingBomId) {
        await apiFetch(`/api/v1/production/boms/${editingBomId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('BOM updated.');
      } else {
        await apiFetch('/api/v1/production/boms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('BOM created.');
      }
      setBomOpen(false);
      reloadBoms();
    } catch (err) {
      setBomError(err instanceof ApiError ? err.message : 'Could not save BOM.');
    } finally {
      setBomSaving(false);
    }
  };

  const confirmDeleteBom = async () => {
    if (!deletingBom) return;
    setDeleteBomBusy(true);
    try {
      await apiFetch(`/api/v1/production/boms/${deletingBom.id}`, { method: 'DELETE' });
      toast.toast('BOM deleted.');
      setDeletingBom(null);
      reloadBoms();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete BOM.', 'error');
      setDeletingBom(null);
    } finally {
      setDeleteBomBusy(false);
    }
  };

  const openOrderCreate = () => {
    setEditingOrderId(null);
    setOrderForm(emptyOrder);
    setOrderError(null);
    setOrderOpen(true);
  };

  const openOrderEdit = (order: ProductionOrder) => {
    setEditingOrderId(order.id);
    setOrderForm({
      productId: order.productId,
      bomId: order.bomId ?? '',
      warehouseId: order.warehouseId,
      quantity: String(order.quantity),
      laborCost: order.laborCost ? String(order.laborCost) : '',
      overhead: order.overhead ? String(order.overhead) : '',
      notes: order.notes ?? '',
    });
    setOrderError(null);
    setOrderOpen(true);
  };

  const closeOrder = () => {
    if (!orderSaving) setOrderOpen(false);
  };

  const setOrderField = (key: keyof OrderForm, value: string) => {
    setOrderForm((current) => ({ ...current, [key]: value }));
  };

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!orderForm.productId || !orderForm.warehouseId || orderForm.quantity === '') {
      setOrderError('Product, warehouse and quantity are required.');
      return;
    }
    setOrderSaving(true);
    setOrderError(null);
    const body = {
      productId: orderForm.productId,
      bomId: orderForm.bomId || undefined,
      quantity: Number(orderForm.quantity),
      warehouseId: orderForm.warehouseId,
      laborCost: orderForm.laborCost === '' ? undefined : Number(orderForm.laborCost),
      overhead: orderForm.overhead === '' ? undefined : Number(orderForm.overhead),
      notes: orderForm.notes.trim() || undefined,
    };
    try {
      if (editingOrderId) {
        await apiFetch(`/api/v1/production/orders/${editingOrderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Production order updated.');
      } else {
        await apiFetch('/api/v1/production/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Production order created.');
      }
      setOrderOpen(false);
      reloadOrders();
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : 'Could not save production order.');
    } finally {
      setOrderSaving(false);
    }
  };

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

  const runAction = async () => {
    if (!action) return;
    setActionBusy(true);
    const { kind, order } = action;
    const messages: Record<PendingAction, string> = {
      start: 'Production order started.',
      complete: 'Production order completed.',
      cancel: 'Production order cancelled.',
    };
    try {
      await apiFetch(`/api/v1/production/orders/${order.id}/${kind}`, { method: 'POST' });
      toast.toast(messages[kind]);
      setAction(null);
      reloadOrders();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
      setAction(null);
    } finally {
      setActionBusy(false);
    }
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
          <Button variant="ghost" size="sm" onClick={() => void openBomEdit(row)}>
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
    (bom) => bom.productId === orderForm.productId,
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

      <Modal open={bomOpen} title={editingBomId ? 'Edit BOM' : 'New BOM'} onClose={closeBom} width="lg">
        <form onSubmit={(event) => void submitBom(event)}>
          <div className="form-grid">
            <Field label="Name" htmlFor="bom-name" required>
              <TextInput
                id="bom-name"
                value={bomForm.name}
                onChange={(event) => setBomField('name', event.target.value)}
              />
            </Field>
            <Field label="Finished product" htmlFor="bom-product" required>
              <Select
                id="bom-product"
                value={bomForm.productId}
                onChange={(event) => setBomField('productId', event.target.value)}
              >
                <option value="">— Select product —</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Output quantity" htmlFor="bom-output">
              <TextInput
                id="bom-output"
                type="number"
                min="0.0001"
                step="0.0001"
                value={bomForm.outputQuantity}
                onChange={(event) => setBomField('outputQuantity', event.target.value)}
              />
            </Field>
            <div className="form-check">
              <Checkbox
                label="Active"
                checked={bomForm.active}
                onChange={(event) => setBomField('active', event.target.checked)}
              />
            </div>
          </div>
          <div className="section-title">Component lines</div>
          {bomLines.map((line, index) => (
            <div className="form-grid form-grid-3" key={index}>
              <Field label="Component" htmlFor={`bomline-${index}-product`}>
                <Select
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
                </Select>
              </Field>
              <Field label="Quantity" htmlFor={`bomline-${index}-qty`}>
                <TextInput
                  id={`bomline-${index}-qty`}
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={line.quantity}
                  onChange={(event) => setBomLine(index, 'quantity', event.target.value)}
                />
              </Field>
              <Field label="Waste rate (%)" htmlFor={`bomline-${index}-waste`}>
                <div className="inline-with-remove">
                  <TextInput
                    id={`bomline-${index}-waste`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={line.wasteRate}
                    onChange={(event) => setBomLine(index, 'wasteRate', event.target.value)}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeBomLine(index)}>
                    Remove
                  </Button>
                </div>
              </Field>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addBomLine}>
            + Add line
          </Button>
          {bomError ? <div className="error-banner">{bomError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeBom} disabled={bomSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={bomSaving}>
              {bomSaving ? 'Saving…' : editingBomId ? 'Save changes' : 'Create BOM'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={orderOpen}
        title={editingOrderId ? 'Edit production order' : 'New production order'}
        onClose={closeOrder}
        width="lg"
      >
        <form onSubmit={(event) => void submitOrder(event)}>
          <div className="form-grid">
            <Field label="Product" htmlFor="order-product" required>
              <Select
                id="order-product"
                value={orderForm.productId}
                onChange={(event) => {
                  setOrderField('productId', event.target.value);
                  setOrderField('bomId', '');
                }}
              >
                <option value="">— Select product —</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="BOM" htmlFor="order-bom">
              <Select
                id="order-bom"
                value={orderForm.bomId}
                onChange={(event) => setOrderField('bomId', event.target.value)}
                disabled={!orderForm.productId}
              >
                <option value="">— None (no BOM) —</option>
                {bomOptionsForProduct.map((bom) => (
                  <option key={bom.id} value={bom.id}>
                    {bom.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Warehouse" htmlFor="order-warehouse" required>
              <Select
                id="order-warehouse"
                value={orderForm.warehouseId}
                onChange={(event) => setOrderField('warehouseId', event.target.value)}
              >
                <option value="">— Select warehouse —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} · {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="order-quantity" required>
              <TextInput
                id="order-quantity"
                type="number"
                min="0.0001"
                step="0.0001"
                value={orderForm.quantity}
                onChange={(event) => setOrderField('quantity', event.target.value)}
              />
            </Field>
            <Field label="Labor cost" htmlFor="order-labor">
              <TextInput
                id="order-labor"
                type="number"
                min="0"
                step="0.01"
                value={orderForm.laborCost}
                onChange={(event) => setOrderField('laborCost', event.target.value)}
              />
            </Field>
            <Field label="Overhead" htmlFor="order-overhead">
              <TextInput
                id="order-overhead"
                type="number"
                min="0"
                step="0.01"
                value={orderForm.overhead}
                onChange={(event) => setOrderField('overhead', event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="order-notes">
              <TextArea
                id="order-notes"
                rows={3}
                value={orderForm.notes}
                onChange={(event) => setOrderField('notes', event.target.value)}
              />
            </Field>
          </div>
          {orderError ? <div className="error-banner">{orderError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeOrder} disabled={orderSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={orderSaving}>
              {orderSaving ? 'Saving…' : editingOrderId ? 'Save changes' : 'Create order'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={viewing !== null} title={`Order ${viewing?.number ?? ''}`} onClose={() => setViewing(null)} width="lg">
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
      </Modal>

      <ConfirmDialog
        open={action !== null}
        title={action ? actionLabels[action.kind].title : ''}
        message={action ? actionLabels[action.kind].message : ''}
        confirmLabel={action ? actionLabels[action.kind].confirm : 'Confirm'}
        busy={actionBusy}
        onCancel={() => setAction(null)}
        onConfirm={() => void runAction()}
      />

      <ConfirmDialog
        open={deletingBom !== null}
        title="Delete BOM"
        message={`Delete BOM "${deletingBom?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleteBomBusy}
        onCancel={() => setDeletingBom(null)}
        onConfirm={() => void confirmDeleteBom()}
      />
    </>
  );
}
