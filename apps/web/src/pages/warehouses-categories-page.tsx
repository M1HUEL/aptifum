import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, ApiError } from '../api/client';
import type { components } from '../api/schema';
import type { Category, Warehouse, WarehouseLocation } from '../api/types';
import {
  categoryFormSchema,
  locationFormSchema,
  warehouseFormSchema,
  type CategoryFormValues,
  type LocationFormValues,
  type WarehouseFormValues,
} from '../api/schemas';
import { useApiInvalidation, useApiMutation, useApiMutationVoid } from '../api/hooks';
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
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

type CreateWarehouseDto = components['schemas']['CreateWarehouseDto'];
type CreateLocationDto = components['schemas']['CreateLocationDto'];
type CreateCategoryDto = components['schemas']['CreateCategoryDto'];

const emptyWarehouse: WarehouseFormValues = { code: '', name: '', address: '', active: true };

const emptyLocation: LocationFormValues = { code: '', name: '', active: true };

const emptyCategory: CategoryFormValues = { name: '', parentId: '', active: true };

function warehouseToDto(form: WarehouseFormValues): CreateWarehouseDto {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    address: form.address.trim() || undefined,
    active: form.active,
  };
}

function fromWarehouse(warehouse: Warehouse): WarehouseFormValues {
  return {
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address ?? '',
    active: warehouse.active,
  };
}

function locationToDto(form: LocationFormValues): CreateLocationDto {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    active: form.active,
  };
}

function fromLocation(location: WarehouseLocation): LocationFormValues {
  return { code: location.code, name: location.name, active: location.active };
}

function categoryToDto(form: CategoryFormValues): CreateCategoryDto {
  return {
    name: form.name.trim(),
    parentId: form.parentId || undefined,
    active: form.active,
  };
}

function fromCategory(category: Category): CategoryFormValues {
  return { name: category.name, parentId: category.parentId ?? '', active: category.active };
}

export function WarehousesCategoriesPage() {
  const [tab, setTab] = useState<'warehouses' | 'categories'>('warehouses');
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const [whOpen, setWhOpen] = useState(false);
  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [whError, setWhError] = useState<string | null>(null);
  const [deletingWh, setDeletingWh] = useState<Warehouse | null>(null);

  const [locationsFor, setLocationsFor] = useState<Warehouse | null>(null);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [locOpen, setLocOpen] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [deletingLoc, setDeletingLoc] = useState<WarehouseLocation | null>(null);

  const [catOpen, setCatOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catError, setCatError] = useState<string | null>(null);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  const {
    data: warehouseData,
    error: warehouseError,
  } = usePagedQuery<Warehouse>({ path: '/api/v1/inventory/warehouses', page: 1, limit: 50 });

  const {
    data: categoryData,
    error: categoryError,
  } = usePagedQuery<Category>({ path: '/api/v1/inventory/categories', page: 1, limit: 50 });

  const warehouseForm = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: emptyWarehouse,
  });
  const {
    register: registerWh,
    handleSubmit: submitWhForm,
    reset: resetWh,
    setValue: setWhValue,
    watch: watchWh,
    formState: { errors: whErrors },
  } = warehouseForm;

  const locationForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: emptyLocation,
  });
  const {
    register: registerLoc,
    handleSubmit: submitLocForm,
    reset: resetLoc,
    setValue: setLocValue,
    watch: watchLoc,
    formState: { errors: locErrors },
  } = locationForm;

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: emptyCategory,
  });
  const {
    register: registerCat,
    handleSubmit: submitCatForm,
    reset: resetCat,
    setValue: setCatValue,
    watch: watchCat,
    formState: { errors: catErrors },
  } = categoryForm;

  const whActive = watchWh('active');
  const locActive = watchLoc('active');
  const catActive = watchCat('active');

  const createWhMutation = useApiMutation<CreateWarehouseDto>('/api/v1/inventory/warehouses', 'POST');
  const updateWhMutation = useApiMutation<CreateWarehouseDto>(
    `/api/v1/inventory/warehouses/${editingWhId ?? ''}`,
    'PATCH',
  );
  const deleteWhMutation = useApiMutationVoid(`/api/v1/inventory/warehouses/${deletingWh?.id ?? ''}`, 'DELETE');

  const createLocMutation = useApiMutation<CreateLocationDto>(
    `/api/v1/inventory/warehouses/${locationsFor?.id ?? ''}/locations`,
    'POST',
  );
  const updateLocMutation = useApiMutation<CreateLocationDto>(
    `/api/v1/inventory/warehouses/${locationsFor?.id ?? ''}/locations/${editingLocId ?? ''}`,
    'PATCH',
  );
  const deleteLocMutation = useApiMutationVoid(
    `/api/v1/inventory/warehouses/${locationsFor?.id ?? ''}/locations/${deletingLoc?.id ?? ''}`,
    'DELETE',
  );

  const createCatMutation = useApiMutation<CreateCategoryDto>('/api/v1/inventory/categories', 'POST');
  const updateCatMutation = useApiMutation<CreateCategoryDto>(
    `/api/v1/inventory/categories/${editingCatId ?? ''}`,
    'PATCH',
  );
  const deleteCatMutation = useApiMutationVoid(`/api/v1/inventory/categories/${deletingCat?.id ?? ''}`, 'DELETE');

  const whSaving = createWhMutation.isPending || updateWhMutation.isPending;
  const whDeleteBusy = deleteWhMutation.isPending;
  const locSaving = createLocMutation.isPending || updateLocMutation.isPending;
  const locDeleteBusy = deleteLocMutation.isPending;
  const catSaving = createCatMutation.isPending || updateCatMutation.isPending;

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
      resetWh(fromWarehouse(warehouse));
    } else {
      setEditingWhId(null);
      resetWh(emptyWarehouse);
    }
    setWhError(null);
    setWhOpen(true);
  };

  const submitWarehouse = submitWhForm((values) => {
    setWhError(null);
    const onSuccess = () => {
      toast.toast(editingWhId ? 'Warehouse updated.' : 'Warehouse created.');
      setWhOpen(false);
      void invalidate(['paged', '/api/v1/inventory/warehouses']);
    };
    const onError = (err: { message: string }) => setWhError(err.message);
    if (editingWhId) {
      updateWhMutation.mutate(warehouseToDto(values), { onSuccess, onError });
    } else {
      createWhMutation.mutate(warehouseToDto(values), { onSuccess, onError });
    }
  });

  const confirmDeleteWh = () => {
    if (!deletingWh) return;
    deleteWhMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast('Warehouse deactivated.');
        setDeletingWh(null);
        void invalidate(['paged', '/api/v1/inventory/warehouses']);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeletingWh(null);
      },
    });
  };

  const openLocation = (location?: WarehouseLocation) => {
    if (location) {
      setEditingLocId(location.id);
      resetLoc(fromLocation(location));
    } else {
      setEditingLocId(null);
      resetLoc(emptyLocation);
    }
    setLocError(null);
    setLocOpen(true);
  };

  const submitLocation = submitLocForm((values) => {
    if (!locationsFor) return;
    setLocError(null);
    const onSuccess = () => {
      toast.toast(editingLocId ? 'Location updated.' : 'Location added.');
      setLocOpen(false);
      void loadLocations(locationsFor);
    };
    const onError = (err: { message: string }) => setLocError(err.message);
    if (editingLocId) {
      updateLocMutation.mutate(locationToDto(values), { onSuccess, onError });
    } else {
      createLocMutation.mutate(locationToDto(values), { onSuccess, onError });
    }
  });

  const confirmDeleteLoc = () => {
    if (!deletingLoc || !locationsFor) return;
    deleteLocMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast('Location deactivated.');
        setDeletingLoc(null);
        void loadLocations(locationsFor);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeletingLoc(null);
      },
    });
  };

  const openCategory = (category?: Category) => {
    if (category) {
      setEditingCatId(category.id);
      resetCat(fromCategory(category));
    } else {
      setEditingCatId(null);
      resetCat(emptyCategory);
    }
    setCatError(null);
    setCatOpen(true);
  };

  const submitCategory = submitCatForm((values) => {
    setCatError(null);
    const onSuccess = () => {
      toast.toast(editingCatId ? 'Category updated.' : 'Category created.');
      setCatOpen(false);
      void invalidate(['paged', '/api/v1/inventory/categories']);
    };
    const onError = (err: { message: string }) => setCatError(err.message);
    if (editingCatId) {
      updateCatMutation.mutate(categoryToDto(values), { onSuccess, onError });
    } else {
      createCatMutation.mutate(categoryToDto(values), { onSuccess, onError });
    }
  });

  const confirmDeleteCat = () => {
    if (!deletingCat) return;
    deleteCatMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast('Category deleted.');
        setDeletingCat(null);
        void invalidate(['paged', '/api/v1/inventory/categories']);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeletingCat(null);
      },
    });
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

      <Dialog open={whOpen} onOpenChange={(open) => !whSaving && setWhOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingWhId ? 'Edit warehouse' : 'New warehouse'} />
          <form onSubmit={(event) => void submitWarehouse(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="wh-code">Code *</label>
                <input id="wh-code" {...registerWh('code')} />
                {whErrors.code ? <div className="field-error">{whErrors.code.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="wh-name">Name *</label>
                <input id="wh-name" {...registerWh('name')} />
                {whErrors.name ? <div className="field-error">{whErrors.name.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="wh-address">Address</label>
                <textarea id="wh-address" rows={2} {...registerWh('address')} />
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="wh-active"
                    checked={whActive}
                    onCheckedChange={(checked) => setWhValue('active', checked === true)}
                  />
                  <label htmlFor="wh-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            {whError ? <div className="error-banner">{whError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={whSaving}>
                {whSaving ? 'Saving…' : editingWhId ? 'Save changes' : 'Create warehouse'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={locationsFor !== null} onOpenChange={(open) => !open && setLocationsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={`Locations · ${locationsFor?.name ?? ''}`} />
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
        </DialogContent>
      </Dialog>

      <Dialog open={locOpen} onOpenChange={(open) => !locSaving && setLocOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingLocId ? 'Edit location' : 'Add location'} />
          <form onSubmit={(event) => void submitLocation(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="loc-code">Code *</label>
                <input id="loc-code" {...registerLoc('code')} />
                {locErrors.code ? <div className="field-error">{locErrors.code.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="loc-name">Name *</label>
                <input id="loc-name" {...registerLoc('name')} />
                {locErrors.name ? <div className="field-error">{locErrors.name.message}</div> : null}
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="loc-active"
                    checked={locActive}
                    onCheckedChange={(checked) => setLocValue('active', checked === true)}
                  />
                  <label htmlFor="loc-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            {locError ? <div className="error-banner">{locError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={locSaving}>
                {locSaving ? 'Saving…' : editingLocId ? 'Save changes' : 'Add location'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={(open) => !catSaving && setCatOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingCatId ? 'Edit category' : 'New category'} />
          <form onSubmit={(event) => void submitCategory(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="cat-name">Name *</label>
                <input id="cat-name" {...registerCat('name')} />
                {catErrors.name ? <div className="field-error">{catErrors.name.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="cat-parent">Parent</label>
                <select id="cat-parent" {...registerCat('parentId')}>
                  <option value="">— Root —</option>
                  {categoryData?.data.map((category) =>
                    category.id !== editingCatId ? (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ) : null,
                  )}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="cat-active"
                    checked={catActive}
                    onCheckedChange={(checked) => setCatValue('active', checked === true)}
                  />
                  <label htmlFor="cat-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            {catError ? <div className="error-banner">{catError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={catSaving}>
                {catSaving ? 'Saving…' : editingCatId ? 'Save changes' : 'Create category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingWh !== null}
        onOpenChange={(open) => !whDeleteBusy && !open && setDeletingWh(null)}
      >
        <DialogContent>
          <DialogHeader title="Deactivate warehouse" description={`Deactivate "${deletingWh?.name}"?`} />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={whDeleteBusy} onClick={() => void confirmDeleteWh()}>
              {whDeleteBusy ? 'Working…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingCat !== null}
        onOpenChange={(open) => !open && setDeletingCat(null)}
      >
        <DialogContent>
          <DialogHeader title="Delete category" description={`Delete "${deletingCat?.name}"?`} />
          <DialogFooter>
            <Button variant="danger" type="button" onClick={() => void confirmDeleteCat()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingLoc !== null}
        onOpenChange={(open) => !locDeleteBusy && !open && setDeletingLoc(null)}
      >
        <DialogContent>
          <DialogHeader title="Deactivate location" description={`Deactivate "${deletingLoc?.name}"?`} />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={locDeleteBusy} onClick={() => void confirmDeleteLoc()}>
              {locDeleteBusy ? 'Working…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
