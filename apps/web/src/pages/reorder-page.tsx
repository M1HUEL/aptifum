import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApiInvalidation, useApiMutation, useApiQuery } from '../api/hooks';
import type { Paginated } from '../api/types';
import { RequirePermission } from '../auth/require-permission';
import { useToast } from '../components/toast';
import { Badge, DataTable, EmptyState, ErrorBanner, LoadingBlock, PageHeader, Select } from '../components/ui';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

interface ReorderSuggestion {
  productId: string;
  sku: string;
  name: string;
  unitOfMeasure: string;
  availableQuantity: number;
  reorderPoint: number;
  targetQuantity: number;
  suggestedQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  estimatedUnitCost: number;
  leadTimeDays: number | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface GenerateResult {
  data: Array<{ purchaseOrderId: string; number: string; supplierId: string; itemCount: number }>;
  warnings: Array<{ productId: string; sku: string; reason: 'no-supplier-linked' }>;
}

function formatQty(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

export function ReorderPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { invalidate } = useApiInvalidation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [warehouseId, setWarehouseId] = useState('');

  const { data, error, isLoading, refetch } = useApiQuery<{ data: ReorderSuggestion[] }>(
    ['reorders'],
    '/api/v1/purchasing/reorders',
  );
  const { data: warehousesData } = useApiQuery<Paginated<Warehouse>>(
    ['warehouses', 'reorder-page'],
    '/api/v1/inventory/warehouses?page=1&limit=100',
  );

  useEffect(() => {
    if (!warehouseId && warehousesData?.data.length) {
      setWarehouseId(warehousesData.data[0]?.id ?? '');
    }
  }, [warehousesData, warehouseId]);

  const generateMutation = useApiMutation<{ warehouseId: string; productIds?: string[] }, GenerateResult>(
    '/api/v1/purchasing/reorders/generate',
    'POST',
  );

  const suggestions = useMemo(() => data?.data ?? [], [data]);

  const toggle = (productId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const allSelected = suggestions.length > 0 && selected.size === suggestions.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(suggestions.map((s) => s.productId)));
  };

  const handleGenerate = () => {
    if (!warehouseId) {
      toast.toast(t('reorder.warehouseRequired'), 'error');
      return;
    }
    if (selected.size === 0) {
      toast.toast(t('reorder.selectFirst'), 'error');
      return;
    }
    generateMutation.mutate(
      { warehouseId, productIds: [...selected] },
      {
        onSuccess: (result) => {
          toast.toast(t('reorder.generated', { count: result.data.length }));
          if (result.warnings.length > 0) {
            toast.toast(t('reorder.noneLinked', { count: result.warnings.length }), 'error');
          }
          setSelected(new Set());
          void invalidate(['paged', '/api/v1/purchasing/purchase-orders']);
          void refetch();
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
        },
      },
    );
  };

  const columns = [
    {
      key: 'select',
      header: '',
      render: (row: ReorderSuggestion) => (
        <input
          type="checkbox"
          aria-label={row.sku}
          checked={selected.has(row.productId)}
          onChange={() => toggle(row.productId)}
        />
      ),
    },
    { key: 'sku', header: t('reorder.product'), sortValue: (row: ReorderSuggestion) => row.sku },
    { key: 'name', header: '' },
    {
      key: 'availableQuantity',
      header: t('reorder.stock'),
      render: (row: ReorderSuggestion) => `${formatQty(row.availableQuantity)} ${row.unitOfMeasure}`,
      sortValue: (row: ReorderSuggestion) => row.availableQuantity,
    },
    {
      key: 'reorderPoint',
      header: t('reorder.point'),
      render: (row: ReorderSuggestion) => formatQty(row.reorderPoint),
      sortValue: (row: ReorderSuggestion) => row.reorderPoint,
    },
    {
      key: 'targetQuantity',
      header: t('reorder.target'),
      render: (row: ReorderSuggestion) => formatQty(row.targetQuantity),
      sortValue: (row: ReorderSuggestion) => row.targetQuantity,
    },
    {
      key: 'suggestedQuantity',
      header: t('reorder.suggested'),
      render: (row: ReorderSuggestion) => <Badge tone="info">{formatQty(row.suggestedQuantity)}</Badge>,
      sortValue: (row: ReorderSuggestion) => row.suggestedQuantity,
    },
    {
      key: 'supplierName',
      header: t('reorder.supplier'),
      render: (row: ReorderSuggestion) => row.supplierName ?? <Badge tone="warning">{t('reorder.noSupplier')}</Badge>,
    },
    {
      key: 'estimatedUnitCost',
      header: t('reorder.unitCost'),
      render: (row: ReorderSuggestion) => formatQty(row.estimatedUnitCost),
      sortValue: (row: ReorderSuggestion) => row.estimatedUnitCost,
    },
    {
      key: 'leadTimeDays',
      header: t('reorder.leadTime'),
      render: (row: ReorderSuggestion) =>
        row.leadTimeDays === null ? '—' : t('reorder.days', { days: row.leadTimeDays }),
      sortValue: (row: ReorderSuggestion) => row.leadTimeDays ?? -1,
    },
  ];

  return (
    <RequirePermission permission="purchasing:read">
      <PageHeader title={t('reorder.title')} subtitle={t('reorder.subtitle')} />
      {error ? <ErrorBanner message={error.message} /> : null}
      {isLoading ? (
        <LoadingBlock />
      ) : suggestions.length === 0 ? (
        <EmptyState
          icon={<span aria-hidden="true">📦</span>}
          message={`${t('reorder.emptyTitle')} — ${t('reorder.emptyBody')}`}
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between gap-4 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              {t('reorder.all')}
            </label>
            <div className="flex items-center gap-3">
              <Select
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                aria-label={t('reorder.title')}
              >
                {(warehousesData?.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
              <Button onClick={() => handleGenerate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? t('reorder.generating') : t('reorder.generate')}
              </Button>
            </div>
          </div>
          <DataTable columns={columns} rows={suggestions} rowKey={(row) => row.productId} />
        </Card>
      )}
    </RequirePermission>
  );
}
