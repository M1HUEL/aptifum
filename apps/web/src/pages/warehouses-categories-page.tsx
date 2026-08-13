import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Category, Warehouse, WarehouseLocation } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
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
import { usePagedQuery } from '../hooks/use-paged-query';

interface WarehouseForm {
  code: string;
  name: string;
  address: string;
  active: boolean;
}

const emptyWarehouse: WarehouseForm = { code: '', name: '', address: '', active: true };

interface CategoryForm {
  name: string;
  parentId: string;
  active: boolean;
}

const emptyCategory: CategoryForm = { name: '', parentId: '', active: true };

interface LocationForm {
  code: string;
  name: string;
  active: boolean;
}

const emptyLocation: LocationForm = { code: '', name: '', active: true };

export function WarehousesCategoriesPage() {
  const [tab, setTab] = useState<'warehouses' | 'categories'>('warehouses');
  const toast = useToast();

  const [whOpen, setWhOpen] = useState(false);
  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [whForm, setWhForm] = useState<WarehouseForm>(emptyWarehouse);
  const [whError, setWhError] = useState<string | null>(null);
  const [whSaving, setWhSaving] = useState(false);
  const [deletingWh, setDeletingWh] = useState<Warehouse | null>(null);
  const [whDeleteBusy, setWhDeleteBusy] = useState(false);

  const [locationsFor, setLocationsFor] = useState<Warehouse | null>(null);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [locOpen, setLocOpen] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [locForm, setLocForm] = useState<LocationForm>(emptyLocation);
  const [locError, setLocError] = useState<string | null>(null);
  const [locSaving, setLocSaving] = useState(false);
  const [deletingLoc, setDeletingLoc] = useState<WarehouseLocation | null>(null);
  const [locDeleteBusy, setLocDeleteBusy] = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategory);
  const [catError, setCatError] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  const {
    data: warehouseData,
    error: warehouseError,
    reload: reloadWarehouses,
  } = usePagedQuery<Warehouse>({ path: '/api/v1/inventory/warehouses', page: 1, limit: 50 });

  const {
    data: categoryData,
    error: categoryError,
    reload: reloadCategories,
  } = usePagedQuery<Category>({ path: '/api/v1/inventory/categories', page: 1, limit: 50 });

  const loadLocations = async (warehouse: Warehouse) => {
    setLocationsFor(warehouse);
    setLocationsLoading(true);
    setLocationsError(null);
    try {
      setLocations(await apiFetch<WarehouseLocation[]>(`/api/v1/inventory/warehouses/${warehouse.id}/locations`));
    } catch (err) {
      setLocationsError(err instanceof ApiError ? err.message : 'Could not load locations.');
    } finally {
      setLocationsLoading(false);
    }
  };

  const openWarehouse = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingWhId(warehouse.id);
      setWhForm({
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address ?? '',
        active: warehouse.active,
      });
    } else {
      setEditingWhId(null);
      setWhForm(emptyWarehouse);
    }
    setWhError(null);
    setWhOpen(true);
  };

  const submitWarehouse = async (event: FormEvent) => {
    event.preventDefault();
    if (!whForm.code.trim() || !whForm.name.trim()) {
      setWhError('Code and name are required.');
      return;
    }
    setWhSaving(true);
    setWhError(null);
    const body = {
      code: whForm.code.trim(),
      name: whForm.name.trim(),
      address: whForm.address.trim() || undefined,
      active: whForm.active,
    };
    try {
      if (editingWhId) {
        await apiFetch(`/api/v1/inventory/warehouses/${editingWhId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Warehouse updated.');
      } else {
        await apiFetch('/api/v1/inventory/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Warehouse created.');
      }
      setWhOpen(false);
      void reloadWarehouses();
    } catch (err) {
      setWhError(err instanceof ApiError ? err.message : 'Could not save warehouse.');
    } finally {
      setWhSaving(false);
    }
  };

  const confirmDeleteWh = async () => {
    if (!deletingWh) return;
    setWhDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/inventory/warehouses/${deletingWh.id}`, { method: 'DELETE' });
      toast.toast('Warehouse deactivated.');
      setDeletingWh(null);
      void reloadWarehouses();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not deactivate warehouse.', 'error');
      setDeletingWh(null);
    } finally {
      setWhDeleteBusy(false);
    }
  };

  const openLocation = (location?: WarehouseLocation) => {
    if (location) {
      setEditingLocId(location.id);
      setLocForm({ code: location.code, name: location.name, active: location.active });
    } else {
      setEditingLocId(null);
      setLocForm(emptyLocation);
    }
    setLocError(null);
    setLocOpen(true);
  };

  const submitLocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!locForm.code.trim() || !locForm.name.trim() || !locationsFor) {
      setLocError('Code and name are required.');
      return;
    }
    setLocSaving(true);
    setLocError(null);
    const body = {
      code: locForm.code.trim(),
      name: locForm.name.trim(),
      active: locForm.active,
    };
    try {
      if (editingLocId) {
        await apiFetch(`/api/v1/inventory/warehouses/${locationsFor.id}/locations/${editingLocId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Location updated.');
      } else {
        await apiFetch(`/api/v1/inventory/warehouses/${locationsFor.id}/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Location added.');
      }
      setLocOpen(false);
      await loadLocations(locationsFor);
    } catch (err) {
      setLocError(err instanceof ApiError ? err.message : 'Could not save location.');
    } finally {
      setLocSaving(false);
    }
  };

  const confirmDeleteLoc = async () => {
    if (!deletingLoc || !locationsFor) return;
    setLocDeleteBusy(true);
    try {
      await apiFetch(
        `/api/v1/inventory/warehouses/${locationsFor.id}/locations/${deletingLoc.id}`,
        { method: 'DELETE' },
      );
      toast.toast('Location deactivated.');
      setDeletingLoc(null);
      await loadLocations(locationsFor);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not deactivate location.', 'error');
      setDeletingLoc(null);
    } finally {
      setLocDeleteBusy(false);
    }
  };

  const openCategory = (category?: Category) => {
    if (category) {
      setEditingCatId(category.id);
      setCatForm({ name: category.name, parentId: category.parentId ?? '', active: category.active });
    } else {
      setEditingCatId(null);
      setCatForm(emptyCategory);
    }
    setCatError(null);
    setCatOpen(true);
  };

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!catForm.name.trim()) {
      setCatError('Name is required.');
      return;
    }
    setCatSaving(true);
    setCatError(null);
    const body = {
      name: catForm.name.trim(),
      parentId: catForm.parentId || undefined,
      active: catForm.active,
    };
    try {
      if (editingCatId) {
        await apiFetch(`/api/v1/inventory/categories/${editingCatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Category updated.');
      } else {
        await apiFetch('/api/v1/inventory/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Category created.');
      }
      setCatOpen(false);
      void reloadCategories();
    } catch (err) {
      setCatError(err instanceof ApiError ? err.message : 'Could not save category.');
    } finally {
      setCatSaving(false);
    }
  };

  const confirmDeleteCat = async () => {
    if (!deletingCat) return;
    try {
      await apiFetch(`/api/v1/inventory/categories/${deletingCat.id}`, { method: 'DELETE' });
      toast.toast('Category deleted.');
      setDeletingCat(null);
      void reloadCategories();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete category.', 'error');
      setDeletingCat(null);
    }
  };

  const warehouseColumns: Column<Warehouse>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'address', header: 'Address', render: (row) => row.address ?? '—' },
    {
      key: 'active',
      header: 'Status',
      render: (row) => <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => void loadLocations(row)}>
            Locations
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openWarehouse(row)}>
            Edit
          </Button>
          {row.active ? (
            <Button variant="danger" size="sm" onClick={() => setDeletingWh(row)}>
              Deactivate
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const categoryColumns: Column<Category>[] = [
    { key: 'name', header: 'Name' },
    { key: 'parentId', header: 'Parent', render: (row) => (row.parentId ? '—' : 'Root') },
    {
      key: 'active',
      header: 'Status',
      render: (row) => <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openCategory(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingCat(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Warehouses & categories"
        subtitle="Inventory structure"
        action={
          <Button onClick={() => (tab === 'warehouses' ? openWarehouse() : openCategory())}>
            {tab === 'warehouses' ? 'New warehouse' : 'New category'}
          </Button>
        }
      />

      <div className="tabs">
        <button type="button" className={tab === 'warehouses' ? 'tab tab-active' : 'tab'} onClick={() => setTab('warehouses')}>
          Warehouses
        </button>
        <button type="button" className={tab === 'categories' ? 'tab tab-active' : 'tab'} onClick={() => setTab('categories')}>
          Categories
        </button>
      </div>

      {tab === 'warehouses' ? (
        <>
          {warehouseError ? <ErrorBanner message={warehouseError} /> : null}
          {!warehouseData ? <LoadingBlock /> : null}
          {warehouseData ? (
            <>
              {warehouseData.data.length === 0 ? (
                <EmptyState message="No warehouses." />
              ) : (
                <DataTable columns={warehouseColumns} rows={warehouseData.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={warehouseData.meta.page} limit={warehouseData.meta.limit} total={warehouseData.meta.total} onPage={() => {}} />
            </>
          ) : null}
        </>
      ) : (
        <>
          {categoryError ? <ErrorBanner message={categoryError} /> : null}
          {!categoryData ? <LoadingBlock /> : null}
          {categoryData ? (
            <>
              {categoryData.data.length === 0 ? (
                <EmptyState message="No categories." />
              ) : (
                <DataTable columns={categoryColumns} rows={categoryData.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={categoryData.meta.page} limit={categoryData.meta.limit} total={categoryData.meta.total} onPage={() => {}} />
            </>
          ) : null}
        </>
      )}

      <Modal
        open={whOpen}
        title={editingWhId ? 'Edit warehouse' : 'New warehouse'}
        onClose={() => !whSaving && setWhOpen(false)}
      >
        <form onSubmit={(event) => void submitWarehouse(event)}>
          <Field label="Code" htmlFor="wh-code" required>
            <TextInput
              id="wh-code"
              value={whForm.code}
              onChange={(event) => setWhForm((current) => ({ ...current, code: event.target.value }))}
            />
          </Field>
          <Field label="Name" htmlFor="wh-name" required>
            <TextInput
              id="wh-name"
              value={whForm.name}
              onChange={(event) => setWhForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Address" htmlFor="wh-address">
            <TextArea
              id="wh-address"
              rows={2}
              value={whForm.address}
              onChange={(event) => setWhForm((current) => ({ ...current, address: event.target.value }))}
            />
          </Field>
          <Field label="Status">
            <Checkbox
              label="Active"
              checked={whForm.active}
              onChange={(event) => setWhForm((current) => ({ ...current, active: event.target.checked }))}
            />
          </Field>
          {whError ? <div className="error-banner">{whError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setWhOpen(false)} disabled={whSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={whSaving}>
              {whSaving ? 'Saving…' : editingWhId ? 'Save changes' : 'Create warehouse'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={locationsFor !== null}
        title={`Locations · ${locationsFor?.name ?? ''}`}
        onClose={() => setLocationsFor(null)}
        width="lg"
      >
        {locationsLoading ? <LoadingBlock /> : null}
        {locationsError ? <ErrorBanner message={locationsError} /> : null}
        {!locationsLoading && !locationsError ? (
          <>
            <div className="table-actions" style={{ marginBottom: '1rem' }}>
              <Button size="sm" onClick={() => openLocation()}>
                + Add location
              </Button>
            </div>
            {locations.length === 0 ? (
              <EmptyState message="No locations." />
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((location) => (
                      <tr key={location.id}>
                        <td>{location.code}</td>
                        <td>{location.name}</td>
                        <td>
                          <Badge tone={location.active ? 'success' : 'neutral'}>
                            {location.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td>
                          <div className="table-actions">
                            <Button variant="ghost" size="sm" onClick={() => openLocation(location)}>
                              Edit
                            </Button>
                            {location.active ? (
                              <Button variant="danger" size="sm" onClick={() => setDeletingLoc(location)}>
                                Deactivate
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setLocationsFor(null)}>
            Close
          </Button>
        </div>
      </Modal>

      <Modal
        open={locOpen}
        title={editingLocId ? 'Edit location' : 'Add location'}
        onClose={() => !locSaving && setLocOpen(false)}
      >
        <form onSubmit={(event) => void submitLocation(event)}>
          <Field label="Code" htmlFor="loc-code" required>
            <TextInput
              id="loc-code"
              value={locForm.code}
              onChange={(event) => setLocForm((current) => ({ ...current, code: event.target.value }))}
            />
          </Field>
          <Field label="Name" htmlFor="loc-name" required>
            <TextInput
              id="loc-name"
              value={locForm.name}
              onChange={(event) => setLocForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Status">
            <Checkbox
              label="Active"
              checked={locForm.active}
              onChange={(event) => setLocForm((current) => ({ ...current, active: event.target.checked }))}
            />
          </Field>
          {locError ? <div className="error-banner">{locError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setLocOpen(false)} disabled={locSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={locSaving}>
              {locSaving ? 'Saving…' : editingLocId ? 'Save changes' : 'Add location'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={catOpen}
        title={editingCatId ? 'Edit category' : 'New category'}
        onClose={() => !catSaving && setCatOpen(false)}
      >
        <form onSubmit={(event) => void submitCategory(event)}>
          <Field label="Name" htmlFor="cat-name" required>
            <TextInput
              id="cat-name"
              value={catForm.name}
              onChange={(event) => setCatForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Parent" htmlFor="cat-parent">
            <Select
              id="cat-parent"
              value={catForm.parentId}
              onChange={(event) => setCatForm((current) => ({ ...current, parentId: event.target.value }))}
            >
              <option value="">— Root —</option>
              {categoryData?.data.map((category) =>
                category.id !== editingCatId ? (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ) : null,
              )}
            </Select>
          </Field>
          <Field label="Status">
            <Checkbox
              label="Active"
              checked={catForm.active}
              onChange={(event) => setCatForm((current) => ({ ...current, active: event.target.checked }))}
            />
          </Field>
          {catError ? <div className="error-banner">{catError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setCatOpen(false)} disabled={catSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={catSaving}>
              {catSaving ? 'Saving…' : editingCatId ? 'Save changes' : 'Create category'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingWh !== null}
        title="Deactivate warehouse"
        message={`Deactivate "${deletingWh?.name}"?`}
        confirmLabel="Deactivate"
        busy={whDeleteBusy}
        onCancel={() => setDeletingWh(null)}
        onConfirm={() => void confirmDeleteWh()}
      />

      <ConfirmDialog
        open={deletingCat !== null}
        title="Delete category"
        message={`Delete "${deletingCat?.name}"?`}
        confirmLabel="Delete"
        onCancel={() => setDeletingCat(null)}
        onConfirm={() => void confirmDeleteCat()}
      />

      <ConfirmDialog
        open={deletingLoc !== null}
        title="Deactivate location"
        message={`Deactivate "${deletingLoc?.name}"?`}
        confirmLabel="Deactivate"
        busy={locDeleteBusy}
        onCancel={() => setDeletingLoc(null)}
        onConfirm={() => void confirmDeleteLoc()}
      />
    </>
  );
}
