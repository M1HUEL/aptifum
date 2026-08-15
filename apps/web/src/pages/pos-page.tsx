import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError, downloadFile } from '../api/client';
import type { Customer, Paginated, PosProduct, Warehouse } from '../api/types';
import { PageHeader } from '../components/ui';
import { useToast } from '../components/toast';
import { PosCatalog } from '../components/pos/pos-catalog';
import {
  FUNCTIONAL_CURRENCY,
  PosTicket,
  type PosLine,
  type PosTotals,
} from '../components/pos/pos-ticket';
import { PosPaymentModal, type InvoiceLike, type PaymentForm } from '../components/pos/pos-payment';
import { PosSuccess, type CompletedSale } from '../components/pos/pos-success';

const round2 = (n: number): number => Math.round(n * 100) / 100;

const todayStr = (): string => new Date().toISOString().slice(0, 10);

export function PosPage() {
  const { t } = useTranslation();
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
  const [saleCurrency, setSaleCurrency] = useState<string>(FUNCTIONAL_CURRENCY);
  const [saleRate, setSaleRate] = useState('1');
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
          setCatalogError(err instanceof ApiError ? err.message : t('pos.couldNotLoadProducts'));
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
      const existing = current.find(
        (line) => line.productId === product.id && line.variantId === product.variantId,
      );
      if (existing) {
        return current.map((line) =>
          line.productId === product.id && line.variantId === product.variantId
            ? { ...line, quantity: String(Number(line.quantity) + 1) }
            : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          variantId: product.variantId,
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
    setTicket((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const removeLine = (index: number) => {
    setTicket((current) => current.filter((_, i) => i !== index));
  };

  const totals: PosTotals = useMemo(() => {
    const subtotal = round2(
      ticket.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice || 0), 0),
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

  const changeSaleCurrency = (currency: string) => {
    setSaleCurrency(currency);
    if (currency === FUNCTIONAL_CURRENCY) {
      setSaleRate('1');
      return;
    }
    apiFetch<{ rate?: number } | null>(
      `/api/v1/exchange-rates/latest?base=${FUNCTIONAL_CURRENCY}&quote=${currency}`,
    )
      .then((result) => {
        if (result && typeof result.rate === 'number') setSaleRate(String(result.rate));
      })
      .catch(() => {});
  };

  const submitCharge = async () => {
    if (!warehouseId) {
      setCheckoutError(t('pos.selectWarehouseToStartSale'));
      return;
    }
    const items = ticket.map((line) => ({
      productId: line.productId,
      variantId: line.variantId ?? undefined,
      quantity: Number(line.quantity),
      unitPrice: line.unitPrice === '' ? undefined : Number(line.unitPrice),
      taxRate: line.taxRate === '' ? undefined : Number(line.taxRate) / 100,
    }));
    if (items.length === 0) {
      setCheckoutError(t('pos.addProductToTicket'));
      return;
    }
    if (saleCurrency !== FUNCTIONAL_CURRENCY) {
      const rate = Number(saleRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        setCheckoutError(t('pos.invalidExchangeRate'));
        return;
      }
    }
    setCharging(true);
    setCheckoutError(null);
    try {
      const foreign = saleCurrency !== FUNCTIONAL_CURRENCY;
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
          currency: foreign ? saleCurrency : undefined,
          exchangeRate: foreign ? Number(saleRate) : undefined,
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
      setCheckoutError(err instanceof ApiError ? err.message : t('pos.couldNotIssueInvoice'));
    } finally {
      setCharging(false);
    }
  };

  const setPaymentField = (key: keyof PaymentForm, value: string) => {
    setPaymentForm((current) => ({ ...current, [key]: value }));
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
            currency: pendingInvoice.currency !== FUNCTIONAL_CURRENCY ? pendingInvoice.currency : undefined,
            exchangeRate:
              pendingInvoice.currency !== FUNCTIONAL_CURRENCY ? pendingInvoice.exchangeRate : undefined,
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
        currency: pendingInvoice.currency,
      });
      setPendingInvoice(null);
      toast.toast(t('pos.saleCompleted'));
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : t('pos.couldNotRecordPayment'));
    } finally {
      setPaymentBusy(false);
    }
  };

  const downloadPdf = async (sale: CompletedSale) => {
    try {
      await downloadFile(`/api/v1/sales/invoices/${sale.id}/pdf`, `invoice-${sale.number}.pdf`);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : t('reports.couldNotDownloadPdf'), 'error');
    }
  };

  const resetSale = () => {
    setTicket([]);
    setDiscount('');
    setCustomerId('');
    setSaleCurrency(FUNCTIONAL_CURRENCY);
    setSaleRate('1');
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
        title={t('pos.title')}
        subtitle={t('pos.subtitle')}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5 max-[900px]:grid-cols-1">
        <PosCatalog
          warehouses={warehouses}
          warehouseId={warehouseId}
          onWarehouseChange={(value) => {
            setWarehouseId(value);
            setPage(1);
          }}
          input={input}
          onInputChange={setInput}
          onSubmitSearch={submitSearch}
          catalog={posProducts}
          loading={catalogLoading}
          error={catalogError}
          onAddProduct={addProduct}
          onPage={setPage}
        />
        <div className="min-w-0">
          {completed ? (
            <PosSuccess sale={completed} onDownloadPdf={(sale) => void downloadPdf(sale)} onReset={resetSale} />
          ) : (
            <PosTicket
              customers={customers}
              customerId={customerId}
              onCustomerChange={setCustomerId}
              saleCurrency={saleCurrency}
              onCurrencyChange={changeSaleCurrency}
              saleRate={saleRate}
              onRateChange={setSaleRate}
              ticket={ticket}
              onLineFieldChange={setLineField}
              onRemoveLine={removeLine}
              discount={discount}
              onDiscountChange={setDiscount}
              totals={totals}
              warehouseId={warehouseId}
              checkoutError={checkoutError}
              charging={charging}
              onSubmitCharge={() => void submitCharge()}
            />
          )}
        </div>
      </div>

      <PosPaymentModal
        invoice={pendingInvoice}
        form={paymentForm}
        onFormChange={setPaymentField}
        error={paymentError}
        busy={paymentBusy}
        onSubmit={(event) => void submitPayment(event)}
        onClose={() => setPendingInvoice(null)}
      />
    </>
  );
}
