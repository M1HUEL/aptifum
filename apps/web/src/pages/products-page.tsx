import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, ApiError } from '../api/client';
import type { components } from '../api/schema';
import type { Category, Paginated, Product, ProductStock } from '../api/types';
import { productFormSchema, type ProductFormValues } from '../api/schemas';
import { useApiInvalidation, useApiMutation } from '../api/hooks';
import {
  Badge,
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
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';

type CreateProductDto = components['schemas']['CreateProductDto'];

const emptyForm: ProductFormValues = {
  sku: '',
  name: '',
  description: '',
  brand: '',
  unitOfMeasure: '',
  barcode: '',
  categoryId: '',
  purchasePrice: '',
  salePrice: '',
  enabled: true,
};

function toDto(form: ProductFormValues): CreateProductDto {
  return {
    sku: form.sku.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    brand: form.brand.trim() || undefined,
    unitOfMeasure: form.unitOfMeasure.trim() || undefined,
    barcode: form.barcode.trim() || undefined,
    categoryId: form.categoryId || undefined,
    purchasePrice: form.purchasePrice === '' ? undefined : Number(form.purchasePrice),
    salePrice: form.salePrice === '' ? undefined : Number(form.salePrice),
    enabled: form.enabled,
  };
}

function fromProduct(product: Product): ProductFormValues {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    brand: product.brand ?? '',
    unitOfMeasure: product.unitOfMeasure ?? '',
    barcode: product.barcode ?? '',
    categoryId: product.categoryId ?? '',
    purchasePrice: product.purchasePrice ? String(product.purchasePrice) : '',
    salePrice: product.salePrice ? String(product.salePrice) : '',
    enabled: product.enabled,
  };
}

function parsePageNumber(raw: string | null): number {
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function parseLimitNumber(raw: string | null): number {
  if (!raw) return 20;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 20 : parsed;
}

export function ProductsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => parsePageNumber(searchParams.get('page')));
  const [limit, setLimit] = useState(() => parseLimitNumber(searchParams.get('limit')));
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [input, setInput] = useState(() => searchParams.get('q') ?? '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [stock, setStock] = useState<ProductStock[]>([]);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: emptyForm,
  });

  const enabled = watch('enabled');

  const { data, error } = usePagedQuery<Product>({
    path: '/api/v1/inventory/products',
    page,
    limit,
    query,
  });

  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    setInput(urlQuery);
    setQuery(urlQuery);
    setPage(parsePageNumber(searchParams.get('page')));
    setLimit(parseLimitNumber(searchParams.get('limit')));
  }, [searchParams]);

  const createMutation = useApiMutation<CreateProductDto>('/api/v1/inventory/products', 'POST');
  const updateMutation = useApiMutation<CreateProductDto>(
    `/api/v1/inventory/products/${editingId ?? ''}`,
    'PATCH',
  );
  const deleteMutation = useApiMutation<Record<string, never>, unknown>(
    `/api/v1/inventory/products/${deleting?.id ?? ''}`,
    'DELETE',
  );

  const saving = createMutation.isPending || updateMutation.isPending;
  const deleteBusy = deleteMutation.isPending;

  useEffect(() => {
    let cancelled = false;
    void apiFetch<Paginated<Category>>('/api/v1/inventory/categories?page=1&limit=100')
      .then((result) => {
        if (!cancelled) setCategories(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = input.trim();
    setQuery(nextQuery);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (nextQuery) params.set('q', nextQuery);
    else params.delete('q');
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (next: number) => {
    setPage(next);
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params);
  };

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    params.set('limit', String(next));
    params.set('page', '1');
    setSearchParams(params);
  };

  const openCreate = () => {
    setEditingId(null);
    reset(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    reset(fromProduct(product));
    setFormError(null);
    setModalOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? t('products.productUpdated') : t('products.productCreated'));
      setModalOpen(false);
      void invalidate(['paged', '/api/v1/inventory/products']);
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(toDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(toDto(values), { onSuccess, onError });
    }
  });

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      {},
      {
        onSuccess: () => {
          toast.toast(t('products.productDeactivated'));
          setDeleting(null);
          void invalidate(['paged', '/api/v1/inventory/products']);
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
          setDeleting(null);
        },
      },
    );
  };

  const openView = async (row: Product) => {
    setViewing(row);
    setViewLoading(true);
    setViewError(null);
    setStock([]);
    try {
      const [detail, stockResult] = await Promise.all([
        apiFetch<Product>(`/api/v1/inventory/products/${row.id}`),
        apiFetch<ProductStock[]>(`/api/v1/inventory/stock/products/${row.id}`),
      ]);
      setViewing(detail);
      setStock(stockResult);
    } catch (err) {
      setViewError(err instanceof ApiError ? err.message : t('errors.couldNotLoadProduct'));
    } finally {
      setViewLoading(false);
    }
  };

  const columns: Column<Product>[] = [
    { key: 'sku', header: t('fields.sku') },
    { key: 'name', header: t('fields.name') },
    {
      key: 'category',
      header: t('products.category'),
      render: (row) => row.category?.name ?? '—',
    },
    {
      key: 'salePrice',
      header: t('fields.salePrice'),
      render: (row) => formatMoney(row.salePrice),
    },
    {
      key: 'enabled',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.enabled ? 'success' : 'neutral'}>
          {row.enabled ? t('products.enabled') : t('products.disabled')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => void openView(row)}>
            {t('common.view')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {t('common.edit')}
          </Button>
          {row.enabled ? (
            <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
              {t('products.deactivate')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'products', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        action={
          <div className="page-header-actions">
            <button type="button" className="btn" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </button>
            <Button onClick={openCreate}>{t('products.newProduct')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder={t('products.searchByName')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" className="btn">
          {t('common.search')}
        </button>
      </form>
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('products.noProducts')} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={handlePageChange} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingId ? t('products.editProduct') : t('products.newProduct')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="product-sku">{t('fields.sku')} *</label>
                <input id="product-sku" {...register('sku')} />
                {errors.sku ? <div className="field-error">{errors.sku.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-name">{t('fields.name')} *</label>
                <input id="product-name" {...register('name')} />
                {errors.name ? <div className="field-error">{errors.name.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-brand">{t('fields.brand')}</label>
                <input id="product-brand" {...register('brand')} />
                {errors.brand ? <div className="field-error">{errors.brand.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-uom">{t('fields.unitOfMeasure')}</label>
                <input id="product-uom" placeholder={t('products.uomPlaceholder')} {...register('unitOfMeasure')} />
                {errors.unitOfMeasure ? <div className="field-error">{errors.unitOfMeasure.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-barcode">{t('fields.barcode')}</label>
                <input id="product-barcode" {...register('barcode')} />
                {errors.barcode ? <div className="field-error">{errors.barcode.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-category">{t('products.category')}</label>
                <select id="product-category" {...register('categoryId')}>
                  <option value="">{t('products.none')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="product-purchase">{t('fields.purchasePrice')}</label>
                <input
                  id="product-purchase"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('purchasePrice')}
                />
                {errors.purchasePrice ? (
                  <div className="field-error">{errors.purchasePrice.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="product-sale">{t('fields.salePrice')}</label>
                <input id="product-sale" type="number" min="0" step="0.01" {...register('salePrice')} />
                {errors.salePrice ? <div className="field-error">{errors.salePrice.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-description">{t('fields.description')}</label>
                <textarea id="product-description" rows={3} {...register('description')} />
              </div>
              <div className="field">
                <label>{t('common.status')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="product-enabled"
                    checked={enabled}
                    onCheckedChange={(checked) => setValue('enabled', checked === true)}
                  />
                  <label htmlFor="product-enabled" className="text-sm text-gray-700">
                    {t('products.enabled')}
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('products.createProduct')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={viewing?.name ?? t('products.product')} />
          {viewLoading ? <LoadingBlock /> : null}
          {viewError ? <ErrorBanner message={viewError} /> : null}
          {!viewLoading && viewing ? (
            <div>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">{t('fields.sku')}</div>
                  <div className="detail-value">{viewing.sku}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('common.status')}</div>
                  <div className="detail-value">
                    <Badge tone={viewing.enabled ? 'success' : 'neutral'}>
                      {viewing.enabled ? t('products.enabled') : t('products.disabled')}
                    </Badge>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('products.category')}</div>
                  <div className="detail-value">{viewing.category?.name ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('fields.brand')}</div>
                  <div className="detail-value">{viewing.brand ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('fields.unitOfMeasure')}</div>
                  <div className="detail-value">{viewing.unitOfMeasure ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('fields.barcode')}</div>
                  <div className="detail-value">{viewing.barcode ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('fields.purchasePrice')}</div>
                  <div className="detail-value num">{formatMoney(viewing.purchasePrice)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">{t('fields.salePrice')}</div>
                  <div className="detail-value num">{formatMoney(viewing.salePrice)}</div>
                </div>
              </div>
              {viewing.description ? <div className="detail-notes">{viewing.description}</div> : null}
              <h4 className="detail-section-title">{t('products.stockByWarehouse')}</h4>
              {stock.length === 0 ? (
                <p className="modal-message">{t('products.noStockRecorded')}</p>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('fields.warehouse')}</th>
                        <th className="num">{t('products.onHand')}</th>
                        <th className="num">{t('products.reserved')}</th>
                        <th className="num">{t('products.avgCost')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.warehouse?.name ?? entry.warehouseId}</td>
                          <td className="num">{formatNumber(entry.quantity)}</td>
                          <td className="num">{formatNumber(entry.reservedQuantity)}</td>
                          <td className="num">{formatMoney(entry.averageCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setViewing(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !deleteBusy && !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader
            title={t('products.deactivateProductTitle')}
            description={t('products.deactivateProductMessage', { name: deleting?.name ?? '' })}
          />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy ? t('common.working') : t('products.deactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
