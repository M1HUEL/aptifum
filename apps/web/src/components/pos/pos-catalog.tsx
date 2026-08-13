import { type FormEvent } from 'react';
import type { Paginated, PosProduct, Warehouse } from '../../api/types';
import { Badge, EmptyState, ErrorBanner, formatMoney, LoadingBlock, Pagination } from '../ui';
import { Select } from '../forms';

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
  return (
    <div className="pos-catalog">
      <div className="toolbar">
        <Select
          id="pos-warehouse"
          value={warehouseId}
          onChange={(event) => onWarehouseChange(event.target.value)}
        >
          <option value="">— Select warehouse —</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
      </div>
      <form className="search-form" onSubmit={onSubmitSearch}>
        <input
          type="search"
          placeholder="Search name, SKU or barcode…"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && catalog && catalog.data.length === 0 ? (
        <EmptyState message="No products found for this warehouse." />
      ) : null}
      {!loading && catalog && catalog.data.length > 0 ? (
        <>
          <div className="pos-grid">
            {catalog.data.map((product) => (
              <button
                key={product.id}
                type="button"
                className="pos-product"
                disabled={product.availableStock <= 0}
                onClick={() => onAddProduct(product)}
              >
                <span className="pos-product-name">{product.name}</span>
                <span className="pos-product-sku">{product.sku}</span>
                <span className="pos-product-price">{formatMoney(product.salePrice)}</span>
                <Badge tone={product.availableStock > 0 ? 'success' : 'neutral'}>
                  {product.availableStock > 0 ? `${product.availableStock} in stock` : 'Out of stock'}
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
