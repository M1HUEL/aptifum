import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Button } from '../components/ui/button';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { InvoiceFormModal } from '../components/invoices/invoice-form';
import { PaymentFormModal } from '../components/invoices/payment-form';
import { InvoiceDetailsModal } from '../components/invoices/invoice-details';

function parsePageNumber(raw: string | null): number {
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

export function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => parsePageNumber(searchParams.get('page')));
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [input, setInput] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') ?? '');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Invoice>({
    path: '/api/v1/sales/invoices',
    page,
    query,
    extraParams: { status: statusFilter, type: typeFilter },
  });

  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    setInput(urlQuery);
    setQuery(urlQuery);
    setStatusFilter(searchParams.get('status') ?? '');
    setTypeFilter(searchParams.get('type') ?? '');
    setPage(parsePageNumber(searchParams.get('page')));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
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

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = input.trim();
    setQuery(nextQuery);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (nextQuery) params.set('q', nextQuery);
    else params.delete('q');
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (next: number) => {
    setPage(next);
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (value) params.set('status', value);
    else params.delete('status');
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (value) params.set('type', value);
    else params.delete('type');
    params.set('page', '1');
    setSearchParams(params);
  };

  const downloadPdf = async (row: Invoice) => {
    try {
      await downloadFile(`/api/v1/sales/invoices/${row.id}/pdf`, `invoice-${row.number}.pdf`);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not download PDF.', 'error');
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
    { key: 'customer', header: 'Customer', render: (row) => row.customer.tradeName },
    { key: 'issueDate', header: 'Issue date', render: (row) => formatDate(row.issueDate) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'issued' ? 'success' : row.status === 'draft' ? 'neutral' : 'danger'}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'total', header: 'Total', render: (row) => formatMoney(row.total) },
    { key: 'balanceDue', header: 'Balance', render: (row) => formatMoney(row.balanceDue) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => setViewing(row)}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void downloadPdf(row)}>
            PDF
          </Button>
          {row.status === 'issued' && row.balanceDue > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setPayingInvoice(row)}>
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
        action={<Button onClick={() => setInvoiceOpen(true)}>New invoice</Button>}
      />
      <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          placeholder="Search by number…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <select value={statusFilter} onChange={(event) => handleStatusChange(event.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={typeFilter} onChange={(event) => handleTypeChange(event.target.value)}>
          <option value="">All types</option>
          <option value="invoice">Invoice</option>
          <option value="credit_note">Credit note</option>
        </select>
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
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={handlePageChange} />
        </>
      ) : null}

      <InvoiceFormModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        onSaved={() => void reload()}
        customers={customers}
        products={products}
        warehouses={warehouses}
      />
      <PaymentFormModal invoice={payingInvoice} onClose={() => setPayingInvoice(null)} onSaved={() => void reload()} />
      <InvoiceDetailsModal invoice={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
