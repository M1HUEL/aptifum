import { describe, expect, it } from 'vitest';
import { buildFinancialPdf, buildTablePdf, formatMoney } from '../src/modules/reports/pdf.util';

describe('pdf.util', () => {
  it('produces a valid PDF buffer for a table report', async () => {
    const buffer = await buildTablePdf({
      title: 'Payroll Summary',
      columns: [
        { header: 'Period' },
        { header: 'Payrolls', align: 'right' },
        { header: 'Net', align: 'right' },
      ],
      rows: [['2026-07', '2', formatMoney(4200)]],
      totalsRow: ['Total', '2', formatMoney(4200)],
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('handles an empty table report', async () => {
    const buffer = await buildTablePdf({
      title: 'Empty Report',
      columns: [{ header: 'Period' }, { header: 'Amount', align: 'right' }],
      rows: [],
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('produces a valid PDF buffer for financial sections', async () => {
    const buffer = await buildFinancialPdf({
      title: 'Income Statement',
      sections: [
        {
          name: 'Revenue',
          rows: [
            { code: '4-100', name: 'Sales', balance: 10000 },
            { code: '4-200', name: 'Services', balance: 2500 },
          ],
          total: 12500,
        },
        { name: 'Net income', rows: [{ code: '', name: 'Net income', balance: 5000 }], total: 5000 },
      ],
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('formats money with two decimals', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });
});
