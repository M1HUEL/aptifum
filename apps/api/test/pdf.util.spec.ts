import { describe, expect, it } from 'vitest';
import { buildFinancialPdf, buildTablePdf, formatMoney } from '../src/common/pdf/pdf.util';
import { buildInvoicePdf } from '../src/modules/sales/invoice-pdf.util';

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

  it('produces a valid PDF buffer for an invoice', async () => {
    const buffer = await buildInvoicePdf({
      tenant: { name: 'Aptifum Demo', taxId: 'US-123456', defaultCurrency: 'USD', country: 'US' },
      invoice: {
        number: 'INV-000001',
        type: 'invoice',
        status: 'issued',
        issueDate: '2026-08-01',
        dueDate: '2026-08-31',
        currency: 'USD',
        subtotal: 1000,
        discount: 0,
        tax: 80,
        total: 1080,
        paidAmount: 500,
        balanceDue: 580,
        notes: 'Thank you for your business.',
        customer: {
          tradeName: 'Acme Corp',
          legalName: 'Acme Corporation Inc.',
          taxId: 'US-999888',
          address: '123 Main St',
          email: 'billing@acme.test',
        } as never,
        items: [
          {
            description: 'Consulting services',
            quantity: 10,
            unitPrice: 100,
            discount: 0,
            taxRate: 0.08,
            lineTotal: 1080,
          } as never,
        ],
        payments: [
          { method: 'transfer', amount: 500, receivedAt: new Date('2026-08-05') } as never,
        ],
      } as never,
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
