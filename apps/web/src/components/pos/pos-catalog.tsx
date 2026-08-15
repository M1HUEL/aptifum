import { type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Paginated, PosProduct, Warehouse } from '../../api/types';
import { Badge, EmptyState, ErrorBanner, formatMoney, LoadingBlock, Pagination } from '../ui';

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
        <select className="rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          id="pos-warehouse"
          value={warehouseId}
          onChange={(event) => onWarehouseChange(event.target.value)}
        >
          <option value="">{t('pos.selectWarehouse')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>
      <form className="mb-4 flex gap-2.5" onSubmit={onSubmitSearch}>
        <input
          className="max-w-[320px] flex-1 w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          type="search"
          placeholder={t('pos.searchPlaceholder')}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button type="submit" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50">
          {t('common.search')}
        </button>
      </form>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && catalog && catalog.data.length === 0 ? (
        <EmptyState message={t('pos.noProducts')} />
      ) : null}
      {!loading && catalog && catalog.data.length > 0 ? (
        <>
          <div className="mb-3.5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
            {catalog.data.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex min-h-[96px] flex-col items-start gap-1 p-3 text-left hover:border-primary hover:shadow-[0_0_0_3px_rgba(47,95,230,0.15)]"
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
            ))}
          </div>
          <Pagination
            page={catalog.meta.page}
            limit={catalog.meta.limit}
            total={catalog.meta.total}
            onPage={onPage}
          />
        </>
      ) : null}
    </div>
  );
}
