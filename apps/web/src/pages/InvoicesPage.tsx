import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError, downloadFile } from '../api/client';
import type { Customer, Invoice, Paginated, Product, Warehouse } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatDate,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';
import {
  Button,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/usePagedQuery';

const paymentMethods = ['cash', 'card', 'transfer', 'other'] as const;

interface InvoiceItemForm {
  productId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

interface InvoiceForm {
  customerId: string;
  warehouseId: string;
  dueDate: string;
  discount: string;
  notes: string;
  items: InvoiceItemForm[];
}

const emptyItem: InvoiceItemForm = { productId: '', quantity: '1', unitPrice: '', taxRate: '' };

interface PaymentForm {
  method: string;
  amount: string;
  receivedAt: string;
  reference: string;
  notes: string;
}

const emptyPayment: PaymentForm = {
  method: 'cash',
  amount: '',
  receivedAt: '',
  reference: '',
  notes: '',
};

export function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>({
    customerId: '',
    warehouseId: '',
    dueDate: '',
    discount: '',
    notes: '',
    items: [emptyItem],
  });
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPayment);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Invoice>({
    path: '/api/v1/sales/invoices',
    page,
    query,
    extraParams: { status: statusFilter, type: typeFilter },
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Paginated<Customer>>('/api/v1/sales/customers?page=1&limit=100'),
      apiFetch<Paginated<Product>>('/api/v1/inventory/products?page=1&limit=100'),
      apiFetch<Paginated<Warehouse>>('/api/v1/inventory/warehouses?page=1&limit=100'),
    ])
      .then(([customersResult, productsResult, warehousesResult]) => {
        if (cancelled) return;
        setCustomers(customersResult.data);
        setProducts(productsResult.data);
        setWarehouses(warehousesResult.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const openInvoice = () => {
    setInvoiceForm({
      customerId: '',
      warehouseId: '',
      dueDate: '',
      discount: '',
      notes: '',
      items: [emptyItem],
    });
    setInvoiceError(null);
    setInvoiceOpen(true);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  const closeInvoice = () => {
    if (!saving) setInvoiceOpen(false);
  };

  const setInvoiceField = (key: keyof InvoiceForm, value: string) => {
    setInvoiceForm((current) => ({ ...current, [key]: value }));
  };

  const setItemField = (index: number, key: keyof InvoiceItemForm, value: string) => {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };

  const addItem = () => {
    setInvoiceForm((current) => ({ ...current, items: [...current.items, emptyItem] }));
  };

  const removeItem = (index: number) => {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  };

  const submitInvoice = async (event: FormEvent) => {
    event.preventDefault();
    const items = invoiceForm.items
      .filter((item) => item.productId)
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? undefined : Number(item.unitPrice),
        taxRate: item.taxRate === '' ? undefined : Number(item.taxRate),
      }));
    if (items.length === 0) {
      setInvoiceError('Add at least one line item.');
      return;
    }
    setSaving(true);
    setInvoiceError(null);
    const body = {
      customerId: invoiceForm.customerId || undefined,
      warehouseId: invoiceForm.warehouseId || undefined,
      dueDate: invoiceForm.dueDate || undefined,
      discount: invoiceForm.discount === '' ? undefined : Number(invoiceForm.discount),
      notes: invoiceForm.notes.trim() || undefined,
      items,
    };
    try {
      await apiFetch('/api/v1/sales/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Invoice issued.');
      setInvoiceOpen(false);
      void reload();
    } catch (err) {
      setInvoiceError(err instanceof ApiError ? err.message : 'Could not issue invoice.');
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (invoice: Invoice) => {
    setPayingInvoice(invoice);
    setPaymentForm({ ...emptyPayment, amount: String(invoice.balanceDue) });
    setPaymentError(null);
  };

  const closePayment = () => {
    if (!paymentBusy) setPayingInvoice(null);
  };

  const setPaymentField = (key: keyof PaymentForm, value: string) => {
    setPaymentForm((current) => ({ ...current, [key]: value }));
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!payingInvoice) return;
    setPaymentBusy(true);
    setPaymentError(null);
    const body = {
      method: paymentForm.method,
      amount: Number(paymentForm.amount),
      receivedAt: paymentForm.receivedAt || undefined,
      reference: paymentForm.reference.trim() || undefined,
      notes: paymentForm.notes.trim() || undefined,
    };
    try {
      await apiFetch(`/api/v1/sales/invoices/${payingInvoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Payment recorded.');
      setPayingInvoice(null);
      void reload();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Could not record payment.');
    } finally {
      setPaymentBusy(false);
    }
  };

  const downloadPdf = async (row: Invoice) => {
    try {
      await downloadFile(`/api/v1/sales/invoices/${row.id}/pdf`, `invoice-${row.number}.pdf`);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not download PDF.');
    }
  };

  const openView = async (row: Invoice) => {
    setViewing(row);
    setViewLoading(true);
    setViewError(null);
    try {
      const detail = await apiFetch<Invoice>(`/api/v1/sales/invoices/${row.id}`);
      setViewing(detail);
    } catch (err) {
      setViewError(err instanceof ApiError ? err.message : 'Could not load invoice.');
    } finally {
      setViewLoading(false);
    }
  };

  const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Number' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge tone={row.type === 'invoice' ? 'info' : 'warning'}>{row.type.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => row.customer.tradeName,
    },
    {
      key: 'issueDate',
      header: 'Issue date',
      render: (row) => formatDate(row.issueDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'issued' ? 'success' : row.status === 'draft' ? 'neutral' : 'danger'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => formatMoney(row.total),
    },
    {
      key: 'balanceDue',
      header: 'Balance',
      render: (row) => formatMoney(row.balanceDue),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => void openView(row)}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void downloadPdf(row)}>
            PDF
          </Button>
          {row.status === 'issued' && row.balanceDue > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => openPayment(row)}>
              Payment
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Invoices and credit notes"
        action={<Button onClick={openInvoice}>New invoice</Button>}
      />
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by number…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Select
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          <option value="invoice">Invoice</option>
          <option value="credit_note">Credit note</option>
        </Select>
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No invoices." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}

      <Modal open={invoiceOpen} title="Issue invoice" onClose={closeInvoice} width="lg">
        <form onSubmit={(event) => void submitInvoice(event)}>
          <div className="form-grid">
            <Field label="Customer" htmlFor="invoice-customer" required>
              <Select
                id="invoice-customer"
                value={invoiceForm.customerId}
                onChange={(event) => setInvoiceField('customerId', event.target.value)}
              >
                <option value="">— Select customer —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Warehouse" htmlFor="invoice-warehouse">
              <Select
                id="invoice-warehouse"
                value={invoiceForm.warehouseId}
                onChange={(event) => setInvoiceField('warehouseId', event.target.value)}
              >
                <option value="">— Default —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date" htmlFor="invoice-due">
              <TextInput
                id="invoice-due"
                type="date"
                value={invoiceForm.dueDate}
                onChange={(event) => setInvoiceField('dueDate', event.target.value)}
              />
            </Field>
            <Field label="Discount" htmlFor="invoice-discount">
              <TextInput
                id="invoice-discount"
                type="number"
                min="0"
                step="0.01"
                value={invoiceForm.discount}
                onChange={(event) => setInvoiceField('discount', event.target.value)}
              />
            </Field>
          </div>
          <div className="invoice-items">
            {invoiceForm.items.map((item, index) => (
              <div className="invoice-item" key={index}>
                <Field label="Product" htmlFor={`invoice-item-product-${index}`}>
                  <Select
                    id={`invoice-item-product-${index}`}
                    value={item.productId}
                    onChange={(event) => setItemField(index, 'productId', event.target.value)}
                  >
                    <option value="">— Select product —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Qty" htmlFor={`invoice-item-qty-${index}`}>
                  <TextInput
                    id={`invoice-item-qty-${index}`}
                    type="number"
                    min="0.0001"
                    step="any"
                    value={item.quantity}
                    onChange={(event) => setItemField(index, 'quantity', event.target.value)}
                  />
                </Field>
                <Field label="Unit price" htmlFor={`invoice-item-price-${index}`}>
                  <TextInput
                    id={`invoice-item-price-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="product price"
                    value={item.unitPrice}
                    onChange={(event) => setItemField(index, 'unitPrice', event.target.value)}
                  />
                </Field>
                <Field label="Tax %" htmlFor={`invoice-item-tax-${index}`}>
                  <TextInput
                    id={`invoice-item-tax-${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 18"
                    value={item.taxRate}
                    onChange={(event) => setItemField(index, 'taxRate', event.target.value)}
                  />
                </Field>
                <div className="invoice-item-remove">
                  {invoiceForm.items.length > 1 ? (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={addItem}>
            + Add line
          </Button>
          <Field label="Notes" htmlFor="invoice-notes">
            <TextArea
              id="invoice-notes"
              rows={2}
              value={invoiceForm.notes}
              onChange={(event) => setInvoiceField('notes', event.target.value)}
            />
          </Field>
          {invoiceError ? <div className="error-banner">{invoiceError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeInvoice} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Issuing…' : 'Issue invoice'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={payingInvoice !== null}
        title={`Payment for ${payingInvoice?.number ?? ''}`}
        onClose={closePayment}
        width="sm"
      >
        <form onSubmit={(event) => void submitPayment(event)}>
          <Field label="Method" htmlFor="payment-method" required>
            <Select
              id="payment-method"
              value={paymentForm.method}
              onChange={(event) => setPaymentField('method', event.target.value)}
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
            hint={payingInvoice ? `Balance due: ${formatMoney(payingInvoice.balanceDue)}` : undefined}
          >
            <TextInput
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={paymentForm.amount}
              onChange={(event) => setPaymentField('amount', event.target.value)}
            />
          </Field>
          <Field label="Received at" htmlFor="payment-date">
            <TextInput
              id="payment-date"
              type="date"
              value={paymentForm.receivedAt}
              onChange={(event) => setPaymentField('receivedAt', event.target.value)}
            />
          </Field>
          <Field label="Reference" htmlFor="payment-reference">
            <TextInput
              id="payment-reference"
              value={paymentForm.reference}
              onChange={(event) => setPaymentField('reference', event.target.value)}
            />
          </Field>
          <Field label="Notes" htmlFor="payment-notes">
            <TextArea
              id="payment-notes"
              rows={2}
              value={paymentForm.notes}
              onChange={(event) => setPaymentField('notes', event.target.value)}
            />
          </Field>
          {paymentError ? <div className="error-banner">{paymentError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closePayment} disabled={paymentBusy}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={paymentBusy}>
              {paymentBusy ? 'Recording…' : 'Record payment'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={viewing !== null}
        title={`${viewing ? viewing.type.replace('_', ' ') : 'Invoice'} ${viewing?.number ?? ''}`}
        onClose={() => setViewing(null)}
        width="lg"
      >
        {viewLoading ? <LoadingBlock /> : null}
        {viewError ? <ErrorBanner message={viewError} /> : null}
        {!viewLoading && viewing ? (
          <div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">Status</div>
                <div className="detail-value">
                  <Badge tone={viewing.status === 'issued' ? 'success' : viewing.status === 'draft' ? 'neutral' : 'danger'}>
                    {viewing.status}
                  </Badge>
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Customer</div>
                <div className="detail-value">{viewing.customer?.tradeName ?? '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Issue date</div>
                <div className="detail-value">{formatDate(viewing.issueDate)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Due date</div>
                <div className="detail-value">{viewing.dueDate ? formatDate(viewing.dueDate) : '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Subtotal</div>
                <div className="detail-value num">{formatMoney(viewing.subtotal)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Discount</div>
                <div className="detail-value num">{formatMoney(viewing.discount)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Tax</div>
                <div className="detail-value num">{formatMoney(viewing.tax)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Total</div>
                <div className="detail-value num">{formatMoney(viewing.total)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Paid</div>
                <div className="detail-value num">{formatMoney(viewing.paidAmount)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Balance due</div>
                <div className="detail-value num">{formatMoney(viewing.balanceDue)}</div>
              </div>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit price</th>
                    <th className="num">Tax</th>
                    <th className="num">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.description ?? item.product?.name ?? item.productId}</td>
                      <td className="num">{item.quantity}</td>
                      <td className="num">{formatMoney(item.unitPrice)}</td>
                      <td className="num">{formatMoney(item.taxAmount)}</td>
                      <td className="num">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(viewing.payments ?? []).length > 0 ? (
              <>
                <h4 className="detail-section-title">Payments</h4>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th className="num">Amount</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewing.payments ?? []).map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.receivedAt)}</td>
                          <td>{payment.method}</td>
                          <td className="num">{formatMoney(payment.amount)}</td>
                          <td>{payment.reference ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {viewing.notes ? <div className="detail-notes">{viewing.notes}</div> : null}
          </div>
        ) : null}
        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setViewing(null)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
