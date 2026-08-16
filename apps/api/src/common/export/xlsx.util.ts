import ExcelJS from 'exceljs';
import type { Response } from 'express';

const MAX_COLUMN_WIDTH = 40;

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && /^[=\-+@]/.test(value)) return `'${value}`;
  return value as string | number | boolean;
}

export async function toXlsxBuffer(rows: Array<Record<string, unknown>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Export');
  const keys = rows.length ? Array.from(new Set(rows.flatMap((row) => Object.keys(row)))) : [];

  if (keys.length) {
    const headerRow = sheet.addRow(keys);
    headerRow.font = { bold: true };
    headerRow.height = 20;
    keys.forEach((key, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCE6F1' },
      };
      const maxLength = Math.max(key.length, ...rows.map((row) => String(row[key] ?? '').length));
      sheet.getColumn(index + 1).width = Math.min(Math.max(maxLength + 2, 10), MAX_COLUMN_WIDTH);
    });
  }

  for (const row of rows) {
    sheet.addRow(keys.map((key) => normalizeCell(row[key])));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function sectionsToXlsxBuffer(
  sections: Array<{ section: string; rows: Array<Record<string, unknown>> }>,
): Promise<Buffer> {
  const flat: Array<Record<string, unknown>> = [];
  for (const { section, rows } of sections) {
    for (const row of rows) {
      flat.push({ section, ...row });
    }
  }
  return toXlsxBuffer(flat);
}

export function setXlsxHeaders(res: Response, filename: string): void {
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
}
