import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from '../src/modules/reports/reports.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function buildService(query: ReturnType<typeof vi.fn>) {
  const dataSource = { query } as unknown as DataSource;
  return new ReportsService(dataSource);
}

describe('ReportsService validation', () => {
  it('rejects requests without a tenant', async () => {
    const query = vi.fn();
    const service = buildService(query);
    await expect(service.inventoryValuation(null, {})).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an invalid movement type before querying', async () => {
    const query = vi.fn();
    const service = buildService(query);
    await expect(
      service.stockMovements(TENANT, { movementType: 'banana' }),
    ).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a negative low-stock threshold', async () => {
    const query = vi.fn();
    const service = buildService(query);
    await expect(service.lowStock(TENANT, { threshold: -1 })).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an invalid sales summary groupBy', async () => {
    const query = vi.fn();
    const service = buildService(query);
    await expect(service.salesSummary(TENANT, { groupBy: 'hour' })).rejects.toThrow(
      BadRequestException,
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe('ReportsService stockMovements mapping', () => {
  it('maps rows, rounds money and returns pagination meta', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'm1',
          movement_type: 'outbound',
          quantity: -2,
          unit_cost: '1.00',
          occurred_at: '2026-08-01T00:00:00.000Z',
          reference_type: 'invoice',
          reference_id: 'inv1',
          user_id: 'u1',
          notes: null,
          sku: 'RPT-A',
          name: 'Alpha',
          warehouse_code: 'WH1',
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const service = buildService(query);
    const result = await service.stockMovements(TENANT, { limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      movementType: 'outbound',
      quantity: -2,
      unitCost: 1,
      referenceType: 'invoice',
      productSku: 'RPT-A',
      warehouseCode: 'WH1',
    });
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 1 });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('validates a quoted movement type with whitespace-aware filter', async () => {
    const query = vi.fn().mockResolvedValue([]).mockResolvedValue([{ total: 0 }]);
    const service = buildService(query);
    const result = await service.stockMovements(TENANT, { movementType: 'inbound' });
    expect(result.meta.total).toBe(0);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("sm.movement_type = $");
    expect(sql).toContain('ORDER BY sm.occurred_at DESC');
  });
});

describe('ReportsService inventoryValuation aggregation', () => {
  it('sums totals across rows', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        product_id: 'p1',
        sku: 'A',
        name: 'Alpha',
        unit_of_measure: 'kg',
        warehouse_id: 'w1',
        warehouse_code: 'WH1',
        quantity: '100.00',
        average_cost: '1.00',
        value: '100.00',
      },
      {
        product_id: 'p2',
        sku: 'B',
        name: 'Beta',
        unit_of_measure: 'kg',
        warehouse_id: 'w1',
        warehouse_code: 'WH1',
        quantity: '50.00',
        average_cost: '2.00',
        value: '100.00',
      },
    ]);
    const service = buildService(query);
    const result = await service.inventoryValuation(TENANT, {});
    expect(result.data).toHaveLength(2);
    expect(result.totals).toEqual({ quantity: 150, value: 200 });
    expect(result.data[0].value).toBe(100);
  });
});
