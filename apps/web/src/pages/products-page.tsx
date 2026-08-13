import { useEffect, useState, type FormEvent } from 'react';
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
} from '../components/ui';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

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

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
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
    query,
  });

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
    setQuery(input.trim());
    setPage(1);
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
      toast.toast(editingId ? 'Product updated.' : 'Product created.');
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
          toast.toast('Product deactivated.');
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
      setViewError(err instanceof ApiError ? err.message : 'Could not load product.');
    } finally {
      setViewLoading(false);
    }
  };

  const columns: Column<Product>[] = [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Name' },
    {
      key: 'category',
      header: 'Category',
      render: (row) => row.category?.name ?? '—',
    },
    {
      key: 'salePrice',
      header: 'Sale price',
      render: (row) => formatMoney(row.salePrice),
    },
    {
      key: 'enabled',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.enabled ? 'success' : 'neutral'}>{row.enabled ? 'Enabled' : 'Disabled'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => void openView(row)}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          {row.enabled ? (
            <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
              Deactivate
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Catalog"
        action={<Button onClick={openCreate}>New product</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by name…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No products found." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingId ? 'Edit product' : 'New product'} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="product-sku">SKU *</label>
                <input id="product-sku" {...register('sku')} />
                {errors.sku ? <div className="field-error">{errors.sku.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-name">Name *</label>
                <input id="product-name" {...register('name')} />
                {errors.name ? <div className="field-error">{errors.name.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-brand">Brand</label>
                <input id="product-brand" {...register('brand')} />
                {errors.brand ? <div className="field-error">{errors.brand.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-uom">Unit of measure</label>
                <input id="product-uom" placeholder="e.g. unit, kg, box" {...register('unitOfMeasure')} />
                {errors.unitOfMeasure ? <div className="field-error">{errors.unitOfMeasure.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-barcode">Barcode</label>
                <input id="product-barcode" {...register('barcode')} />
                {errors.barcode ? <div className="field-error">{errors.barcode.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-category">Category</label>
                <select id="product-category" {...register('categoryId')}>
                  <option value="">— None —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="product-purchase">Purchase price</label>
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
                <label htmlFor="product-sale">Sale price</label>
                <input id="product-sale" type="number" min="0" step="0.01" {...register('salePrice')} />
                {errors.salePrice ? <div className="field-error">{errors.salePrice.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="product-description">Description</label>
                <textarea id="product-description" rows={3} {...register('description')} />
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="product-enabled"
                    checked={enabled}
                    onCheckedChange={(checked) => setValue('enabled', checked === true)}
                  />
                  <label htmlFor="product-enabled" className="text-sm text-gray-700">
                    Enabled
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={viewing?.name ?? 'Product'} />
          {viewLoading ? <LoadingBlock /> : null}
          {viewError ? <ErrorBanner message={viewError} /> : null}
          {!viewLoading && viewing ? (
            <div>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">SKU</div>
                  <div className="detail-value">{viewing.sku}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">
                    <Badge tone={viewing.enabled ? 'success' : 'neutral'}>
                      {viewing.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Category</div>
                  <div className="detail-value">{viewing.category?.name ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Brand</div>
                  <div className="detail-value">{viewing.brand ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Unit of measure</div>
                  <div className="detail-value">{viewing.unitOfMeasure ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Barcode</div>
                  <div className="detail-value">{viewing.barcode ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Purchase price</div>
                  <div className="detail-value num">{formatMoney(viewing.purchasePrice)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Sale price</div>
                  <div className="detail-value num">{formatMoney(viewing.salePrice)}</div>
                </div>
              </div>
              {viewing.description ? <div className="detail-notes">{viewing.description}</div> : null}
              <h4 className="detail-section-title">Stock by warehouse</h4>
              {stock.length === 0 ? (
                <p className="modal-message">No stock recorded.</p>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Warehouse</th>
                        <th className="num">On hand</th>
                        <th className="num">Reserved</th>
                        <th className="num">Avg cost</th>
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
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !deleteBusy && !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader
            title="Deactivate product"
            description={`Deactivate "${deleting?.name}"? It will be hidden from new transactions.`}
          />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy ? 'Working…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
