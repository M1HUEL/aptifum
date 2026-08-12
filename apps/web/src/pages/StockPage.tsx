import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type {
  LotStatus,
  MovementType,
  Paginated,
  Product,
  ProductLot,
  ProductStock,
  StockMovement,
  Warehouse,
  WarehouseLocation,
} from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatNumber,
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

const movementTypes: MovementType[] = [
  'inbound',
  'outbound',
  'adjustment',
  'transfer',
  'return',
  'disposal',
];

function movementTone(type: MovementType): 'success' | 'danger' | 'info' {
  if (type === 'inbound' || type === 'return') return 'success';
  if (type === 'outbound' || type === 'disposal') return 'danger';
  return 'info';
}

const stockColumns: Column<ProductStock>[] = [
  {
    key: 'product',
    header: 'Product',
    render: (row) => `${row.product.sku} · ${row.product.name}`,
  },
  {
    key: 'warehouse',
    header: 'Warehouse',
    render: (row) => row.warehouse.name,
  },
  {
    key: 'quantity',
    header: 'On hand',
    render: (row) => (
      <Badge tone={row.quantity <= 10 ? 'warning' : 'success'}>{formatNumber(row.quantity)}</Badge>
    ),
  },
  {
    key: 'reservedQuantity',
    header: 'Reserved',
    render: (row) => formatNumber(row.reservedQuantity),
  },
  {
    key: 'averageCost',
    header: 'Avg cost',
    render: (row) => `$${row.averageCost.toFixed(2)}`,
  },
];

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function lotTone(status: LotStatus): 'success' | 'warning' | 'danger' {
  if (status === 'expired') return 'danger';
  if (status === 'expiring') return 'warning';
  return 'success';
}

const lotColumns: Column<ProductLot>[] = [
  {
    key: 'product',
    header: 'Product',
    render: (row) => `${row.product.sku} · ${row.product.name}`,
  },
  {
    key: 'variant',
    header: 'Variant',
    render: (row) => (row.variant ? Object.values(row.variant.attributes ?? {}).join(' · ') || row.variant.sku : '—'),
  },
  {
    key: 'lotNumber',
    header: 'Lot',
    render: (row) => row.lotNumber,
  },
  {
    key: 'warehouse',
    header: 'Warehouse',
    render: (row) => row.warehouse.name,
  },
  {
    key: 'expiryDate',
    header: 'Expiry',
    render: (row) => formatDate(row.expiryDate),
  },
  {
    key: 'quantity',
    header: 'Qty',
    render: (row) => formatNumber(row.quantity),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={lotTone(row.status)}>{row.status}</Badge>,
  },
];

const movementColumns: Column<StockMovement>[] = [
  {
    key: 'occurredAt',
    header: 'Date',
    render: (row) => formatDateTime(row.occurredAt),
  },
  {
    key: 'movementType',
    header: 'Type',
    render: (row) => <Badge tone={movementTone(row.movementType)}>{row.movementType}</Badge>,
  },
  {
    key: 'product',
    header: 'Product',
    render: (row) => `${row.product.sku} · ${row.product.name}`,
  },
  {
    key: 'warehouse',
    header: 'Warehouse',
    render: (row) => row.warehouse.name,
  },
  {
    key: 'quantity',
    header: 'Qty',
    render: (row) => formatNumber(row.quantity),
  },
  {
    key: 'unitCost',
    header: 'Unit cost',
    render: (row) => `$${row.unitCost.toFixed(2)}`,
  },
  { key: 'notes', header: 'Notes', render: (row) => row.notes ?? '—' },
];

function StockTab() {
  const [page, setPage] = useState(1);
  const { data, error } = usePagedQuery<ProductStock>({
    path: '/api/v1/inventory/stock',
    page,
  });

  return (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No stock records." />
          ) : (
            <DataTable columns={stockColumns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}

interface MovementFilters {
  warehouseId: string;
  movementType: string;
  from: string;
  to: string;
}

const emptyMovementFilters: MovementFilters = {
  warehouseId: '',
  movementType: '',
  from: '',
  to: '',
};

function MovementsTab({ warehouses }: { warehouses: Warehouse[] }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MovementFilters>(emptyMovementFilters);
  const extraParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filters.warehouseId) params.warehouseId = filters.warehouseId;
    if (filters.movementType) params.movementType = filters.movementType;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  }, [filters]);

  const { data, error } = usePagedQuery<StockMovement>({
    path: '/api/v1/inventory/movements',
    page,
    extraParams,
  });

  const setFilter = (key: keyof MovementFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(emptyMovementFilters);
    setPage(1);
  };

  const hasFilters = filters.warehouseId || filters.movementType || filters.from || filters.to;

  return (
    <>
      <div className="toolbar">
        <Select value={filters.movementType} onChange={(event) => setFilter('movementType', event.target.value)}>
          <option value="">All types</option>
          {movementTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <Select value={filters.warehouseId} onChange={(event) => setFilter('warehouseId', event.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
        <input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
        <input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
        {hasFilters ? (
          <Button variant="ghost" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No movements match the filters." />
          ) : (
            <DataTable columns={movementColumns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}

interface LotFilters {
  warehouseId: string;
  status: string;
}

const emptyLotFilters: LotFilters = {
  warehouseId: '',
  status: '',
};

function LotsTab({ warehouses }: { warehouses: Warehouse[] }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LotFilters>(emptyLotFilters);
  const extraParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filters.warehouseId) params.warehouseId = filters.warehouseId;
    if (filters.status) params.status = filters.status;
    return params;
  }, [filters]);

  const { data, error } = usePagedQuery<ProductLot>({
    path: '/api/v1/inventory/lots',
    page,
    extraParams,
  });

  const setFilter = (key: keyof LotFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(emptyLotFilters);
    setPage(1);
  };

  const hasFilters = filters.warehouseId || filters.status;

  return (
    <>
      <div className="toolbar">
        <Select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired</option>
        </Select>
        <Select value={filters.warehouseId} onChange={(event) => setFilter('warehouseId', event.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
        {hasFilters ? (
          <Button variant="ghost" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No lots match the filters." />
          ) : (
            <DataTable columns={lotColumns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}

interface MovementForm {
  productId: string;
  warehouseId: string;
  movementType: string;
  locationId: string;
  quantity: string;
  unitCost: string;
  lotNumber: string;
  expiryDate: string;
  notes: string;
}

const emptyForm: MovementForm = {
  productId: '',
  warehouseId: '',
  movementType: 'adjustment',
  locationId: '',
  quantity: '',
  unitCost: '',
  lotNumber: '',
  expiryDate: '',
  notes: '',
};

export function StockPage() {
  const [tab, setTab] = useState<'stock' | 'movements' | 'lots'>('stock');
  const [refreshKey, setRefreshKey] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<MovementForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [productStock, setProductStock] = useState<ProductStock[]>([]);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Paginated<Product>>('/api/v1/inventory/products?page=1&limit=100'),
      apiFetch<Paginated<Warehouse>>('/api/v1/inventory/warehouses?page=1&limit=100'),
    ])
      .then(([productsResult, warehousesResult]) => {
        if (cancelled) return;
        setProducts(productsResult.data);
        setWarehouses(warehousesResult.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.warehouseId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    apiFetch<WarehouseLocation[]>(`/api/v1/inventory/warehouses/${form.warehouseId}/locations`)
      .then((result) => {
        if (cancelled) return;
        setLocations(result);
        setForm((current) =>
          current.locationId && !result.some((location) => location.id === current.locationId)
            ? { ...current, locationId: '' }
            : current,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.warehouseId]);

  useEffect(() => {
    if (!form.productId) {
      setProductStock([]);
      return;
    }
    let cancelled = false;
    apiFetch<ProductStock[]>(`/api/v1/inventory/stock/products/${form.productId}`)
      .then((result) => {
        if (cancelled) return;
        setProductStock(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.productId]);

  const selectedStock = productStock.find((entry) => entry.warehouseId === form.warehouseId);

  const openModal = () => {
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const setField = (key: keyof MovementForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.productId || !form.warehouseId || form.quantity === '') {
      setFormError('Product, warehouse and quantity are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      movementType: form.movementType,
      productId: form.productId,
      warehouseId: form.warehouseId,
      locationId: form.locationId || undefined,
      quantity: Number(form.quantity),
      unitCost: form.unitCost === '' ? undefined : Number(form.unitCost),
      lotNumber: form.lotNumber.trim() || undefined,
      expiryDate: form.expiryDate || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      await apiFetch('/api/v1/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Stock movement recorded.');
      setModalOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not record movement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Stock levels and movements"
        action={<Button onClick={openModal}>New movement</Button>}
      />
      <div className="tabs">
        <button type="button" className={tab === 'stock' ? 'tab tab-active' : 'tab'} onClick={() => setTab('stock')}>
          Stock levels
        </button>
        <button
          type="button"
          className={tab === 'movements' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('movements')}
        >
          Movements
        </button>
        <button
          type="button"
          className={tab === 'lots' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('lots')}
        >
          Lots
        </button>
      </div>
      {tab === 'stock' ? <StockTab key={`stock-${refreshKey}`} /> : null}
      {tab === 'movements' ? <MovementsTab key={`movements-${refreshKey}`} warehouses={warehouses} /> : null}
      {tab === 'lots' ? <LotsTab key={`lots-${refreshKey}`} warehouses={warehouses} /> : null}

      <Modal open={modalOpen} title="New stock movement" onClose={closeModal} width="md">
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Product" htmlFor="movement-product" required>
              <Select
                id="movement-product"
                value={form.productId}
                onChange={(event) => setField('productId', event.target.value)}
              >
                <option value="">— Select product —</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Warehouse" htmlFor="movement-warehouse" required>
              <Select
                id="movement-warehouse"
                value={form.warehouseId}
                onChange={(event) => {
                  setField('warehouseId', event.target.value);
                  setField('locationId', '');
                }}
              >
                <option value="">— Select warehouse —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            {locations.length > 0 ? (
              <Field label="Location" htmlFor="movement-location">
                <Select
                  id="movement-location"
                  value={form.locationId}
                  onChange={(event) => setField('locationId', event.target.value)}
                >
                  <option value="">— No location —</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} · {location.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Type" htmlFor="movement-type" required>
              <Select
                id="movement-type"
                value={form.movementType}
                onChange={(event) => setField('movementType', event.target.value)}
              >
                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="movement-quantity" required>
              <TextInput
                id="movement-quantity"
                type="number"
                min="0.0001"
                step="any"
                value={form.quantity}
                onChange={(event) => setField('quantity', event.target.value)}
              />
              {selectedStock ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  Available: {formatNumber(selectedStock.quantity)}
                  {selectedStock.reservedQuantity > 0
                    ? ` (reserved ${formatNumber(selectedStock.reservedQuantity)})`
                    : ''}
                </div>
              ) : null}
            </Field>
            <Field label="Unit cost" htmlFor="movement-cost">
              <TextInput
                id="movement-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(event) => setField('unitCost', event.target.value)}
              />
            </Field>
            <Field label="Lot number" htmlFor="movement-lot">
              <TextInput
                id="movement-lot"
                value={form.lotNumber}
                placeholder="LOT-001"
                onChange={(event) => setField('lotNumber', event.target.value)}
              />
            </Field>
            <Field label="Expiry date" htmlFor="movement-expiry">
              <TextInput
                id="movement-expiry"
                type="date"
                value={form.expiryDate}
                onChange={(event) => setField('expiryDate', event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="movement-notes">
              <TextArea
                id="movement-notes"
                rows={2}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </Field>
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Recording…' : 'Record movement'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
