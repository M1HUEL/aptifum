import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Brackets } from 'typeorm';
import { StockService } from '../src/modules/inventory/stock.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function qbChain(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
}

function buildService(repos: Record<string, Record<string, unknown>>) {
  return new StockService(
    (repos.dataSource ?? {}) as never,
    (repos.stock ?? {}) as never,
    (repos.movements ?? {}) as never,
    (repos.products ?? {}) as never,
    (repos.variants ?? {}) as never,
    (repos.warehouses ?? {}) as never,
    (repos.locations ?? {}) as never,
  );
}

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    variantId: null,
    sku: 'SKU-1',
    name: 'Espresso',
    barcode: '75010001',
    unitOfMeasure: 'unit',
    categoryId: null,
    salePrice: '5.00',
    availableStock: '8',
    ...overrides,
  };
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

  it('merges products and variants, with numeric price and available stock', async () => {
    const productsQb = qbChain([productRow()]);
    const variantsQb = qbChain([
      productRow({
        id: 'p2',
        variantId: 'v1',
        sku: 'SKU-1-RED',
        name: 'Espresso (Red, M)',
        barcode: null,
        salePrice: '6.50',
        availableStock: '3',
      }),
    ]);
    const products = { createQueryBuilder: vi.fn(() => productsQb).mockReturnValueOnce(productsQb).mockReturnValueOnce(variantsQb) };
    const service = buildService({
      warehouses: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      products,
    });

    const result = await service.listPosProducts(TENANT, 'w1', 1, 20);

    expect(products.createQueryBuilder).toHaveBeenCalledWith('product');
    expect(result.meta.total).toBe(2);
    expect(result.data).toEqual([
      {
        id: 'p1',
        variantId: null,
        sku: 'SKU-1',
        name: 'Espresso',
        barcode: '75010001',
        unitOfMeasure: 'unit',
        categoryId: null,
        salePrice: 5,
        availableStock: 8,
      },
      {
        id: 'p2',
        variantId: 'v1',
        sku: 'SKU-1-RED',
        name: 'Espresso (Red, M)',
        barcode: null,
        unitOfMeasure: 'unit',
        categoryId: null,
        salePrice: 6.5,
        availableStock: 3,
      },
    ]);
  });

  it('searches variants by variant sku or barcode when q is provided', async () => {
    const productsQb = qbChain([]);
    const variantsQb = qbChain([]);
    const products = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValueOnce(productsQb)
        .mockReturnValueOnce(variantsQb),
    };
    const service = buildService({
      warehouses: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      products,
    });

    await service.listPosProducts(TENANT, 'w1', 1, 20, 'red');

    const productFilter = productsQb.andWhere.mock.calls.find(
      (call: unknown[]) => call[0] instanceof Brackets,
    )?.[0];
    const variantFilter = variantsQb.andWhere.mock.calls.find(
      (call: unknown[]) => call[0] instanceof Brackets,
    )?.[0];
    expect(productFilter).toBeTruthy();
    expect(variantFilter).toBeTruthy();
    const sub = {
      where: vi.fn().mockReturnThis(),
      orWhere: vi.fn().mockReturnThis(),
    };
    const productBracket = productFilter as unknown as { whereFactory: (s: never) => void };
    const variantBracket = variantFilter as unknown as { whereFactory: (s: never) => void };
    productBracket.whereFactory(sub as never);
    expect(sub.where).toHaveBeenCalledWith(expect.stringContaining('product.name ILIKE'), {
      q: '%red%',
    });
    variantBracket.whereFactory(sub as never);
    expect(sub.orWhere).toHaveBeenCalledWith(expect.stringContaining('variant.sku ILIKE'), {
      q: '%red%',
    });
  });

  it('paginates the merged catalog in memory', async () => {
    const productsQb = qbChain([
      productRow({ id: 'a', name: 'Alpha' }),
      productRow({ id: 'b', name: 'Bravo' }),
    ]);
    const variantsQb = qbChain([]);
    const products = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValueOnce(productsQb)
        .mockReturnValueOnce(variantsQb),
    };
    const service = buildService({
      warehouses: { findOneBy: vi.fn().mockResolvedValue({ id: 'w1' }) },
      products,
    });

    const result = await service.listPosProducts(TENANT, 'w1', 2, 1);

    expect(result.meta).toEqual({ page: 2, limit: 1, total: 2 });
    expect(result.data[0].name).toBe('Bravo');
  });
});
