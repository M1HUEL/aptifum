import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import i18n from '../../../src/i18n';
import type { Customer, Invoice } from '../../../src/api/types';
import { apiFetch } from '../../../src/api/client';
import { ToastProvider } from '../../../src/components/toast';
import { InvoiceDetailsModal } from '../../../src/components/invoices/invoice-details';

vi.mock('../../../src/api/client', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
  downloadFile: vi.fn(),
}));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

const initialInvoice: Invoice = {
  id: '1',
  number: 'INV-001',
  type: 'invoice',
  status: 'issued',
  customerId: 'c1',
  seriesId: 's1',
  orderId: null,
  warehouseId: null,
  issueDate: '2026-08-01',
  dueDate: '2026-08-15',
  currency: 'MXN',
  subtotal: 100,
  discount: 0,
  tax: 16,
  total: 116,
  paidAmount: 0,
  balanceDue: 116,
  notes: null,
  version: 1,
  createdAt: '2026-08-01T00:00:00Z',
  customer: { id: 'c1', tradeName: 'Acme' } as Customer,
  items: [],
  payments: [],
};

describe('InvoiceDetailsModal close (X)', () => {
  it('closes the dialog after the detail has loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/sales/invoices/')) {
        return Promise.resolve(initialInvoice) as Promise<unknown>;
      }
      return Promise.reject(new Error('not found'));
    });

    function Controlled() {
      const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice);
      return (
        <ToastProvider>
          <InvoiceDetailsModal invoice={invoice} onClose={() => setInvoice(null)} />
        </ToastProvider>
      );
    }

    render(<Controlled />);
    await waitFor(() => expect(screen.getByText(/INV-001/)).toBeInTheDocument());
    const xButton = screen.getByLabelText('Close');
    await user.click(xButton);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
