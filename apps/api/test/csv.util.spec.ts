import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { sectionsToCsv, setCsvHeaders, toCsv } from '../src/common/export/csv.util';

describe('toCsv', () => {
  it('returns empty string for empty rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('emits a header row from the union of keys', () => {
    const csv = toCsv([{ a: 1, b: 2 }]);
    expect(csv.split('\r\n')[0]).toBe('a,b');
  });

  it('collects keys across rows even when missing', () => {
    const csv = toCsv([{ a: 1, c: 3 }, { b: 2 }]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('a,c,b');
    expect(lines[1]).toBe('1,3,');
    expect(lines[2]).toBe(',,2');
  });

  it('quotes values containing commas, quotes and newlines', () => {
    const csv = toCsv([{ name: 'Foo, Inc.', note: 'said "hi"', multi: 'a\nb' }]);
    expect(csv).toContain('"Foo, Inc."');
    expect(csv).toContain('"said ""hi"""');
    expect(csv).toContain('"a\nb"');
  });

  it('renders null and undefined as empty cells', () => {
    const csv = toCsv([{ a: null, b: undefined }]);
    expect(csv.split('\r\n')[1]).toBe(',');
  });

  it('prefixes cells starting with = + - @ to prevent formula injection', () => {
    const csv = toCsv([{ formula: '=1+2', plus: '+cmd', minus: '-2', at: '@cmd', normal: 'ok' }]);
    expect(csv.split('\r\n')[1]).toBe("'=1+2,'+cmd,'-2,'@cmd,ok");
  });

  it('neutralizes cells with leading whitespace before a dangerous prefix', () => {
    const csv = toCsv([{ a: '  =HYPERLINK("x")' }]);
    expect(csv.split('\r\n')[1]).toBe('"\'  =HYPERLINK(""x"")"');
  });

  it('still quotes neutralized cells that contain commas', () => {
    const csv = toCsv([{ a: '=1,2' }]);
    expect(csv.split('\r\n')[1]).toBe('"\'=1,2"');
  });

  it('leaves safe values unchanged', () => {
    const csv = toCsv([{ a: 500, b: 'ok', c: ' plain', d: '0.00' }]);
    expect(csv.split('\r\n')[1]).toBe('500,ok, plain,0.00');
  });
});

describe('sectionsToCsv', () => {
  it('flattens sections into rows with a section column', () => {
    const csv = sectionsToCsv([
      { section: 'Revenue', rows: [{ code: '4000', balance: 60 }] },
      { section: 'Expenses', rows: [{ code: '5000', balance: 6 }] },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('section,code,balance');
    expect(lines[1]).toBe('Revenue,4000,60');
    expect(lines[2]).toBe('Expenses,5000,6');
  });
});

describe('setCsvHeaders', () => {
  it('sets content type and disposition on the response', () => {
    const res = { set: vi.fn() } as unknown as Response;
    setCsvHeaders(res, 'report.csv');
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="report.csv"',
    });
  });
});
