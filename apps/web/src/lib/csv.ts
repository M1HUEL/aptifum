import type { Column } from '../components/ui';

function toCellValue<T>(row: T, col: Column<T>): string {
  const raw = (row as Record<string, unknown>)[col.key];
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }
  return '';
}

function resolveCell<T>(
  row: T,
  col: Column<T>,
  formatter?: (row: T, col: Column<T>) => string | number | null | undefined,
): string {
  if (formatter) {
    const value = formatter(row, col);
    if (value != null) return String(value);
  }
  if (col.render) {
    const rendered = col.render(row);
    if (typeof rendered === 'string' || typeof rendered === 'number') {
      return String(rendered);
    }
  }
  return toCellValue(row, col);
}

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function exportRowsToCsv<T>(options: {
  filename: string;
  columns: Column<T>[];
  rows: T[];
  formatter?: (row: T, col: Column<T>) => string | number | null | undefined;
}): void {
  const { filename, columns, rows, formatter } = options;
  const header = columns.map((col) => escapeCell(col.header)).join(';');
  const body = rows.map((row) => columns.map((col) => escapeCell(resolveCell(row, col, formatter))).join(';'));
  const csv = `\uFEFF${[header, ...body].join('\r\n')}`;
  const safeName = `${filename.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
