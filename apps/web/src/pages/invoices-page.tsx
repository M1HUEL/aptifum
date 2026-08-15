import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  PageHeader,
  Pagination,
  StatusSelect,
  TableSkeleton,
  Toolbar,
} from '../components/ui';
import { Button } from '../components/ui/button';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';
import { InvoiceFormModal } from '../components/invoices/invoice-form';
import { PaymentFormModal } from '../components/invoices/payment-form';
import { InvoiceDetailsModal } from '../components/invoices/invoice-details';

function parsePageNumber(raw: string | null): number {
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function parseLimitNumber(raw: string | null): number {
  if (!raw) return 20;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 20 : parsed;
}

export function InvoicesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => parsePageNumber(searchParams.get('page')));
  const [limit, setLimit] = useState(() => parseLimitNumber(searchParams.get('limit')));
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
    limit,
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
    setLimit(parseLimitNumber(searchParams.get('limit')));
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

  const handleLimitChange = (next: number) => {
    setLimit(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    params.set('limit', String(next));
    params.set('page', '1');
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
      toast.toast(err instanceof ApiError ? err.message : t('errors.couldNotDownloadPdf'), 'error');
    }
  };

  const columns: Column<Invoice>[] = [
    { key: 'number', header: t('tables.number') },
    {
      key: 'type',
      header: t('tables.type'),
      render: (row) => (
        <Badge tone={row.type === 'invoice' ? 'info' : 'warning'}>{row.type.replace('_', ' ')}</Badge>
      ),
    },
    { key: 'customer', header: t('tables.customer'), render: (row) => row.customer.tradeName },
    { key: 'issueDate', header: t('tables.issueDate'), render: (row) => formatDate(row.issueDate) },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.status === 'issued' ? 'success' : row.status === 'draft' ? 'neutral' : 'danger'}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'total', header: t('tables.total'), render: (row) => formatMoney(row.total) },
    { key: 'balanceDue', header: t('tables.balance'), render: (row) => formatMoney(row.balanceDue) },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setViewing(row)}>
            {t('common.view')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void downloadPdf(row)}>
            {t('common.pdf')}
          </Button>
          {row.status === 'issued' && row.balanceDue > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setPayingInvoice(row)}>
              {t('common.payment')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'invoices', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('invoices.title')}
        subtitle={t('invoices.subtitle')}
        action={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('common.export')}
              onClick={handleExport}
            >
              {t('common.export')}
            </button>
            <Button onClick={() => setInvoiceOpen(true)}>{t('invoices.newInvoice')}</Button>
          </div>
        }
      />
      <Toolbar as="form" onSubmit={(event) => void submitSearch(event)}>
        <input
          className="max-w-[320px] flex-1 w-full rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          type="search"
          placeholder={t('invoices.searchByNumber')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <StatusSelect
          value={statusFilter}
          onChange={handleStatusChange}
          ariaLabel={t('common.status')}
          options={[
            { value: '', label: t('invoices.allStatuses') },
            { value: 'draft', label: t('invoices.draft') },
            { value: 'issued', label: t('invoices.issued') },
            { value: 'cancelled', label: t('invoices.cancelled') },
          ]}
        />
        <select className="rounded-ui border border-border bg-surface px-2.5 py-2 font-normal text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15" value={typeFilter} onChange={(event) => handleTypeChange(event.target.value)}>
          <option value="">{t('invoices.allTypes')}</option>
          <option value="invoice">{t('invoices.invoice')}</option>
          <option value="credit_note">{t('invoices.creditNote')}</option>
        </select>
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2 text-sm font-semibold text-text select-none hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('common.search')}
        </button>
      </Toolbar>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('invoices.noInvoices')} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={handlePageChange} onLimit={handleLimitChange} />
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
