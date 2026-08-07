import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Category, Paginated, Product } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatMoney,
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

interface ProductForm {
  sku: string;
  name: string;
  description: string;
  brand: string;
  unitOfMeasure: string;
  barcode: string;
  categoryId: string;
  purchasePrice: string;
  salePrice: string;
  enabled: boolean;
}

const emptyForm: ProductForm = {
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

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Product>({
    path: '/api/v1/inventory/products',
    page,
    query,
  });

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
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
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
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const setField = (key: keyof ProductForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      setFormError('SKU and name are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
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
    try {
      if (editingId) {
        await apiFetch(`/api/v1/inventory/products/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Product updated.');
      } else {
        await apiFetch('/api/v1/inventory/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Product created.');
      }
      setModalOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/inventory/products/${deleting.id}`, { method: 'DELETE' });
      toast.toast('Product deactivated.');
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not deactivate product.', 'error');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
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
      render: (row) => <Badge tone={row.enabled ? 'success' : 'neutral'}>{row.enabled ? 'Enabled' : 'Disabled'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
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

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit product' : 'New product'}
        onClose={closeModal}
        width="lg"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="SKU" htmlFor="product-sku" required>
              <TextInput
                id="product-sku"
                value={form.sku}
                onChange={(event) => setField('sku', event.target.value)}
              />
            </Field>
            <Field label="Name" htmlFor="product-name" required>
              <TextInput
                id="product-name"
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
              />
            </Field>
            <Field label="Brand" htmlFor="product-brand">
              <TextInput
                id="product-brand"
                value={form.brand}
                onChange={(event) => setField('brand', event.target.value)}
              />
            </Field>
            <Field label="Unit of measure" htmlFor="product-uom">
              <TextInput
                id="product-uom"
                placeholder="e.g. unit, kg, box"
                value={form.unitOfMeasure}
                onChange={(event) => setField('unitOfMeasure', event.target.value)}
              />
            </Field>
            <Field label="Barcode" htmlFor="product-barcode">
              <TextInput
                id="product-barcode"
                value={form.barcode}
                onChange={(event) => setField('barcode', event.target.value)}
              />
            </Field>
            <Field label="Category" htmlFor="product-category">
              <Select
                id="product-category"
                value={form.categoryId}
                onChange={(event) => setField('categoryId', event.target.value)}
              >
                <option value="">— None —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Purchase price" htmlFor="product-purchase">
              <TextInput
                id="product-purchase"
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(event) => setField('purchasePrice', event.target.value)}
              />
            </Field>
            <Field label="Sale price" htmlFor="product-sale">
              <TextInput
                id="product-sale"
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(event) => setField('salePrice', event.target.value)}
              />
            </Field>
            <Field label="Description" htmlFor="product-description">
              <TextArea
                id="product-description"
                rows={3}
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
              />
            </Field>
            <Field label="Status">
              <Checkbox
                label="Enabled"
                checked={form.enabled}
                onChange={(event) => setField('enabled', event.target.checked)}
              />
            </Field>
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Deactivate product"
        message={`Deactivate "${deleting?.name}"? It will be hidden from new transactions.`}
        confirmLabel="Deactivate"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
