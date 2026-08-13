import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../api/client';
import type { Customer, Product, Warehouse } from '../../api/types';
import { Button, Field, Modal, Select, TextArea, TextInput } from '../forms';
import { useToast } from '../toast';

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
const emptyForm: InvoiceForm = {
  customerId: '',
  warehouseId: '',
  dueDate: '',
  discount: '',
  notes: '',
  items: [emptyItem],
};

export function InvoiceFormModal({
  open,
  onClose,
  onSaved,
  customers,
  products,
  warehouses,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setFormError(null);
    }
  }, [open]);

  const close = () => {
    if (!saving) onClose();
  };

  const setField = (key: keyof InvoiceForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setItemField = (index: number, key: keyof InvoiceItemForm, value: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };

  const addItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, emptyItem] }));
  };

  const removeItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const items = form.items
      .filter((item) => item.productId)
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? undefined : Number(item.unitPrice),
        taxRate: item.taxRate === '' ? undefined : Number(item.taxRate),
      }));
    if (items.length === 0) {
      setFormError('Add at least one line item.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      customerId: form.customerId || undefined,
      warehouseId: form.warehouseId || undefined,
      dueDate: form.dueDate || undefined,
      discount: form.discount === '' ? undefined : Number(form.discount),
      notes: form.notes.trim() || undefined,
      items,
    };
    try {
      await apiFetch('/api/v1/sales/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Invoice issued.');
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not issue invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Issue invoice" onClose={close} width="lg">
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <Field label="Customer" htmlFor="invoice-customer" required>
            <Select
              id="invoice-customer"
              value={form.customerId}
              onChange={(event) => setField('customerId', event.target.value)}
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
              value={form.warehouseId}
              onChange={(event) => setField('warehouseId', event.target.value)}
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
              value={form.dueDate}
              onChange={(event) => setField('dueDate', event.target.value)}
            />
          </Field>
          <Field label="Discount" htmlFor="invoice-discount">
            <TextInput
              id="invoice-discount"
              type="number"
              min="0"
              step="0.01"
              value={form.discount}
              onChange={(event) => setField('discount', event.target.value)}
            />
          </Field>
        </div>
        <div className="invoice-items">
          {form.items.map((item, index) => (
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
                {form.items.length > 1 ? (
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
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </Field>
        {formError ? <div className="error-banner">{formError}</div> : null}
        <div className="modal-footer">
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Issuing…' : 'Issue invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
