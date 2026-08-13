import type { Customer } from '../../api/types';
import { EmptyState, formatMoney } from '../ui';

export interface PosLine {
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

export interface PosTotals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export const FUNCTIONAL_CURRENCY = 'USD';
export const SALE_CURRENCIES = ['USD', 'EUR', 'MXN', 'CAD', 'GBP'] as const;

export function PosTicket({
  customers,
  customerId,
  onCustomerChange,
  saleCurrency,
  onCurrencyChange,
  saleRate,
  onRateChange,
  ticket,
  onLineFieldChange,
  onRemoveLine,
  discount,
  onDiscountChange,
  totals,
  warehouseId,
  checkoutError,
  charging,
  onSubmitCharge,
}: {
  customers: Customer[];
  customerId: string;
  onCustomerChange: (value: string) => void;
  saleCurrency: string;
  onCurrencyChange: (value: string) => void;
  saleRate: string;
  onRateChange: (value: string) => void;
  ticket: PosLine[];
  onLineFieldChange: (index: number, key: keyof PosLine, value: string) => void;
  onRemoveLine: (index: number) => void;
  discount: string;
  onDiscountChange: (value: string) => void;
  totals: PosTotals;
  warehouseId: string;
  checkoutError: string | null;
  charging: boolean;
  onSubmitCharge: () => void;
}) {
  return (
    <div className="card pos-ticket">
      <h3 className="card-title">Ticket</h3>
      <div className="field">
        <label htmlFor="pos-customer">Customer</label>
        <select id="pos-customer" value={customerId} onChange={(event) => onCustomerChange(event.target.value)}>
          <option value="">Walk-in customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.tradeName}
            </option>
          ))}
        </select>
      </div>
      <div className="pos-currency-row">
        <div className="field">
          <label htmlFor="pos-currency">Sale currency</label>
          <select id="pos-currency" value={saleCurrency} onChange={(event) => onCurrencyChange(event.target.value)}>
            {SALE_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>
        {saleCurrency !== FUNCTIONAL_CURRENCY ? (
          <div className="field">
            <label htmlFor="pos-rate">Exchange rate (1 {FUNCTIONAL_CURRENCY} = ? {saleCurrency})</label>
            <input
              id="pos-rate"
              type="number"
              min="0.000001"
              step="0.000001"
              value={saleRate}
              onChange={(event) => onRateChange(event.target.value)}
            />
          </div>
        ) : null}
      </div>
      <div className="pos-lines">
        {ticket.length === 0 ? (
          <EmptyState message="Tap a product to add it to the ticket." />
        ) : (
          ticket.map((line, index) => (
            <div className="pos-line" key={`${line.productId}:${line.variantId ?? ''}`}>
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
                onChange={(event) => onLineFieldChange(index, 'quantity', event.target.value)}
              />
              <input
                className="pos-price"
                type="number"
                min="0"
                step="0.01"
                aria-label={`Unit price for ${line.name}`}
                value={line.unitPrice}
                onChange={(event) => onLineFieldChange(index, 'unitPrice', event.target.value)}
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
                onChange={(event) => onLineFieldChange(index, 'taxRate', event.target.value)}
              />
              <span className="pos-line-total num">
                {formatMoney(Number(line.quantity) * Number(line.unitPrice || 0), saleCurrency)}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-ghost pos-line-remove"
                aria-label={`Remove ${line.name}`}
                onClick={() => onRemoveLine(index)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="field">
        <label htmlFor="pos-discount">Discount</label>
        <input
          id="pos-discount"
          type="number"
          min="0"
          step="0.01"
          value={discount}
          onChange={(event) => onDiscountChange(event.target.value)}
        />
      </div>
      <div className="pos-totals">
        <div className="pos-total-row">
          <span>Subtotal</span>
          <span className="num">{formatMoney(totals.subtotal, saleCurrency)}</span>
        </div>
        <div className="pos-total-row">
          <span>Discount</span>
          <span className="num">−{formatMoney(totals.discount, saleCurrency)}</span>
        </div>
        <div className="pos-total-row">
          <span>Tax</span>
          <span className="num">{formatMoney(totals.tax, saleCurrency)}</span>
        </div>
        <div className="pos-total-row pos-total-grand">
          <span>Total</span>
          <span className="num">{formatMoney(totals.total, saleCurrency)}</span>
        </div>
      </div>
      {!warehouseId ? <div className="error-banner">Select a warehouse to start selling.</div> : null}
      {checkoutError ? <div className="error-banner">{checkoutError}</div> : null}
      <button
        type="button"
        className="btn btn-primary btn-block pos-charge"
        disabled={charging || ticket.length === 0 || !warehouseId}
        onClick={onSubmitCharge}
      >
        {charging ? 'Charging…' : `Charge ${formatMoney(totals.total, saleCurrency)}`}
      </button>
    </div>
  );
}
