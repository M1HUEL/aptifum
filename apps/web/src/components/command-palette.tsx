import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Package, Search, Users, type LucideIcon } from 'lucide-react';
import { apiFetch } from '../api/client';
import type { Customer, Invoice, Paginated, Product } from '../api/types';
import { usePermission } from '../auth/auth-context';
import { ROUTE_GUARDS } from '../auth/route-permissions';
import { Dialog, DialogContent } from './ui/dialog';

interface PaletteItem {
  key: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: string;
  onSelect: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const canProducts = can('inventory:read');
  const canCustomers = can('sales:read');
  const canInvoices = can('invoicing:read');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setProducts([]);
      setCustomers([]);
      setInvoices([]);
      setActiveIndex(0);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setProducts([]);
      setCustomers([]);
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      const requests: Promise<void>[] = [];
      if (canProducts) {
        requests.push(
          apiFetch<Paginated<Product>>(`/api/v1/inventory/products?limit=5&q=${encodeURIComponent(q)}`)
            .then((res) => setProducts(res.data))
            .catch(() => setProducts([])),
        );
      }
      if (canCustomers) {
        requests.push(
          apiFetch<Paginated<Customer>>(`/api/v1/sales/customers?limit=5&q=${encodeURIComponent(q)}`)
            .then((res) => setCustomers(res.data))
            .catch(() => setCustomers([])),
        );
      }
      if (canInvoices) {
        requests.push(
          apiFetch<Paginated<Invoice>>(`/api/v1/sales/invoices?limit=5&q=${encodeURIComponent(q)}`)
            .then((res) => setInvoices(res.data))
            .catch(() => setInvoices([])),
        );
      }
      void Promise.allSettled(requests).then(() => setLoading(false));
    }, 250);
    return () => {
      window.clearTimeout(handle);
      setLoading(false);
    };
  }, [query, open, canProducts, canCustomers, canInvoices]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const pageItems = ROUTE_GUARDS.filter((guard) => !guard.permission || can(guard.permission))
      .filter((guard) => {
        if (!q) return true;
        return t(guard.labelKey).toLowerCase().includes(q) || guard.to.toLowerCase().includes(q);
      })
      .map((guard) => ({
        key: `page-${guard.to}`,
        label: t(guard.labelKey),
        hint: guard.to,
        icon: Search,
        group: t('commandPalette.groups.navigate'),
        onSelect: () => navigate(guard.to),
      }));

    const productItems: PaletteItem[] = products.map((product) => ({
      key: `product-${product.id}`,
      label: product.name,
      hint: product.sku,
      icon: Package,
      group: t('commandPalette.groups.products'),
      onSelect: () => navigate('/products'),
    }));

    const customerItems: PaletteItem[] = customers.map((customer) => ({
      key: `customer-${customer.id}`,
      label: customer.tradeName,
      hint: customer.code,
      icon: Users,
      group: t('commandPalette.groups.customers'),
      onSelect: () => navigate('/customers'),
    }));

    const invoiceItems: PaletteItem[] = invoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      label: invoice.number,
      hint: invoice.customer?.tradeName ?? '',
      icon: FileText,
      group: t('commandPalette.groups.invoices'),
      onSelect: () => navigate('/invoices'),
    }));

    return [...pageItems, ...productItems, ...customerItems, ...invoiceItems];
  }, [query, products, customers, invoices, can, navigate, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, items]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const selectIndex = (index: number) => {
    const item = items[index];
    if (!item) return;
    onOpenChange(false);
    item.onSelect();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectIndex(activeIndex);
    }
  };

  const groups = useMemo(() => {
    const order: string[] = [];
    for (const item of items) {
      if (!order.includes(item.group)) order.push(item.group);
    }
    return order.map((group) => ({ group, items: items.filter((item) => item.group === group) }));
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder')}
            autoFocus
            className="h-12 w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            aria-label={t('commandPalette.placeholder')}
          />
          <kbd className="shrink-0 rounded-ui border border-border bg-bg px-1.5 py-0.5 text-[11px] text-muted">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
          {groups.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-muted">
              {loading ? t('common.loading') : t('commandPalette.empty')}
            </div>
          ) : (
            groups.map(({ group, items: groupItems }) => (
              <div key={group} className="mb-1.5 last:mb-0">
                <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {group}
                </div>
                {groupItems.map((item, localIndex) => {
                  const index = groups
                    .slice(0, groups.findIndex((g) => g.group === group))
                    .reduce((acc, g) => acc + g.items.length, 0) + localIndex;
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-active={index === activeIndex}
                      onClick={() => selectIndex(index)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-ui px-3 py-2 text-left text-[13px] select-none ${
                        index === activeIndex ? 'bg-primary/10 text-text' : 'text-text'
                      }`}
                    >
                      <ItemIcon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint ? <span className="shrink-0 text-[11px] text-muted">{item.hint}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
