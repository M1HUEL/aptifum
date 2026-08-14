import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import { exportRowsToCsv } from '../lib/csv';

type CreateMovementDto = components['schemas']['CreateMovementDto'];

const movementTypes: MovementType[] = [
  'inbound',
  'outbound',
  'adjustment',
  'transfer',
  'return',
  'disposal',
];

type StockTab = 'stock' | 'movements' | 'lots';

function parseTab(raw: string | null): StockTab {
  return raw === 'movements' || raw === 'lots' ? raw : 'stock';
}

function movementTone(type: MovementType): 'success' | 'danger' | 'info' {
  if (type === 'inbound' || type === 'return') return 'success';
  if (type === 'outbound' || type === 'disposal') return 'danger';
  return 'info';
}

const stockColumns = (t: TFunction): Column<ProductStock>[] => [
  {
    key: 'product',
    header: t('fields.product'),
    render: (row) => `${row.product.sku} · ${row.product.name}`,
  },
  {
    key: 'warehouse',
    header: t('fields.warehouse'),
    render: (row) => row.warehouse.name,
  },
  {
    key: 'quantity',
    header: t('stock.onHand'),
    render: (row) => (
      <Badge tone={row.quantity <= 10 ? 'warning' : 'success'}>{formatNumber(row.quantity)}</Badge>
    ),
  },
  {
    key: 'reservedQuantity',
    header: t('stock.reserved'),
    render: (row) => formatNumber(row.reservedQuantity),
  },
  {
    key: 'averageCost',
    header: t('stock.avgCost'),
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

const lotColumns = (t: TFunction): Column<ProductLot>[] => [
  {
    key: 'product',
    header: t('fields.product'),
    render: (row) => `${row.product.sku} · ${row.product.name}`,
  },
  {
    key: 'variant',
    header: t('stock.variant'),
    render: (row) => (row.variant ? Object.values(row.variant.attributes ?? {}).join(' · ') || row.variant.sku : '—'),
  },
  {
    key: 'lotNumber',
    header: t('stock.lot'),
    render: (row) => row.lotNumber,
  },
  {
    key: 'warehouse',
    header: t('fields.warehouse'),
    render: (row) => row.warehouse.name,
  },
  {
    key: 'expiryDate',
    header: t('stock.expiry'),
    render: (row) => formatDate(row.expiryDate),
  },
  {
    key: 'quantity',
    header: t('stock.qty'),
    render: (row) => formatNumber(row.quantity),
  },
  {
    key: 'status',
    header: t('common.status'),
    render: (row) => <Badge tone={lotTone(row.status)}>{row.status}</Badge>,
  },
];

const movementColumns = (t: TFunction): Column<StockMovement>[] => [
  {
    key: 'occurredAt',
    header: t('tables.date'),
    render: (row) => formatDateTime(row.occurredAt),
  },
  {
    key: 'movementType',
    header: t('tables.type'),
    render: (row) => <Badge tone={movementTone(row.movementType)}>{row.movementType}</Badge>,
  },
  {
    key: 'product',
    header: t('fields.product'),
    render: (row) => `${row.product.sku} · ${row.product.name}`,
  },
  {
    key: 'warehouse',
    header: t('fields.warehouse'),
    render: (row) => row.warehouse.name,
  },
  {
    key: 'quantity',
    header: t('stock.qty'),
    render: (row) => formatNumber(row.quantity),
  },
  {
    key: 'unitCost',
    header: t('fields.unitCost'),
    render: (row) => `$${row.unitCost.toFixed(2)}`,
  },
  { key: 'notes', header: t('fields.notes'), render: (row) => row.notes ?? '—' },
];

function StockTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { data, error } = usePagedQuery<ProductStock>({
    path: '/api/v1/inventory/stock',
    page,
    limit,
  });

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
  };

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'stock', columns: stockColumns(t), rows: data.data });
  };

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn" aria-label={t('common.export')} onClick={handleExport}>
          {t('common.export')}
        </button>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('stock.noStockRecords')} />
          ) : (
            <DataTable columns={stockColumns(t)} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} onLimit={handleLimitChange} />
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
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
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
    limit,
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

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
  };

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'stock-movements', columns: movementColumns(t), rows: data.data });
  };

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn" aria-label={t('common.export')} onClick={handleExport}>
          {t('common.export')}
        </button>
        <select value={filters.movementType} onChange={(event) => setFilter('movementType', event.target.value)}>
          <option value="">{t('stock.allTypes')}</option>
          {movementTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={filters.warehouseId} onChange={(event) => setFilter('warehouseId', event.target.value)}>
          <option value="">{t('stock.allWarehouses')}</option>
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
            {t('stock.clearFilters')}
          </Button>
        ) : null}
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('stock.noMovementsMatch')} />
          ) : (
            <DataTable columns={movementColumns(t)} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} onLimit={handleLimitChange} />
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
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
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
    limit,
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

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
  };

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'lots', columns: lotColumns(t), rows: data.data });
  };

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn" aria-label={t('common.export')} onClick={handleExport}>
          {t('common.export')}
        </button>
        <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">{t('stock.allStatuses')}</option>
          <option value="active">{t('stock.active')}</option>
          <option value="expiring">{t('stock.expiringSoon')}</option>
          <option value="expired">{t('stock.expired')}</option>
        </select>
        <select value={filters.warehouseId} onChange={(event) => setFilter('warehouseId', event.target.value)}>
          <option value="">{t('stock.allWarehouses')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
        {hasFilters ? (
          <Button variant="ghost" onClick={resetFilters}>
            {t('stock.clearFilters')}
          </Button>
        ) : null}
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('stock.noLotsMatch')} />
          ) : (
            <DataTable columns={lotColumns(t)} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} onLimit={handleLimitChange} />
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
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<StockTab>(() => parseTab(searchParams.get('tab')));
  const [refreshKey, setRefreshKey] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [productStock, setProductStock] = useState<ProductStock[]>([]);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')));
  }, [searchParams]);

  const changeTab = (next: StockTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

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
        toast.toast(t('stock.stockMovementRecorded'));
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
        title={t('stock.title')}
        subtitle={t('stock.subtitle')}
        action={<Button onClick={openModal}>{t('stock.newMovement')}</Button>}
      />
      <div className="tabs">
        <button type="button" className={tab === 'stock' ? 'tab tab-active' : 'tab'} onClick={() => changeTab('stock')}>
          {t('stock.stockLevels')}
        </button>
        <button
          type="button"
          className={tab === 'movements' ? 'tab tab-active' : 'tab'}
          onClick={() => changeTab('movements')}
        >
          {t('stock.movements')}
        </button>
        <button
          type="button"
          className={tab === 'lots' ? 'tab tab-active' : 'tab'}
          onClick={() => changeTab('lots')}
        >
          {t('stock.lots')}
        </button>
      </div>
      {tab === 'stock' ? <StockTab key={`stock-${refreshKey}`} /> : null}
      {tab === 'movements' ? <MovementsTab key={`movements-${refreshKey}`} warehouses={warehouses} /> : null}
      {tab === 'lots' ? <LotsTab key={`lots-${refreshKey}`} warehouses={warehouses} /> : null}

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={t('stock.newStockMovement')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="movement-product">{t('fields.product')} *</label>
                <select id="movement-product" {...register('productId')}>
                  <option value="">{t('stock.selectProduct')}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </select>
                {errors.productId ? <div className="field-error">{errors.productId.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-warehouse">{t('fields.warehouse')} *</label>
                <select
                  id="movement-warehouse"
                  {...register('warehouseId', {
                    onChange: () => setValue('locationId', ''),
                  })}
                >
                  <option value="">{t('stock.selectWarehouse')}</option>
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
                  <label htmlFor="movement-location">{t('stock.location')}</label>
                  <select id="movement-location" {...register('locationId')}>
                    <option value="">{t('stock.noLocation')}</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} · {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="movement-type">{t('tables.type')} *</label>
                <select id="movement-type" {...register('movementType')}>
                  {movementTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="movement-quantity">{t('fields.quantity')} *</label>
                <input
                  id="movement-quantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  {...register('quantity')}
                />
                {selectedStock ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    {t('stock.available', { quantity: formatNumber(selectedStock.quantity) })}
                    {selectedStock.reservedQuantity > 0
                      ? t('stock.reservedInfo', { quantity: formatNumber(selectedStock.reservedQuantity) })
                      : ''}
                  </div>
                ) : null}
                {errors.quantity ? <div className="field-error">{errors.quantity.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-cost">{t('fields.unitCost')}</label>
                <input id="movement-cost" type="number" min="0" step="0.01" {...register('unitCost')} />
                {errors.unitCost ? <div className="field-error">{errors.unitCost.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-lot">{t('fields.lotNumber')}</label>
                <input id="movement-lot" placeholder={t('stock.lotPlaceholder')} {...register('lotNumber')} />
                {errors.lotNumber ? <div className="field-error">{errors.lotNumber.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="movement-expiry">{t('fields.expiryDate')}</label>
                <input id="movement-expiry" type="date" {...register('expiryDate')} />
              </div>
              <div className="field">
                <label htmlFor="movement-notes">{t('fields.notes')}</label>
                <textarea id="movement-notes" rows={2} {...register('notes')} />
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? t('stock.recording') : t('stock.recordMovement')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
