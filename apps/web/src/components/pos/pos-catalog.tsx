import { Package } from 'lucide-react';
import { type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { Paginated, PosProduct, Warehouse } from '../../api/types';
import { Badge, EmptyState, ErrorBanner, formatMoney, LoadingBlock, Pagination, Input, Select } from '../ui';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export function PosCatalog({
  warehouses,
  warehouseId,
  onWarehouseChange,
  input,
  onInputChange,
  onSubmitSearch,
  catalog,
  loading,
  error,
  onAddProduct,
  onPage,
}: {
  warehouses: Warehouse[];
  warehouseId: string;
  onWarehouseChange: (value: string) => void;
  input: string;
  onInputChange: (value: string) => void;
  onSubmitSearch: (event: FormEvent) => void;
  catalog: Paginated<PosProduct> | null;
  loading: boolean;
  error: string | null;
  onAddProduct: (product: PosProduct) => void;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <div className="mb-4 flex gap-2.5">
        <Select id="pos-warehouse" value={warehouseId} onChange={(event) => onWarehouseChange(event.target.value)}>
          <option value="">{t('pos.selectWarehouse')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
      </div>
      <form className="mb-4 flex gap-2.5" onSubmit={onSubmitSearch}>
        <Input
          className="max-w-[320px] flex-1 w-full"
          type="search"
          placeholder={t('pos.searchPlaceholder')}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <Button type="submit">{t('common.search')}</Button>
      </form>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && catalog && catalog.data.length === 0 ? (
        <EmptyState message={t('pos.noProducts')} icon={<Package className="size-6" />} />
      ) : null}
      {!loading && catalog && catalog.data.length > 0 ? (
        <>
          <div className="mb-3.5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
            {catalog.data.map((product) => (
              <Card
                asChild
                key={product.id}
                className="mb-0 cursor-pointer p-3 transition-colors hover:border-primary hover:shadow-[0_0_0_3px_rgba(47,95,230,0.15)]"
              >
                <button
                  type="button"
                  className="flex min-h-[96px] flex-col items-start gap-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={product.availableStock <= 0}
                  onClick={() => onAddProduct(product)}
                >
                  <span className="font-semibold leading-[1.25]">{product.name}</span>
                  <span className="text-[12px] text-muted">{product.sku}</span>
                  <span className="mt-1 font-bold">{formatMoney(product.salePrice)}</span>
                  <Badge tone={product.availableStock > 0 ? 'success' : 'neutral'}>
                    {product.availableStock > 0
                      ? t('pos.inStock', { count: product.availableStock })
                      : t('pos.outOfStock')}
                  </Badge>
                </button>
              </Card>
            ))}
          </div>
          <Pagination page={catalog.meta.page} limit={catalog.meta.limit} total={catalog.meta.total} onPage={onPage} />
        </>
      ) : null}
    </div>
  );
}
