import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProductVariantsService } from '../src/modules/inventory/product-variants.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '00000000-0000-4000-8000-000000000002';
const VARIANT_ID = '00000000-0000-4000-8000-000000000003';

function buildService(repos: Record<string, Record<string, unknown>>) {
  return new ProductVariantsService(
    (repos.variants ?? {}) as never,
    (repos.products ?? {}) as never,
  );
}

function product(sku = 'SKU-PARENT') {
  return { id: PRODUCT_ID, tenantId: TENANT, sku };
}

function variant(overrides: Record<string, unknown> = {}) {
  return {
    id: VARIANT_ID,
    tenantId: TENANT,
    productId: PRODUCT_ID,
    sku: 'SKU-RED',
    barcode: null,
    attributes: { color: 'red' },
    purchasePrice: 2,
    salePrice: 5,
    ...overrides,
  };
}

describe('ProductVariantsService', () => {
  describe('findAll', () => {
    it('throws NotFound when the product does not exist', async () => {
      const service = buildService({
        products: { findOne: vi.fn().mockResolvedValue(null) },
      });
      await expect(service.findAll(TENANT, PRODUCT_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns variants ordered by createdAt asc', async () => {
      const rows = [variant({ id: 'v1' }), variant({ id: 'v2' })];
      const products = { findOne: vi.fn().mockResolvedValue(product()) };
      const variants = {
        find: vi.fn().mockResolvedValue(rows),
      };
      const service = buildService({ products, variants });

      const result = await service.findAll(TENANT, PRODUCT_ID);

      expect(products.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID, tenantId: TENANT },
      });
      expect(variants.find).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID, tenantId: TENANT },
        order: { createdAt: 'ASC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the variant does not exist', async () => {
      const service = buildService({
        variants: { findOne: vi.fn().mockResolvedValue(null) },
      });
      await expect(service.findOne(TENANT, PRODUCT_ID, VARIANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the variant when found', async () => {
      const row = variant();
      const variants = { findOne: vi.fn().mockResolvedValue(row) };
      const service = buildService({ variants });
      const result = await service.findOne(TENANT, PRODUCT_ID, VARIANT_ID);
      expect(variants.findOne).toHaveBeenCalledWith({
        where: { id: VARIANT_ID, productId: PRODUCT_ID, tenantId: TENANT },
      });
      expect(result).toBe(row);
    });
  });

  describe('create', () => {
    it('requires a tenant', async () => {
      const service = buildService({});
      await expect(
        service.create(null, PRODUCT_ID, { sku: 'SKU-RED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when the product does not exist', async () => {
      const service = buildService({
        products: { findOne: vi.fn().mockResolvedValue(null) },
      });
      await expect(
        service.create(TENANT, PRODUCT_ID, { sku: 'SKU-RED' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a sku that matches the product sku', async () => {
      const products = { findOne: vi.fn().mockResolvedValue(product('SKU-PARENT')) };
      const variants = { findOne: vi.fn().mockResolvedValue(null) };
      const service = buildService({ products, variants });
      await expect(
        service.create(TENANT, PRODUCT_ID, { sku: 'SKU-PARENT' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a sku already used by another variant', async () => {
      const products = { findOne: vi.fn().mockResolvedValue(product()) };
      const variants = {
        findOne: vi.fn().mockResolvedValue(variant({ id: 'other' })),
      };
      const service = buildService({ products, variants });
      await expect(
        service.create(TENANT, PRODUCT_ID, { sku: 'SKU-RED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('saves a new variant with defaults', async () => {
      const products = { findOne: vi.fn().mockResolvedValue(product()) };
      const variants = {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn((data: unknown) => data),
        save: vi.fn((data: unknown) => Promise.resolve(data)),
      };
      const service = buildService({ products, variants });

      const result = await service.create(TENANT, PRODUCT_ID, {
        sku: 'SKU-RED',
        attributes: { color: 'red' },
      });

      expect(variants.save).toHaveBeenCalledWith({
        tenantId: TENANT,
        productId: PRODUCT_ID,
        sku: 'SKU-RED',
        barcode: null,
        attributes: { color: 'red' },
        purchasePrice: 0,
        salePrice: 0,
      });
      expect(result).toMatchObject({ sku: 'SKU-RED', purchasePrice: 0 });
    });
  });

  describe('update', () => {
    it('updates variant fields', async () => {
      const existing = variant();
      const variants = {
        findOne: vi.fn().mockResolvedValue(existing),
        save: vi.fn((data: unknown) => Promise.resolve(data)),
      };
      const products = { findOne: vi.fn().mockResolvedValue(product()) };
      const service = buildService({ variants, products });

      const result = await service.update(TENANT, PRODUCT_ID, VARIANT_ID, {
        salePrice: 9,
        barcode: '750000000000',
      });

      expect(existing).toMatchObject({ salePrice: 9, barcode: '750000000000' });
      expect(variants.save).toHaveBeenCalledWith(existing);
      expect(result).toBe(existing);
    });

    it('checks sku availability only when the sku changes', async () => {
      const existing = variant();
      const variants = {
        findOne: vi.fn().mockResolvedValue(existing),
        save: vi.fn((data: unknown) => Promise.resolve(data)),
      };
      const products = { findOne: vi.fn().mockResolvedValue(product()) };
      const service = buildService({ variants, products });

      await service.update(TENANT, PRODUCT_ID, VARIANT_ID, { salePrice: 9 });

      expect(products.findOne).toHaveBeenCalledTimes(0);
      expect(variants.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('soft deletes the variant', async () => {
      const variants = {
        findOne: vi.fn().mockResolvedValue(variant()),
        softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
      };
      const service = buildService({ variants });

      const result = await service.remove(TENANT, PRODUCT_ID, VARIANT_ID);

      expect(variants.softDelete).toHaveBeenCalledWith({
        id: VARIANT_ID,
        tenantId: TENANT,
      });
      expect(result).toEqual({ id: VARIANT_ID });
    });

    it('throws NotFound when the variant does not exist', async () => {
      const variants = { findOne: vi.fn().mockResolvedValue(null) };
      const service = buildService({ variants });
      await expect(service.remove(TENANT, PRODUCT_ID, VARIANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
