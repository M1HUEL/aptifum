import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ReordersService } from '../src/modules/purchasing/reorders.service.js';

const TENANT = '00000000-0000-4000-8000-000000000001';
const WAREHOUSE = '00000000-0000-4000-8000-0000000000a1';
const SUPPLIER_A = '00000000-0000-4000-8000-0000000000b1';
const SUPPLIER_B = '00000000-0000-4000-8000-0000000000b2';

const ROWS = [
  {
    productId: 'p1',
    sku: 'SKU-A',
    name: 'Product A',
    unitOfMeasure: 'unit',
    total_quantity: '2.0000',
    reserved_quantity: '1.0000',
    reorder_point: '10.0000',
    target_quantity: '20.0000',
    supplier_id: SUPPLIER_A,
    supplier_name: 'Supplier A',
    estimated_unit_cost: '5.50',
    lead_time_days: '3',
  },
  {
    productId: 'p2',
    sku: 'SKU-B',
    name: 'Product B',
    unitOfMeasure: 'kg',
    total_quantity: '0.0000',
    reserved_quantity: '0.0000',
    reorder_point: '5.0000',
    target_quantity: null,
    supplier_id: null,
    supplier_name: null,
    estimated_unit_cost: '1.00',
    lead_time_days: null,
  },
  {
    productId: 'p3',
    sku: 'SKU-C',
    name: 'Product C',
    unitOfMeasure: 'unit',
    total_quantity: '4.0000',
    reserved_quantity: '0.0000',
    reorder_point: '8.0000',
    target_quantity: '12.0000',
    supplier_id: SUPPLIER_B,
    supplier_name: 'Supplier B',
    estimated_unit_cost: '2.00',
    lead_time_days: '7',
  },
];

function buildService(
  dataSourceQuery: ReturnType<typeof vi.fn>,
  createImpl?: (tenantId: string | null, dto: unknown) => Promise<unknown>,
) {
  const poService = { create: vi.fn(createImpl ?? (async () => ({ id: 'o1', number: 'PO-1' }))) };
  const warehousesRepo = { findOne: vi.fn().mockResolvedValue({ id: WAREHOUSE }) };
  const service = new ReordersService(warehousesRepo as never, { query: dataSourceQuery } as never, poService as never);
  return { service, poService, warehousesRepo };
}

describe('ReordersService', () => {
  it('maps raw rows to suggestions with computed gaps', async () => {
    const query = vi.fn().mockResolvedValue(ROWS);
    const { service } = buildService(query);

    const result = await service.suggestions(TENANT);
    expect(result.data).toHaveLength(3);

    const [first, second] = result.data;
    if (!first || !second) throw new Error('expected two suggestions');
    expect(first.availableQuantity).toBe(1);
    expect(first.suggestedQuantity).toBe(19);
    expect(first.supplierId).toBe(SUPPLIER_A);
    expect(second.targetQuantity).toBe(5);
    expect(second.suggestedQuantity).toBe(5);
    expect(second.supplierId).toBeNull();

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([TENANT]);
  });

  it('scopes the query by warehouse when provided', async () => {
    const query = vi.fn().mockResolvedValue(ROWS);
    const { service } = buildService(query);
    await service.suggestions(null);
    await service.generate(TENANT, { warehouseId: WAREHOUSE });
    expect(query.mock.calls[0]?.[1]).toEqual([]);
    expect(query.mock.calls[1]?.[1]).toEqual([TENANT, WAREHOUSE]);
  });

  it('groups generated orders by supplier and warns for unlinked products', async () => {
    const query = vi.fn().mockResolvedValue(ROWS);
    const created: Array<{ supplierId: string; items: Array<{ productId: string; quantity: number }> }> = [];
    const { service, poService } = buildService(query, async (_tenant, dto) => {
      const typed = dto as { supplierId: string; items: Array<{ productId: string; quantity: number }> };
      created.push(typed);
      return { id: `order-${created.length}`, number: `PO-${created.length}` };
    });

    const result = await service.generate(TENANT, { warehouseId: WAREHOUSE });
    expect(created).toHaveLength(2);
    expect(created[0]?.supplierId).toBe(SUPPLIER_A);
    expect(created[0]?.items).toHaveLength(1);
    expect(created[1]?.supplierId).toBe(SUPPLIER_B);
    expect(poService.create).toHaveBeenCalledTimes(2);
    expect(result.data.map((o) => o.number)).toEqual(['PO-1', 'PO-2']);
    expect(result.warnings.map((w) => w.sku)).toEqual(['SKU-B']);
  });

  it('filters by productIds when provided', async () => {
    const query = vi.fn().mockResolvedValue(ROWS);
    const { service, poService } = buildService(query, async () => ({ id: 'o', number: 'PO' }));

    await service.generate(TENANT, { warehouseId: WAREHOUSE, productIds: ['p1'] });
    expect(poService.create).toHaveBeenCalledTimes(1);
  });

  it('rejects generation when nothing is selected or available', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const { service } = buildService(query);
    await expect(service.generate(TENANT, { warehouseId: WAREHOUSE })).rejects.toThrow(BadRequestException);
  });
});
