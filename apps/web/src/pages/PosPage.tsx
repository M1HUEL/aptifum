import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError, downloadFile } from '../api/client';
import type { Customer, Paginated, PosProduct, Warehouse } from '../api/types';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';
import { Button, Field, Modal, Select, TextInput } from '../components/forms';
import { useToast } from '../components/toast';

const paymentMethods = ['cash', 'card', 'transfer', 'other'] as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const todayStr = (): string => new Date().toISOString().slice(0, 10);

interface PosLine {
  productId: string;
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

interface InvoiceLike {
  id: string;
  number: string;
  total: number;
  balanceDue: number;
  paidAmount: number;
}

interface PaymentForm {
  method: string;
  amount: string;
  receivedAt: string;
  reference: string;
}

interface CompletedSale {
  id: string;
  number: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
}

export function PosPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [posProducts, setPosProducts] = useState<Paginated<PosProduct> | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [ticket, setTicket] = useState<PosLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [charging, setCharging] = useState(false);

  const [pendingInvoice, setPendingInvoice] = useState<InvoiceLike | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    method: 'cash',
    amount: '',
    receivedAt: todayStr(),
    reference: '',
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [completed, setCompleted] = useState<CompletedSale | null>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Paginated<Warehouse>>('/api/v1/inventory/warehouses?page=1&limit=100'),
      apiFetch<Paginated<Customer>>('/api/v1/sales/customers?page=1&limit=100'),
    ])
      .then(([warehousesResult, customersResult]) => {
        if (cancelled) return;
        setWarehouses(warehousesResult.data);
        setCustomers(customersResult.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!warehouseId) {
      setPosProducts(null);
      return;
    }
    setCatalogLoading(true);
    setCatalogError(null);
    const params = new URLSearchParams({ page: String(page), limit: '60' });
    params.set('warehouseId', warehouseId);
    if (query) params.set('q', query);
    apiFetch<Paginated<PosProduct>>(`/api/v1/inventory/pos-products?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setPosProducts(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalogError(err instanceof ApiError ? err.message : 'Could not load products.');
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, query, page, refreshKey]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  const addProduct = (product: PosProduct) => {
    setTicket((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: String(Number(line.quantity) + 1) }
            : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: '1',
          unitPrice: String(product.salePrice),
          taxRate: '',
        },
      ];
    });
  };

  const setLineField = (index: number, key: keyof PosLine, value: string) => {
    setTicket((current) =>
      current.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    );
  };

  const removeLine = (index: number) => {
    setTicket((current) => current.filter((_, i) => i !== index));
  };

  const totals = useMemo(() => {
    const subtotal = round2(
      ticket.reduce(
        (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice || 0),
        0,
      ),
    );
    const tax = round2(
      ticket.reduce(
        (sum, line) =>
          sum +
          Number(line.quantity) *
            Number(line.unitPrice || 0) *
            (line.taxRate === '' ? 0 : Number(line.taxRate) / 100),
        0,
      ),
    );
    const d = discount === '' ? 0 : Math.max(0, Number(discount));
    return { subtotal, tax, discount: round2(d), total: round2(subtotal + tax - d) };
  }, [ticket, discount]);

  const submitCharge = async () => {
    if (!warehouseId) {
      setCheckoutError('Select a warehouse to start the sale.');
      return;
    }
    const items = ticket.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      unitPrice: line.unitPrice === '' ? undefined : Number(line.unitPrice),
      taxRate: line.taxRate === '' ? undefined : Number(line.taxRate) / 100,
    }));
    if (items.length === 0) {
      setCheckoutError('Add at least one product to the ticket.');
      return;
    }
    setCharging(true);
    setCheckoutError(null);
    try {
      const invoice = await apiFetch<InvoiceLike>('/api/v1/sales/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          customerId: customerId || undefined,
          warehouseId,
          discount: discount === '' ? undefined : Number(discount),
          items,
        }),
      });
      setPendingInvoice(invoice);
      setPaymentForm({
        method: 'cash',
        amount: String(invoice.total),
        receivedAt: todayStr(),
        reference: '',
      });
      setPaymentError(null);
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : 'Could not issue the invoice.');
    } finally {
      setCharging(false);
    }
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!pendingInvoice) return;
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const result = await apiFetch<{ paidAmount: number; balanceDue: number }>(
        `/api/v1/sales/invoices/${pendingInvoice.id}/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            method: paymentForm.method,
            amount: Number(paymentForm.amount),
            receivedAt: paymentForm.receivedAt || undefined,
            reference: paymentForm.reference.trim() || undefined,
          }),
        },
      );
      setCompleted({
        id: pendingInvoice.id,
        number: pendingInvoice.number,
        total: pendingInvoice.total,
        paidAmount: result.paidAmount,
        balanceDue: result.balanceDue,
      });
      setPendingInvoice(null);
      toast.toast('Sale completed.');
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Could not record the payment.');
    } finally {
      setPaymentBusy(false);
    }
  };

  const downloadPdf = async (sale: CompletedSale) => {
    try {
      await downloadFile(`/api/v1/sales/invoices/${sale.id}/pdf`, `invoice-${sale.number}.pdf`);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not download PDF.', 'error');
    }
  };

  const resetSale = () => {
    setTicket([]);
    setDiscount('');
    setCustomerId('');
    setCompleted(null);
    setPendingInvoice(null);
    setInput('');
    setQuery('');
    setPage(1);
    setRefreshKey((key) => key + 1);
  };

  return (
    <>
      <PageHeader
        title="Point of sale"
        subtitle="Sell products and collect payment at the counter"
      />
      <div className="pos-layout">
        <div className="pos-catalog">
          <div className="toolbar">
            <Select
              id="pos-warehouse"
              value={warehouseId}
              onChange={(event) => {
                setWarehouseId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">— Select warehouse —</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </div>
          <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
            <input
              type="search"
              placeholder="Search name, SKU or barcode…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" className="btn">
              Search
            </button>
          </form>
          {catalogError ? <ErrorBanner message={catalogError} /> : null}
          {catalogLoading ? <LoadingBlock /> : null}
          {!catalogLoading && posProducts && posProducts.data.length === 0 ? (
            <EmptyState message="No products found for this warehouse." />
          ) : null}
          {!catalogLoading && posProducts && posProducts.data.length > 0 ? (
            <>
              <div className="pos-grid">
                {posProducts.data.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="pos-product"
                    disabled={product.availableStock <= 0}
                    onClick={() => addProduct(product)}
                  >
                    <span className="pos-product-name">{product.name}</span>
                    <span className="pos-product-sku">{product.sku}</span>
                    <span className="pos-product-price">{formatMoney(product.salePrice)}</span>
                    <Badge tone={product.availableStock > 0 ? 'success' : 'neutral'}>
                      {product.availableStock > 0
                        ? `${product.availableStock} in stock`
                        : 'Out of stock'}
                    </Badge>
                  </button>
                ))}
              </div>
              <Pagination
                page={posProducts.meta.page}
                limit={posProducts.meta.limit}
                total={posProducts.meta.total}
                onPage={setPage}
              />
            </>
          ) : null}
        </div>

        <div className="pos-ticket-col">
          {completed ? (
            <div className="card pos-success">
              <div className="success-banner">Sale completed.</div>
              <h3 className="card-title">Invoice {completed.number}</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">Total</div>
                  <div className="detail-value num">{formatMoney(completed.total)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Paid</div>
                  <div className="detail-value num">{formatMoney(completed.paidAmount)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Balance due</div>
                  <div className="detail-value num">
                    {completed.balanceDue > 0 ? formatMoney(completed.balanceDue) : '—'}
                  </div>
                </div>
              </div>
              <div className="pos-success-actions">
                <Button variant="ghost" onClick={() => void downloadPdf(completed)}>
                  Download PDF
                </Button>
                <Link to="/invoices" className="btn">
                  View invoices
                </Link>
                <Button onClick={resetSale}>New sale</Button>
              </div>
            </div>
          ) : (
            <div className="card pos-ticket">
              <h3 className="card-title">Ticket</h3>
              <Field label="Customer" htmlFor="pos-customer">
                <Select
                  id="pos-customer"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                >
                  <option value="">Walk-in customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.tradeName}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="pos-lines">
                {ticket.length === 0 ? (
                  <EmptyState message="Tap a product to add it to the ticket." />
                ) : (
                  ticket.map((line, index) => (
                    <div className="pos-line" key={line.productId}>
                      <div className="pos-line-info">
                        <div className="pos-line-name">{line.name}</div>
                        <div className="pos-line-meta">{line.sku}</div>
                      </div>
                      <input
                        className="pos-qty"
                        type="number"
                        min="0.0001"
                        step="any"
                        aria-label={`Quantity for ${line.name}`}
                        value={line.quantity}
                        onChange={(event) => setLineField(index, 'quantity', event.target.value)}
                      />
                      <input
                        className="pos-price"
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Unit price for ${line.name}`}
                        value={line.unitPrice}
                        onChange={(event) => setLineField(index, 'unitPrice', event.target.value)}
                      />
                      <input
                        className="pos-tax"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="%"
                        aria-label={`Tax for ${line.name}`}
                        value={line.taxRate}
                        onChange={(event) => setLineField(index, 'taxRate', event.target.value)}
                      />
                      <span className="pos-line-total num">
                        {formatMoney(Number(line.quantity) * Number(line.unitPrice || 0))}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost pos-line-remove"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => removeLine(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              <Field label="Discount" htmlFor="pos-discount">
                <TextInput
                  id="pos-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </Field>
              <div className="pos-totals">
                <div className="pos-total-row">
                  <span>Subtotal</span>
                  <span className="num">{formatMoney(totals.subtotal)}</span>
                </div>
                <div className="pos-total-row">
                  <span>Discount</span>
                  <span className="num">−{formatMoney(totals.discount)}</span>
                </div>
                <div className="pos-total-row">
                  <span>Tax</span>
                  <span className="num">{formatMoney(totals.tax)}</span>
                </div>
                <div className="pos-total-row pos-total-grand">
                  <span>Total</span>
                  <span className="num">{formatMoney(totals.total)}</span>
                </div>
              </div>
              {!warehouseId ? (
                <div className="error-banner">Select a warehouse to start selling.</div>
              ) : null}
              {checkoutError ? <div className="error-banner">{checkoutError}</div> : null}
              <button
                type="button"
                className="btn btn-primary btn-block pos-charge"
                disabled={charging || ticket.length === 0 || !warehouseId}
                onClick={() => void submitCharge()}
              >
                {charging ? 'Charging…' : `Charge ${formatMoney(totals.total)}`}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={pendingInvoice !== null}
        title={`Payment for ${pendingInvoice?.number ?? ''}`}
        onClose={() => setPendingInvoice(null)}
        width="sm"
      >
        <form onSubmit={(event) => void submitPayment(event)}>
          <Field label="Method" htmlFor="payment-method" required>
            <Select
              id="payment-method"
              value={paymentForm.method}
              onChange={(event) =>
                setPaymentForm((current) => ({ ...current, method: event.target.value }))
              }
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Amount"
            htmlFor="payment-amount"
            required
            hint={pendingInvoice ? `Total due: ${formatMoney(pendingInvoice.total)}` : undefined}
          >
            <TextInput
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={paymentForm.amount}
              onChange={(event) =>
                setPaymentForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
          </Field>
          <Field label="Received at" htmlFor="payment-date">
            <TextInput
              id="payment-date"
              type="date"
              value={paymentForm.receivedAt}
              onChange={(event) =>
                setPaymentForm((current) => ({ ...current, receivedAt: event.target.value }))
              }
            />
          </Field>
          <Field label="Reference" htmlFor="payment-reference">
            <TextInput
              id="payment-reference"
              value={paymentForm.reference}
              onChange={(event) =>
                setPaymentForm((current) => ({ ...current, reference: event.target.value }))
              }
            />
          </Field>
          {paymentError ? <div className="error-banner">{paymentError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setPendingInvoice(null)} disabled={paymentBusy}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={paymentBusy}>
              {paymentBusy ? 'Recording…' : 'Record payment'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
