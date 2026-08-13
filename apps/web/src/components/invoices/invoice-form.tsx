import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { Customer, Product, Warehouse } from '../../api/types';
import { invoiceFormSchema, type InvoiceFormValues } from '../../api/schemas';
import { useApiInvalidation, useApiMutation } from '../../api/hooks';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';

type CreateInvoiceDto = components['schemas']['CreateInvoiceDto'];
type CreateInvoiceItemDto = components['schemas']['CreateInvoiceItemDto'];

const makeEmptyItem = (): InvoiceFormValues['items'][number] => ({
  productId: '',
  quantity: '1',
  unitPrice: '',
  taxRate: '',
});

const emptyForm: InvoiceFormValues = {
  customerId: '',
  warehouseId: '',
  dueDate: '',
  discount: '',
  notes: '',
  items: [makeEmptyItem()],
};

function toDto(form: InvoiceFormValues): CreateInvoiceDto {
  return {
    customerId: form.customerId.trim() || undefined,
    warehouseId: form.warehouseId || undefined,
    dueDate: form.dueDate || undefined,
    discount: form.discount === '' ? undefined : Number(form.discount),
    notes: form.notes.trim() || undefined,
    items: form.items.map((item) => {
      const dto: CreateInvoiceItemDto = {
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? undefined : Number(item.unitPrice),
        taxRate: item.taxRate === '' ? undefined : Number(item.taxRate),
      };
      return dto;
    }),
  };
}

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
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: emptyForm,
  });

  const items = watch('items');

  const createMutation = useApiMutation<CreateInvoiceDto>('/api/v1/sales/invoices', 'POST');
  const saving = createMutation.isPending;

  useEffect(() => {
    if (open) {
      reset(emptyForm);
      setFormError(null);
    }
  }, [open, reset]);

  const addItem = () => {
    setValue('items', [...items, makeEmptyItem()]);
  };

  const removeItem = (index: number) => {
    setValue('items', items.filter((_, i) => i !== index));
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    createMutation.mutate(toDto(values), {
      onSuccess: () => {
        toast.toast('Invoice issued.');
        onSaved();
        void invalidate(['paged', '/api/v1/sales/invoices']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader title="Issue invoice" />
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="invoice-customer">Customer *</label>
              <select id="invoice-customer" {...register('customerId')}>
                <option value="">— Select customer —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName}
                  </option>
                ))}
              </select>
              {errors.customerId ? <div className="field-error">{errors.customerId.message}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="invoice-warehouse">Warehouse</label>
              <select id="invoice-warehouse" {...register('warehouseId')}>
                <option value="">— Default —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="invoice-due">Due date</label>
              <input id="invoice-due" type="date" {...register('dueDate')} />
            </div>
            <div className="field">
              <label htmlFor="invoice-discount">Discount</label>
              <input id="invoice-discount" type="number" min="0" step="0.01" {...register('discount')} />
              {errors.discount ? <div className="field-error">{errors.discount.message}</div> : null}
            </div>
          </div>
          <div className="invoice-items">
            {items.map((_, index) => (
              <div className="invoice-item" key={index}>
                <div className="field">
                  <label htmlFor={`invoice-item-product-${index}`}>Product</label>
                  <select id={`invoice-item-product-${index}`} {...register(`items.${index}.productId`)}>
                    <option value="">— Select product —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                      </option>
                    ))}
                  </select>
                  {errors.items?.[index]?.productId ? (
                    <div className="field-error">{errors.items[index]?.productId?.message}</div>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor={`invoice-item-qty-${index}`}>Qty</label>
                  <input
                    id={`invoice-item-qty-${index}`}
                    type="number"
                    min="0.0001"
                    step="any"
                    {...register(`items.${index}.quantity`)}
                  />
                  {errors.items?.[index]?.quantity ? (
                    <div className="field-error">{errors.items[index]?.quantity?.message}</div>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor={`invoice-item-price-${index}`}>Unit price</label>
                  <input
                    id={`invoice-item-price-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="product price"
                    {...register(`items.${index}.unitPrice`)}
                  />
                  {errors.items?.[index]?.unitPrice ? (
                    <div className="field-error">{errors.items[index]?.unitPrice?.message}</div>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor={`invoice-item-tax-${index}`}>Tax %</label>
                  <input
                    id={`invoice-item-tax-${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 18"
                    {...register(`items.${index}.taxRate`)}
                  />
                  {errors.items?.[index]?.taxRate ? (
                    <div className="field-error">{errors.items[index]?.taxRate?.message}</div>
                  ) : null}
                </div>
                <div className="invoice-item-remove">
                  {items.length > 1 ? (
                    <Button variant="ghost" size="sm" type="button" onClick={() => removeItem(index)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={addItem}>
            + Add line
          </Button>
          <div className="field">
            <label htmlFor="invoice-notes">Notes</label>
            <textarea id="invoice-notes" rows={2} {...register('notes')} />
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <DialogFooter>
            <Button variant="default" type="submit" disabled={saving}>
              {saving ? 'Issuing…' : 'Issue invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
