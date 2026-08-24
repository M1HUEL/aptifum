import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';

import { MovementType, US_STATES, normalizeRfc, validateEin, validateRfc } from '@aptifum/core';
import { applyStockMovement, Category, Customer, Product, Supplier, Tenant, Warehouse } from '@aptifum/database';

import { CsvParseError, parseCsv, type ParsedCsv } from '../../common/import/csv-parser.util';

export type ImportType = 'products' | 'customers' | 'suppliers' | 'initial-stock';

export interface ImportRowError {
  row: number;
  errors: string[];
}

export interface ImportResult {
  type: ImportType;
  total: number;
  imported: number;
  skipped: number;
  errors: ImportRowError[];
}

const TYPE_COLUMNS: Record<ImportType, { required: string[]; optional: string[] }> = {
  products: {
    required: ['sku', 'name'],
    optional: [
      'category',
      'brand',
      'unit_of_measure',
      'barcode',
      'purchase_price',
      'sale_price',
      'description',
      'enabled',
    ],
  },
  customers: {
    required: ['code', 'trade_name'],
    optional: [
      'legal_name',
      'tax_id',
      'email',
      'phone',
      'address',
      'currency',
      'credit_limit',
      'state',
      'price_category',
      'tax_exempt',
      'active',
    ],
  },
  suppliers: {
    required: ['code', 'trade_name'],
    optional: [
      'legal_name',
      'tax_id',
      'email',
      'phone',
      'address',
      'currency',
      'payment_terms',
      'credit_limit',
      'active',
    ],
  },
  'initial-stock': {
    required: ['sku', 'warehouse', 'quantity'],
    optional: ['unit_cost'],
  },
};

@Injectable()
export class ImportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async importCsv(
    tenantId: string | null,
    userId: string | null,
    type: ImportType,
    buffer: Buffer,
  ): Promise<ImportResult> {
    this.assertTenant(tenantId);

    let parsed: ParsedCsv;
    try {
      parsed = parseCsv(buffer.toString('utf8'));
    } catch (error) {
      if (error instanceof CsvParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    if (parsed.headers.length === 0) {
      throw new BadRequestException('CSV file is empty or missing a header row');
    }

    const columns = TYPE_COLUMNS[type];
    const missing = columns.required.filter((column) => !parsed.headers.includes(column));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }

    const result: ImportResult = {
      type,
      total: parsed.rows.length,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    await this.dataSource.transaction(async (manager) => {
      if (type === 'products') {
        await this.importProducts(manager, tenantId as string, parsed, result);
      } else if (type === 'customers') {
        await this.importCustomers(manager, tenantId as string, parsed, result);
      } else if (type === 'suppliers') {
        await this.importSuppliers(manager, tenantId as string, parsed, result);
      } else if (type === 'initial-stock') {
        await this.importInitialStock(manager, tenantId as string, userId, parsed, result);
      }
    });

    return result;
  }

  private async importProducts(
    manager: EntityManager,
    tenantId: string,
    parsed: ParsedCsv,
    result: ImportResult,
  ): Promise<void> {
    const productsRepo = manager.getRepository(Product);
    const categoriesRepo = manager.getRepository(Category);

    const skus = Array.from(new Set(parsed.rows.map((row) => row.sku ?? '').filter((value) => value !== '')));
    const existing = skus.length
      ? await productsRepo.find({ where: { tenantId, sku: In(skus) }, select: { sku: true } })
      : [];
    const existingSkus = new Set(existing.map((product) => product.sku));

    const categories = await categoriesRepo.find({ where: { tenantId } });
    const categoryByName = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));

    const seen = new Set<string>();

    for (const [i, row] of parsed.rows.entries()) {
      const errors: string[] = [];
      const sku = (row.sku ?? '').trim();
      const name = (row.name ?? '').trim();

      if (sku === '') {
        errors.push('sku is required');
      }
      if (name === '') {
        errors.push('name is required');
      }
      if (sku !== '' && existingSkus.has(sku)) {
        result.skipped++;
        continue;
      }
      if (sku !== '' && seen.has(sku)) {
        result.skipped++;
        continue;
      }
      if (sku !== '') {
        seen.add(sku);
      }

      const purchasePrice = parseOptionalNumber(row.purchase_price, 'purchase_price', errors);
      const salePrice = parseOptionalNumber(row.sale_price, 'sale_price', errors);
      const enabled = parseBoolean(row.enabled, 'enabled', errors) ?? true;

      if (errors.length > 0) {
        result.errors.push({ row: parsed.rowNumbers[i]!, errors });
        continue;
      }

      let categoryId: string | null = null;
      const categoryName = (row.category ?? '').trim();
      if (categoryName !== '') {
        const key = categoryName.toLowerCase();
        let id = categoryByName.get(key);
        if (!id) {
          const created = await categoriesRepo.save(
            categoriesRepo.create({
              tenantId,
              name: categoryName,
              parentId: null,
              active: true,
            }),
          );
          id = created.id;
          categoryByName.set(key, id);
        }
        categoryId = id;
      }

      await productsRepo.save(
        productsRepo.create({
          tenantId,
          sku,
          name,
          description: emptyToNull(row.description),
          categoryId,
          brand: emptyToNull(row.brand),
          unitOfMeasure: (row.unit_of_measure ?? '').trim() || 'unit',
          barcode: emptyToNull(row.barcode),
          imageUrl: null,
          purchasePrice: purchasePrice ?? 0,
          salePrice: salePrice ?? 0,
          enabled,
        }),
      );
      result.imported++;
    }
  }

  private async importCustomers(
    manager: EntityManager,
    tenantId: string,
    parsed: ParsedCsv,
    result: ImportResult,
  ): Promise<void> {
    const customersRepo = manager.getRepository(Customer);
    const tenantsRepo = manager.getRepository(Tenant);
    const tenant = await tenantsRepo.findOneBy({ id: tenantId });
    const country = tenant?.country ?? 'US';

    const codes = Array.from(new Set(parsed.rows.map((row) => row.code ?? '').filter((value) => value !== '')));
    const existing = codes.length
      ? await customersRepo.find({ where: { tenantId, code: In(codes) }, select: { code: true } })
      : [];
    const existingCodes = new Set(existing.map((customer) => customer.code));

    const seen = new Set<string>();

    for (const [i, row] of parsed.rows.entries()) {
      const errors: string[] = [];
      const code = (row.code ?? '').trim();
      const tradeName = (row.trade_name ?? '').trim();

      if (code === '') {
        errors.push('code is required');
      }
      if (tradeName === '') {
        errors.push('trade_name is required');
      }
      if (code !== '' && existingCodes.has(code)) {
        result.skipped++;
        continue;
      }
      if (code !== '' && seen.has(code)) {
        result.skipped++;
        continue;
      }
      if (code !== '') {
        seen.add(code);
      }

      let taxId: string | null = null;
      const rawTaxId = (row.tax_id ?? '').trim();
      if (rawTaxId !== '') {
        const resolved = resolveTaxId(country, rawTaxId);
        if (resolved.ok) {
          taxId = resolved.value;
        } else {
          errors.push(resolved.message);
        }
      }

      const creditLimit = parseOptionalNumber(row.credit_limit, 'credit_limit', errors);
      const taxExempt = parseBoolean(row.tax_exempt, 'tax_exempt', errors) ?? false;
      const active = parseBoolean(row.active, 'active', errors) ?? true;
      const currency = (row.currency ?? '').trim().toUpperCase() || 'USD';
      if (currency.length !== 3) {
        errors.push('currency must be a 3-letter code');
      }

      let state: string | null = null;
      const rawState = (row.state ?? '').trim().toUpperCase();
      if (rawState !== '') {
        if (country === 'US' && !(rawState in US_STATES)) {
          errors.push(`invalid state code: ${rawState}`);
        } else {
          state = rawState;
        }
      }

      if (errors.length > 0) {
        result.errors.push({ row: parsed.rowNumbers[i]!, errors });
        continue;
      }

      await customersRepo.save(
        customersRepo.create({
          tenantId,
          code,
          tradeName,
          legalName: emptyToNull(row.legal_name),
          taxId,
          usoCfdi: null,
          regimenFiscal: null,
          email: emptyToNull(row.email),
          phone: emptyToNull(row.phone),
          address: emptyToNull(row.address),
          currency,
          creditLimit: creditLimit ?? 0,
          priceCategory: emptyToNull(row.price_category),
          state,
          taxExempt,
          active,
        }),
      );
      result.imported++;
    }
  }

  private async importSuppliers(
    manager: EntityManager,
    tenantId: string,
    parsed: ParsedCsv,
    result: ImportResult,
  ): Promise<void> {
    const suppliersRepo = manager.getRepository(Supplier);

    const codes = Array.from(new Set(parsed.rows.map((row) => row.code ?? '').filter((value) => value !== '')));
    const existing = codes.length
      ? await suppliersRepo.find({ where: { tenantId, code: In(codes) }, select: { code: true } })
      : [];
    const existingCodes = new Set(existing.map((supplier) => supplier.code));

    const seen = new Set<string>();

    for (const [i, row] of parsed.rows.entries()) {
      const errors: string[] = [];
      const code = (row.code ?? '').trim();
      const tradeName = (row.trade_name ?? '').trim();

      if (code === '') {
        errors.push('code is required');
      }
      if (tradeName === '') {
        errors.push('trade_name is required');
      }
      if (code !== '' && existingCodes.has(code)) {
        result.skipped++;
        continue;
      }
      if (code !== '' && seen.has(code)) {
        result.skipped++;
        continue;
      }
      if (code !== '') {
        seen.add(code);
      }

      const creditLimit = parseOptionalNumber(row.credit_limit, 'credit_limit', errors);
      const active = parseBoolean(row.active, 'active', errors) ?? true;
      const currency = (row.currency ?? '').trim().toUpperCase() || 'USD';
      if (currency.length !== 3) {
        errors.push('currency must be a 3-letter code');
      }

      if (errors.length > 0) {
        result.errors.push({ row: parsed.rowNumbers[i]!, errors });
        continue;
      }

      await suppliersRepo.save(
        suppliersRepo.create({
          tenantId,
          code,
          tradeName,
          legalName: emptyToNull(row.legal_name),
          taxId: emptyToNull(row.tax_id),
          email: emptyToNull(row.email),
          phone: emptyToNull(row.phone),
          address: emptyToNull(row.address),
          currency,
          paymentTerms: emptyToNull(row.payment_terms),
          creditLimit: creditLimit ?? 0,
          active,
        }),
      );
      result.imported++;
    }
  }

  private async importInitialStock(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    parsed: ParsedCsv,
    result: ImportResult,
  ): Promise<void> {
    const productsRepo = manager.getRepository(Product);
    const warehousesRepo = manager.getRepository(Warehouse);

    const skus = Array.from(new Set(parsed.rows.map((row) => row.sku ?? '').filter((value) => value !== '')));
    const products = skus.length
      ? await productsRepo.find({
          where: { tenantId, sku: In(skus) },
          select: { id: true, sku: true },
        })
      : [];
    const productBySku = new Map(products.map((product) => [product.sku, product.id]));

    const codes = Array.from(new Set(parsed.rows.map((row) => row.warehouse ?? '').filter((value) => value !== '')));
    const warehouses = codes.length
      ? await warehousesRepo.find({
          where: { tenantId, code: In(codes) },
          select: { id: true, code: true },
        })
      : [];
    const warehouseByCode = new Map(warehouses.map((warehouse) => [warehouse.code, warehouse.id]));

    for (const [i, row] of parsed.rows.entries()) {
      const errors: string[] = [];
      const sku = (row.sku ?? '').trim();
      const warehouseCode = (row.warehouse ?? '').trim();

      if (sku === '') {
        errors.push('sku is required');
      }
      if (warehouseCode === '') {
        errors.push('warehouse is required');
      }

      const quantity = parseNumber(row.quantity, 'quantity', errors, true);
      const unitCost = parseOptionalNumber(row.unit_cost, 'unit_cost', errors);

      if (sku !== '' && !productBySku.has(sku)) {
        errors.push(`product not found: ${sku}`);
      }
      if (warehouseCode !== '' && !warehouseByCode.has(warehouseCode)) {
        errors.push(`warehouse not found: ${warehouseCode}`);
      }

      if (errors.length > 0 || quantity === null) {
        result.errors.push({ row: parsed.rowNumbers[i]!, errors });
        continue;
      }

      await applyStockMovement(manager, {
        tenantId,
        movementType: MovementType.INBOUND,
        productId: productBySku.get(sku) as string,
        variantId: null,
        warehouseId: warehouseByCode.get(warehouseCode) as string,
        locationId: null,
        quantity,
        unitCost: unitCost ?? 0,
        referenceType: 'import',
        userId,
      });
      result.imported++;
    }
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function toNumber(raw: string): number {
  let value = raw.trim();
  if (value.includes(',') && !value.includes('.')) {
    value = value.replace(',', '.');
  } else {
    value = value.replace(/,/g, '');
  }
  return Number(value);
}

function parseOptionalNumber(raw: string | undefined, field: string, errors: string[]): number | null {
  const value = (raw ?? '').trim();
  if (value === '') {
    return null;
  }
  const num = toNumber(value);
  if (!Number.isFinite(num) || num < 0) {
    errors.push(`${field} must be a non-negative number`);
    return null;
  }
  return num;
}

function parseNumber(raw: string | undefined, field: string, errors: string[], positive = false): number | null {
  const value = (raw ?? '').trim();
  if (value === '') {
    errors.push(`${field} is required`);
    return null;
  }
  const num = toNumber(value);
  if (!Number.isFinite(num) || num < 0 || (positive && num <= 0)) {
    errors.push(positive ? `${field} must be a positive number` : `${field} must be a non-negative number`);
    return null;
  }
  return num;
}

function parseBoolean(raw: string | undefined, field: string, errors: string[]): boolean | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '') {
    return null;
  }
  if (['true', '1', 'yes', 'y'].includes(value)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(value)) {
    return false;
  }
  errors.push(`${field} must be a boolean (true/false)`);
  return null;
}

function resolveTaxId(country: string, value: string): { ok: true; value: string } | { ok: false; message: string } {
  if (country === 'MX') {
    if (!validateRfc(value)) {
      return { ok: false, message: 'Invalid Mexican RFC' };
    }
    return { ok: true, value: normalizeRfc(value) };
  }
  if (country === 'US') {
    if (!validateEin(value)) {
      return { ok: false, message: 'Invalid US EIN: expected 9 digits (XX-XXXXXXX)' };
    }
    return { ok: true, value: value.replace(/[\s-]/g, '') };
  }
  return { ok: true, value: value.trim() };
}
