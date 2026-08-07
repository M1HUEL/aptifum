import type { Response } from 'express';

const FORMULA_PREFIX = /^[\s]*[=+\-@]/;

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return '';
  }
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown): string => {
    const s = value === null || value === undefined ? '' : String(value);
    const neutralized = FORMULA_PREFIX.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(neutralized) ? `"${neutralized.replace(/"/g, '""')}"` : neutralized;
  };
  const header = keys.map(escape).join(',');
  const body = rows.map((row) => keys.map((key) => escape(row[key])).join(','));
  return [header, ...body].join('\r\n');
}

export interface CsvSection {
  section: string;
  rows: Array<Record<string, unknown>>;
}

export function sectionsToCsv(sections: CsvSection[]): string {
  const flat: Array<Record<string, unknown>> = [];
  for (const { section, rows } of sections) {
    for (const row of rows) {
      flat.push({ section, ...row });
    }
  }
  return toCsv(flat);
}

export function setCsvHeaders(res: Response, filename: string): void {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
}
