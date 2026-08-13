import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney } from './ui';

describe('formatMoney', () => {
  it('formats USD by default', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });

  it('formats with the given currency', () => {
    expect(formatMoney(100, 'EUR')).toBe('€100.00');
  });

  it('handles zero', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('handles negative values', () => {
    expect(formatMoney(-42)).toBe('-$42.00');
  });
});

describe('formatDate', () => {
  it('returns a dash for empty values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formats a yyyy-mm-dd date', () => {
    expect(formatDate('2026-08-12')).toBe('Aug 12, 2026');
  });

  it('returns the raw value for unparseable dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
