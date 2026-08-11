import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Brackets } from 'typeorm';
import { ProductStock } from '@aptifum/database';
import { StockService } from '../src/modules/inventory/stock.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function qbChain(rows: unknown[], total: number) {
  return {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
    getCount: vi.fn().mockResolvedValue(total),
  };
}

function buildService(repos: Record<string, Record<string, unknown>>) {
  return new StockService(
    (repos.dataSource ?? {}) as never,
    (repos.stock ?? {}) as never,
    (repos.movements ?? {}) as never,
    (repos.products ?? {}) as never,
    (repos.warehouses ?? {}) as never,
    (repos.locations ?? {}) as never,
  );
}

describe('StockService listPosProducts', () => {
  it('requires a tenant', async () => {
    const service = buildService({});
    await expect(service.listPosProducts(null, 'w1', 1, 20)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown warehouse', async () => {
    const service = buildService({
      warehouses: { findOneBy: vi.fn().mockResolvedValue(null) },
    });
    await expect(service.listPosProducts(TENANT, 'w1', 1, 20)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns products with available stock and numeric price', async () => {
    const qb = qbChain(
      [
        {
          id: 'p1',
          sku: 'SKU-1',
          name: 'Espresso',
          barcode: '75010001',
          unitOfMeasure: 'unit',
          categoryId: null,
          salePrice: '5.00',
          availableStock: '8',
        },
      ],
      1,
    );
    const products = { createQueryBuilder: vi.fn(() => qb) };
    const service = buildService({
      warehouses: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      products,
    });

    const result = await service.listPosProducts(TENANT, 'w1', 1, 20);

    expect(products.createQueryBuilder).toHaveBeenCalledWith('product');
    expect(qb.leftJoin).toHaveBeenCalledWith(
      ProductStock,
      'stock',
      expect.stringContaining('stock.warehouse_id = :warehouseId'),
      { warehouseId: 'w1', tenantId: TENANT },
    );
    expect(qb.where).toHaveBeenCalledWith('product.tenant_id = :tenantId', {
      tenantId: TENANT,
    });
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'p1',
      salePrice: 5,
      availableStock: 8,
    });
  });

  it('searches by name, sku or barcode when q is provided', async () => {
    const qb = qbChain([], 0);
    const service = buildService({
      warehouses: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      products: { createQueryBuilder: vi.fn(() => qb) },
    });

    await service.listPosProducts(TENANT, 'w1', 1, 20, 'cafe');

    const filterCall = qb.andWhere.mock.calls.find(
      (call: unknown[]) => call[0] instanceof Brackets,
    );
    expect(filterCall).toBeTruthy();
    const sub = {
      where: vi.fn().mockReturnThis(),
      orWhere: vi.fn().mockReturnThis(),
    };
    const bracket = (filterCall as unknown[])[0] as Brackets;
    bracket.whereFactory(sub as never);
    expect(sub.where).toHaveBeenCalledWith(expect.stringContaining('product.name ILIKE'), {
      q: '%cafe%',
    });
    expect(sub.orWhere).toHaveBeenCalledWith(expect.stringContaining('product.barcode ILIKE'), {
      q: '%cafe%',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('product.enabled = true');
  });

  it('paginates with skip and take', async () => {
    const qb = qbChain([], 0);
    const service = buildService({
      warehouses: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      products: { createQueryBuilder: vi.fn(() => qb) },
    });

    await service.listPosProducts(TENANT, 'w1', 2, 50);

    expect(qb.skip).toHaveBeenCalledWith(50);
    expect(qb.take).toHaveBeenCalledWith(50);
    expect(qb.orderBy).toHaveBeenCalledWith('product.name', 'ASC');
  });
});
