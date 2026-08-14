import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { Customer, Product, Warehouse } from '../../api/types';
import { invoiceFormSchema, type InvoiceFormValues } from '../../api/schemas';
import { useApiInvalidation, useApiMutation } from '../../api/hooks';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { SearchableSelect } from '../ui/searchable-select';
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
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: emptyForm,
  });

  const items = watch('items');
  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: customer.tradeName,
  }));
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.sku} · ${product.name}`,
  }));

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
        toast.toast(t('invoices.invoiceIssued'));
        onSaved();
        void invalidate(['paged', '/api/v1/sales/invoices']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader title={t('invoices.issueInvoice')} />
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="invoice-customer">
                {t('fields.customer')} <span className="field-required">*</span>
              </label>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={customerOptions}
                    placeholder={t('invoices.selectCustomer')}
                    ariaLabel={t('fields.customer')}
                  />
                )}
              />
              {errors.customerId ? <div className="field-error">{errors.customerId.message}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="invoice-warehouse">{t('fields.warehouse')}</label>
              <select id="invoice-warehouse" {...register('warehouseId')}>
                <option value="">{t('invoices.defaultWarehouse')}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="invoice-due">{t('fields.dueDate')}</label>
              <input id="invoice-due" type="date" {...register('dueDate')} />
            </div>
            <div className="field">
              <label htmlFor="invoice-discount">{t('fields.discount')}</label>
              <input id="invoice-discount" type="number" min="0" step="0.01" {...register('discount')} />
              {errors.discount ? <div className="field-error">{errors.discount.message}</div> : null}
            </div>
          </div>
          <div className="invoice-items">
            {items.map((_, index) => (
              <div className="invoice-item" key={index}>
                <div className="field">
                  <label htmlFor={`invoice-item-product-${index}`}>{t('fields.product')}</label>
                  <Controller
                    control={control}
                    name={`items.${index}.productId`}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={productOptions}
                        placeholder={t('invoices.selectProduct')}
                        ariaLabel={t('fields.product')}
                      />
                    )}
                  />
                  {errors.items?.[index]?.productId ? (
                    <div className="field-error">{errors.items[index]?.productId?.message}</div>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor={`invoice-item-qty-${index}`}>{t('fields.qty')}</label>
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
                  <label htmlFor={`invoice-item-price-${index}`}>{t('fields.unitPrice')}</label>
                  <input
                    id={`invoice-item-price-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t('invoices.unitPricePlaceholder')}
                    {...register(`items.${index}.unitPrice`)}
                  />
                  {errors.items?.[index]?.unitPrice ? (
                    <div className="field-error">{errors.items[index]?.unitPrice?.message}</div>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor={`invoice-item-tax-${index}`}>{t('invoices.taxPercent')}</label>
                  <input
                    id={`invoice-item-tax-${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder={t('invoices.taxPlaceholder')}
                    {...register(`items.${index}.taxRate`)}
                  />
                  {errors.items?.[index]?.taxRate ? (
                    <div className="field-error">{errors.items[index]?.taxRate?.message}</div>
                  ) : null}
                </div>
                <div className="invoice-item-remove">
                  {items.length > 1 ? (
                    <Button variant="ghost" size="sm" type="button" onClick={() => removeItem(index)}>
                      {t('common.remove')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={addItem}>
            {t('common.addLine')}
          </Button>
          <div className="field">
            <label htmlFor="invoice-notes">{t('fields.notes')}</label>
            <textarea id="invoice-notes" rows={2} {...register('notes')} />
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <DialogFooter>
            <Button variant="default" type="submit" disabled={saving}>
              {saving ? t('invoices.issuing') : t('invoices.issueInvoice')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
