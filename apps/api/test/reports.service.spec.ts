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
    await expect(service.stockMovements(TENANT, { movementType: 'banana' })).rejects.toThrow(BadRequestException);
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
    await expect(service.salesSummary(TENANT, { groupBy: 'hour' })).rejects.toThrow(BadRequestException);
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
    const query = vi
      .fn()
      .mockResolvedValue([])
      .mockResolvedValue([{ total: 0 }]);
    const service = buildService(query);
    const result = await service.stockMovements(TENANT, { movementType: 'inbound' });
    expect(result.meta.total).toBe(0);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('sm.movement_type = $');
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

describe('ReportsService cashFlow', () => {
  it('buckets cash movements by month and computes running balance', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { period: '2026-08', debit: '100.00', credit: '20.00' },
        { period: '2026-09', debit: '50.00', credit: '0.00' },
      ])
      .mockResolvedValueOnce([{ balance: '500.00' }]);
    const service = buildService(query);
    const result = await service.cashFlow(TENANT, { from: '2026-08-01' });
    expect(result.openingBalance).toBe(500);
    expect(result.data).toEqual([
      { period: '2026-08', inflows: 100, outflows: 20, net: 80, balance: 580 },
      { period: '2026-09', inflows: 50, outflows: 0, net: 50, balance: 630 },
    ]);
    expect(result.totals).toEqual({ inflows: 150, outflows: 20, net: 130 });
    expect(result.closingBalance).toBe(630);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("ca.code = '1000'");
    expect(sql).toContain('GROUP BY to_char');
  });

  it('returns zero opening balance when no from is provided', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const service = buildService(query);
    const result = await service.cashFlow(TENANT, {});
    expect(result.openingBalance).toBe(0);
    expect(result.closingBalance).toBe(0);
    expect(result.data).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('ReportsService payrollSummary aggregation', () => {
  it('groups payrolls by period and sums money', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        period: '2026-08',
        payrolls: '2',
        total_gross: '2300.00',
        total_deductions: '120.00',
        total_net: '2180.00',
      },
      {
        period: '2026-07',
        payrolls: '1',
        total_gross: '1150.00',
        total_deductions: '60.00',
        total_net: '1090.00',
      },
    ]);
    const service = buildService(query);
    const result = await service.payrollSummary(TENANT, {});
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      period: '2026-08',
      payrolls: 2,
      totalGross: 2300,
      totalDeductions: 120,
      totalNet: 2180,
    });
    expect(result.totals).toEqual({
      payrolls: 3,
      totalGross: 3450,
      totalDeductions: 180,
      totalNet: 3270,
    });
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('GROUP BY hp.period');
    expect(sql).toContain('ORDER BY hp.period');
  });
});
