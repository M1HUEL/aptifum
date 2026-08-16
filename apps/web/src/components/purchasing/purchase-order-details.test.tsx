import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import i18n from '../../i18n';
import type { PurchaseOrder } from '../../api/types';
import { apiFetch } from '../../api/client';
import { ToastProvider } from '../toast';
import { PurchaseOrderDetailsModal } from './purchase-order-details';

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
  downloadFile: vi.fn(),
}));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

const initialOrder: PurchaseOrder = {
  id: '1',
  number: 'PO-001',
  status: 'approved',
  supplierId: 's1',
  warehouseId: 'w1',
  issueDate: '2026-08-01',
  expectedAt: '2026-08-10',
  currency: 'MXN',
  subtotal: 100,
  discount: 0,
  tax: 16,
  total: 116,
  notes: null,
  supplier: null,
  warehouse: null,
  items: [],
};

describe('PurchaseOrderDetailsModal close (X)', () => {
  it('closes the dialog after the detail has loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/purchasing/purchase-orders/')) {
        return Promise.resolve(initialOrder) as Promise<unknown>;
      }
      return Promise.reject(new Error('not found'));
    });

    function Controlled() {
      const [order, setOrder] = useState<PurchaseOrder | null>(initialOrder);
      return (
        <ToastProvider>
          <PurchaseOrderDetailsModal order={order} onClose={() => setOrder(null)} />
        </ToastProvider>
      );
    }

    render(<Controlled />);
    await waitFor(() => expect(screen.getByText(/PO-001/)).toBeInTheDocument());
    const xButton = screen.getByLabelText('Close');
    await user.click(xButton);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('PurchaseOrderDetailsModal list rows without items', () => {
  it('renders without crashing while the detail loads', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/purchasing/purchase-orders/')) {
        return Promise.resolve(initialOrder) as Promise<unknown>;
      }
      return Promise.reject(new Error('not found'));
    });

    const listRow = { ...initialOrder, items: undefined } as unknown as PurchaseOrder;

    render(
      <ToastProvider>
        <PurchaseOrderDetailsModal order={listRow} onClose={() => {}} />
      </ToastProvider>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/PO-001/)).toBeInTheDocument());
  });
});
