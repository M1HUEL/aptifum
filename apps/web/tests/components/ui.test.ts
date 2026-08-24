import { describe, expect, it } from 'vitest';

import { formatDate, formatMoney } from '../../src/components/ui';

describe('formatMoney', () => {
  it('formats USD by default', () => {
    expect(formatMoney(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
  });

  it('formats with the given currency', () => {
    expect(formatMoney(100, 'EUR', 'en-US')).toBe('€100.00');
  });

  it('handles zero', () => {
    expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
  });

  it('handles negative values', () => {
    expect(formatMoney(-42, 'USD', 'en-US')).toBe('-$42.00');
  });

  it('formats USD with the es-MX locale', () => {
    expect(formatMoney(1234.5, 'USD', 'es-MX')).toBe('USD\u00A01,234.50');
  });
});

describe('formatDate', () => {
  it('returns a dash for empty values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formats a yyyy-mm-dd date', () => {
    expect(formatDate('2026-08-12', 'en-US')).toBe('Aug 12, 2026');
  });

  it('returns the raw value for unparseable dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('formats a yyyy-mm-dd date with the es-MX locale', () => {
    expect(formatDate('2026-08-12', 'es-MX')).toBe('12 ago 2026');
  });
});
