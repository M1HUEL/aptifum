import { ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Customer } from '../../api/types';
import { EmptyState, formatMoney, Input, Select } from '../ui';

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
  const { t } = useTranslation();
  return (
    <div className="mb-5 rounded-ui border border-border bg-surface p-5 shadow-(--shadow)">
      <h3 className="mb-3.5 text-[15px]">{t('pos.ticket')}</h3>
      <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
        <label htmlFor="pos-customer">{t('fields.customer')}</label>
        <Select
          className="w-full"
          id="pos-customer"
          value={customerId}
          onChange={(event) => onCustomerChange(event.target.value)}
        >
          <option value="">{t('pos.walkInCustomer')}</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.tradeName}
            </option>
          ))}
        </Select>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
        <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
          <label htmlFor="pos-currency">{t('pos.saleCurrency')}</label>
          <Select
            className="w-full"
            id="pos-currency"
            value={saleCurrency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          >
            {SALE_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </div>
        {saleCurrency !== FUNCTIONAL_CURRENCY ? (
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="pos-rate">
              {t('pos.exchangeRate', { base: FUNCTIONAL_CURRENCY, quote: saleCurrency })}
            </label>
            <Input
              className="w-full"
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
      <div className="mb-3 max-h-[320px] overflow-auto rounded-ui border border-border p-2">
        {ticket.length === 0 ? (
          <EmptyState message={t('pos.tapProductToAdd')} icon={<ShoppingCart className="size-6" />} />
        ) : (
          ticket.map((line, index) => (
            <div
              className="grid grid-cols-[1fr_60px_80px_52px_86px_28px] items-center gap-1.5 border-b border-border px-1 py-1.5 last:border-b-0"
              key={`${line.productId}:${line.variantId ?? ''}`}
            >
              <div className="min-w-0">
                <div className="truncate font-semibold">{line.name}</div>
                <div className="text-[12px] text-muted">{line.sku}</div>
              </div>
              <input
                className="w-full min-w-0 text-right"
                type="number"
                min="0.0001"
                step="any"
                aria-label={t('pos.quantityFor', { name: line.name })}
                value={line.quantity}
                onChange={(event) => onLineFieldChange(index, 'quantity', event.target.value)}
              />
              <input
                className="w-full min-w-0 text-right"
                type="number"
                min="0"
                step="0.01"
                aria-label={t('pos.unitPriceFor', { name: line.name })}
                value={line.unitPrice}
                onChange={(event) => onLineFieldChange(index, 'unitPrice', event.target.value)}
              />
              <input
                className="w-full min-w-0 text-right"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="%"
                aria-label={t('pos.taxFor', { name: line.name })}
                value={line.taxRate}
                onChange={(event) => onLineFieldChange(index, 'taxRate', event.target.value)}
              />
              <span className="text-right font-semibold tabular-nums">
                {formatMoney(Number(line.quantity) * Number(line.unitPrice || 0), saleCurrency)}
              </span>
              <button
                type="button"
                className="cursor-pointer rounded-ui border border-white/20 bg-transparent px-1.5 py-0.5 text-[12px] font-semibold text-sidebar-text hover:bg-white/10"
                aria-label={t('pos.removeLine', { name: line.name })}
                onClick={() => onRemoveLine(index)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
        <label htmlFor="pos-discount">{t('fields.discount')}</label>
        <Input
          className="w-full"
          id="pos-discount"
          type="number"
          min="0"
          step="0.01"
          value={discount}
          onChange={(event) => onDiscountChange(event.target.value)}
        />
      </div>
      <div className="mb-3.5 flex flex-col gap-1.5">
        <div className="flex justify-between text-muted">
          <span>{t('fields.subtotal')}</span>
          <span className="text-right tabular-nums">{formatMoney(totals.subtotal, saleCurrency)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>{t('fields.discount')}</span>
          <span className="text-right tabular-nums">−{formatMoney(totals.discount, saleCurrency)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>{t('fields.tax')}</span>
          <span className="text-right tabular-nums">{formatMoney(totals.tax, saleCurrency)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border pt-2 pb-2 text-[18px] font-bold text-text">
          <span>{t('tables.total')}</span>
          <span className="text-right tabular-nums">{formatMoney(totals.total, saleCurrency)}</span>
        </div>
      </div>
      {!warehouseId ? (
        <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
          {t('pos.selectWarehouseToStart')}
        </div>
      ) : null}
      {checkoutError ? (
        <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
          {checkoutError}
        </div>
      ) : null}
      <button
        type="button"
        className="mt-1 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-ui border border-primary bg-primary px-3 py-3 text-[15px] font-semibold text-white select-none hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        disabled={charging || ticket.length === 0 || !warehouseId}
        onClick={onSubmitCharge}
      >
        {charging ? t('pos.charging') : t('pos.charge', { amount: formatMoney(totals.total, saleCurrency) })}
      </button>
    </div>
  );
}
