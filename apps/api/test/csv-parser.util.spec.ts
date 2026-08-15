import { describe, expect, it } from 'vitest';
import { CsvParseError, parseCsv } from '../src/common/import/csv-parser.util';

describe('parseCsv', () => {
  it('returns an empty result for an empty file', () => {
    const parsed = parseCsv('');
    expect(parsed.headers).toEqual([]);
    expect(parsed.rows).toEqual([]);
    expect(parsed.rowNumbers).toEqual([]);
  });

  it('parses headers and rows, normalizing header names', () => {
    const parsed = parseCsv('SKU,Name,Unit of Measure\nA1,Widget,unit\n');
    expect(parsed.headers).toEqual(['sku', 'name', 'unit_of_measure']);
    expect(parsed.rows).toEqual([
      { sku: 'A1', name: 'Widget', unit_of_measure: 'unit' },
    ]);
    expect(parsed.rowNumbers).toEqual([2]);
  });

  it('handles CRLF line endings and a leading BOM', () => {
    const parsed = parseCsv('\uFEFFsku,name\r\nA2,Thing\r\nB3,Other');
    expect(parsed.headers).toEqual(['sku', 'name']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1]).toEqual({ sku: 'B3', name: 'Other' });
  });

  it('supports quoted fields with commas, quotes and newlines', () => {
    const parsed = parseCsv(
      'name,address\n"Foo, Inc.","Main ""St"" 1"\n"Multi\nline",x',
    );
    expect(parsed.rows[0]).toEqual({ name: 'Foo, Inc.', address: 'Main "St" 1' });
    expect(parsed.rows[1]).toEqual({ name: 'Multi\nline', address: 'x' });
    expect(parsed.rowNumbers[1]).toBe(3);
  });

  it('trims cell whitespace and skips fully blank rows', () => {
    const parsed = parseCsv('sku,name\n  A4  , Widget\n\n ,\nB5,Box');
    expect(parsed.rows).toEqual([
      { sku: 'A4', name: 'Widget' },
      { sku: 'B5', name: 'Box' },
    ]);
    expect(parsed.rowNumbers).toEqual([2, 5]);
  });

  it('reports the physical row number after blank lines', () => {
    const parsed = parseCsv('sku,name\n\nA6,One\n\nB7,Two');
    expect(parsed.rowNumbers).toEqual([3, 5]);
  });

  it('throws on duplicate normalized headers', () => {
    expect(() => parseCsv('sku,SKU\n1,2')).toThrow(CsvParseError);
    expect(() => parseCsv('name, Name\nA,B')).toThrow('Duplicate CSV columns');
  });

  it('throws when a row has more columns than the header', () => {
    expect(() => parseCsv('a,b\n1,2,3')).toThrow(CsvParseError);
    expect(() => parseCsv('a,b\n1,2,3')).toThrow(/Row 2 has 3 columns/);
  });

  it('throws when a row has fewer columns than the header', () => {
    expect(() => parseCsv('a,b\n1')).toThrow(CsvParseError);
  });
});
