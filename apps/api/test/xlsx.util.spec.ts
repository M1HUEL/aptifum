import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { sectionsToXlsxBuffer, setXlsxHeaders, toXlsxBuffer } from '../src/common/export/xlsx.util';

function loadWorkbook(data: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return workbook.xlsx.load(arrayBuffer).then(() => workbook);
}

async function readRows(buffer: Uint8Array): Promise<Array<Record<string, unknown>>> {
  const workbook = await loadWorkbook(buffer);
  const sheet = workbook.getWorksheet(1);
  if (!sheet) return [];
  const rows: Array<Record<string, unknown>> = [];
  sheet.eachRow((row, rowNumber) => {
    const values = row.values as Array<unknown>;
    const cells = values.slice(1) as unknown[];
    if (rowNumber === 1) {
      rows.push({ __header: cells });
    } else {
      const record: Record<string, unknown> = {};
      const header = (rows[0]?.__header as unknown[]) ?? [];
      header.forEach((key, index) => {
        record[String(key)] = cells[index];
      });
      rows.push(record);
    }
  });
  return rows.slice(1);
}

describe('toXlsxBuffer', () => {
  it('produces an empty workbook for empty rows', async () => {
    const buffer = await toXlsxBuffer([]);
    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.getWorksheet(1);
    expect(sheet).toBeDefined();
    expect(sheet?.rowCount).toBe(0);
  });

  it('writes a header row and data cells', async () => {
    const buffer = await toXlsxBuffer([
      { code: 'A1', balance: 60 },
      { code: 'B2', balance: 6.5 },
    ]);
    const rows = await readRows(buffer);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ code: 'A1', balance: 60 });
    expect(rows[1]).toEqual({ code: 'B2', balance: 6.5 });
  });

  it('preserves numeric cells as numbers', async () => {
    const buffer = await toXlsxBuffer([{ qty: 3, amount: 15.99 }]);
    const rows = await readRows(buffer);
    expect(typeof rows[0].qty).toBe('number');
    expect(rows[0].amount).toBe(15.99);
  });

  it('neutralizes formula cells', async () => {
    const buffer = await toXlsxBuffer([{ formula: '=1+2' }]);
    const rows = await readRows(buffer);
    expect(rows[0].formula).toBe("'=1+2");
  });

  it('renders null and undefined as empty cells', async () => {
    const buffer = await toXlsxBuffer([{ a: null, b: undefined, c: 5 }]);
    const rows = await readRows(buffer);
    expect(rows[0].a).toBeUndefined();
    expect(rows[0].b).toBeUndefined();
    expect(rows[0].c).toBe(5);
  });
});

describe('sectionsToXlsxBuffer', () => {
  it('flattens sections into rows with a section column', async () => {
    const buffer = await sectionsToXlsxBuffer([
      { section: 'Revenue', rows: [{ code: '4000', balance: 60 }] },
      { section: 'Expenses', rows: [{ code: '5000', balance: 6 }] },
    ]);
    const rows = await readRows(buffer);
    expect(rows).toEqual([
      { section: 'Revenue', code: '4000', balance: 60 },
      { section: 'Expenses', code: '5000', balance: 6 },
    ]);
  });
});

describe('setXlsxHeaders', () => {
  it('sets content type and disposition on the response', () => {
    const res = { set: vi.fn() } as unknown as Response;
    setXlsxHeaders(res, 'report.xlsx');
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="report.xlsx"',
    });
  });
});
