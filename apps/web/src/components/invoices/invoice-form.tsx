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
import { Input, Select, Textarea } from '../ui';

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
          <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="invoice-customer">
                {t('fields.customer')} <span className="text-danger">*</span>
              </label>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <SearchableSelect
                    id="invoice-customer"
                    value={field.value}
                    onChange={field.onChange}
                    options={customerOptions}
                    placeholder={t('invoices.selectCustomer')}
                    ariaLabel={t('fields.customer')}
                  />
                )}
              />
              {errors.customerId ? <div className="text-[12px] font-normal text-danger">{errors.customerId.message}</div> : null}
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="invoice-warehouse">{t('fields.warehouse')}</label>
              <Select className="w-full" id="invoice-warehouse" {...register('warehouseId')}>
                <option value="">{t('invoices.defaultWarehouse')}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="invoice-due">{t('fields.dueDate')}</label>
              <Input className="w-full" id="invoice-due" type="date" {...register('dueDate')} />
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="invoice-discount">{t('fields.discount')}</label>
              <Input className="w-full" id="invoice-discount" type="number" min="0" step="0.01" {...register('discount')} />
              {errors.discount ? <div className="text-[12px] font-normal text-danger">{errors.discount.message}</div> : null}
            </div>
          </div>
          <div className="mb-3 overflow-hidden rounded-ui border border-border bg-surface shadow-(--shadow)">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="h-10 bg-bg px-[14px] text-left align-middle text-xs font-medium uppercase tracking-wide text-muted">
                    {t('fields.product')}
                  </th>
                  <th className="h-10 w-[90px] bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                    {t('fields.qty')}
                  </th>
                  <th className="h-10 w-[130px] bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                    {t('fields.unitPrice')}
                  </th>
                  <th className="h-10 w-[110px] bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                    {t('invoices.taxPercent')}
                  </th>
                  <th className="h-10 w-12 bg-bg" />
                </tr>
              </thead>
              <tbody>
                {items.map((_, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-[14px] py-2.5 align-top">
                      <div className="flex flex-col gap-1">
                        <Controller
                          control={control}
                          name={`items.${index}.productId`}
                          render={({ field }) => (
                            <SearchableSelect
                              id={`invoice-item-product-${index}`}
                              value={field.value}
                              onChange={field.onChange}
                              options={productOptions}
                              placeholder={t('invoices.selectProduct')}
                              ariaLabel={t('fields.product')}
                            />
                          )}
                        />
                        {errors.items?.[index]?.productId ? (
                          <div className="text-[12px] font-normal text-danger">{errors.items[index]?.productId?.message}</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-[14px] py-2.5 align-top">
                      <Input className="w-full text-right"
                        id={`invoice-item-qty-${index}`}
                        type="number"
                        min="0.0001"
                        step="any"
                        {...register(`items.${index}.quantity`)}
                      />
                      {errors.items?.[index]?.quantity ? (
                        <div className="text-[12px] font-normal text-danger">{errors.items[index]?.quantity?.message}</div>
                      ) : null}
                    </td>
                    <td className="px-[14px] py-2.5 align-top">
                      <Input className="w-full text-right"
                        id={`invoice-item-price-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('invoices.unitPricePlaceholder')}
                        {...register(`items.${index}.unitPrice`)}
                      />
                      {errors.items?.[index]?.unitPrice ? (
                        <div className="text-[12px] font-normal text-danger">{errors.items[index]?.unitPrice?.message}</div>
                      ) : null}
                    </td>
                    <td className="px-[14px] py-2.5 align-top">
                      <Input className="w-full text-right"
                        id={`invoice-item-tax-${index}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder={t('invoices.taxPlaceholder')}
                        {...register(`items.${index}.taxRate`)}
                      />
                      {errors.items?.[index]?.taxRate ? (
                        <div className="text-[12px] font-normal text-danger">{errors.items[index]?.taxRate?.message}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-center align-top">
                      {items.length > 1 ? (
                        <Button variant="ghost" size="sm" type="button" onClick={() => removeItem(index)}>
                          {t('common.remove')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={addItem}>
            {t('common.addLine')}
          </Button>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="invoice-notes">{t('fields.notes')}</label>
            <Textarea className="w-full" id="invoice-notes" rows={2} {...register('notes')} />
          </div>
          {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
          <DialogFooter>
            <Button variant="default" type="submit" disabled={saving} loading={saving}>
              {saving ? t('invoices.issuing') : t('invoices.issueInvoice')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
