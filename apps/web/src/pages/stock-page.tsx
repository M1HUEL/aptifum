import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import type { components } from '../api/schema';
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
import { stockMovementFormSchema, type StockMovementFormValues } from '../api/schemas';
import { useApiInvalidation, useApiMutation } from '../api/hooks';
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
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

type CreateMovementDto = components['schemas']['CreateMovementDto'];

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
        <select value={filters.movementType} onChange={(event) => setFilter('movementType', event.target.value)}>
          <option value="">All types</option>
          {movementTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={filters.warehouseId} onChange={(event) => setFilter('warehouseId', event.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
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
        <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired</option>
        </select>
        <select value={filters.warehouseId} onChange={(event) => setFilter('warehouseId', event.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
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

const emptyForm: StockMovementFormValues = {
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

function toDto(form: StockMovementFormValues): CreateMovementDto {
  return {
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
}

export function StockPage() {
  const [tab, setTab] = useState<'stock' | 'movements' | 'lots'>('stock');
  const [refreshKey, setRefreshKey] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [productStock, setProductStock] = useState<ProductStock[]>([]);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<StockMovementFormValues>({
    resolver: zodResolver(stockMovementFormSchema),
    defaultValues: emptyForm,
  });

  const warehouseId = watch('warehouseId');
  const productId = watch('productId');

  const createMutation = useApiMutation<CreateMovementDto>('/api/v1/inventory/movements', 'POST');
  const saving = createMutation.isPending;

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
    if (!warehouseId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    apiFetch<WarehouseLocation[]>(`/api/v1/inventory/warehouses/${warehouseId}/locations`)
      .then((result) => {
        if (cancelled) return;
        setLocations(result);
        if (getValues('locationId') && !result.some((location) => location.id === getValues('locationId'))) {
          setValue('locationId', '');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [warehouseId, getValues, setValue]);

  useEffect(() => {
    if (!productId) {
      setProductStock([]);
      return;
    }
    let cancelled = false;
    apiFetch<ProductStock[]>(`/api/v1/inventory/stock/products/${productId}`)
      .then((result) => {
        if (cancelled) return;
        setProductStock(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const selectedStock = productStock.find((entry) => entry.warehouseId === warehouseId);

  const openModal = () => {
    reset(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    createMutation.mutate(toDto(values), {
      onSuccess: () => {
        toast.toast('Stock movement recorded.');
        setModalOpen(false);
        setRefreshKey((key) => key + 1);
        void invalidate(['paged', '/api/v1/inventory/movements']);
        void invalidate(['paged', '/api/v1/inventory/stock']);
        void invalidate(['paged', '/api/v1/inventory/lots']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

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

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title="New stock movement" />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="movement-product">Product *</label>
                <select id="movement-product" {...register('productId')}>
                  <option value="">— Select product —</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </select>
                {errors.productId ? <div className="field-error">{errors.productId.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-warehouse">Warehouse *</label>
                <select
                  id="movement-warehouse"
                  {...register('warehouseId', {
                    onChange: () => setValue('locationId', ''),
                  })}
                >
                  <option value="">— Select warehouse —</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                {errors.warehouseId ? <div className="field-error">{errors.warehouseId.message}</div> : null}
              </div>
              {locations.length > 0 ? (
                <div className="field">
                  <label htmlFor="movement-location">Location</label>
                  <select id="movement-location" {...register('locationId')}>
                    <option value="">— No location —</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} · {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="movement-type">Type *</label>
                <select id="movement-type" {...register('movementType')}>
                  {movementTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="movement-quantity">Quantity *</label>
                <input
                  id="movement-quantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  {...register('quantity')}
                />
                {selectedStock ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    Available: {formatNumber(selectedStock.quantity)}
                    {selectedStock.reservedQuantity > 0
                      ? ` (reserved ${formatNumber(selectedStock.reservedQuantity)})`
                      : ''}
                  </div>
                ) : null}
                {errors.quantity ? <div className="field-error">{errors.quantity.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-cost">Unit cost</label>
                <input id="movement-cost" type="number" min="0" step="0.01" {...register('unitCost')} />
                {errors.unitCost ? <div className="field-error">{errors.unitCost.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-lot">Lot number</label>
                <input id="movement-lot" placeholder="LOT-001" {...register('lotNumber')} />
                {errors.lotNumber ? <div className="field-error">{errors.lotNumber.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-expiry">Expiry date</label>
                <input id="movement-expiry" type="date" {...register('expiryDate')} />
              </div>
              <div className="field">
                <label htmlFor="movement-notes">Notes</label>
                <textarea id="movement-notes" rows={2} {...register('notes')} />
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Recording…' : 'Record movement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
