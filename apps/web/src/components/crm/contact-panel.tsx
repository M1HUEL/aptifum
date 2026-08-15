import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { CrmContact, Customer } from '../../api/types';
import { contactFormSchema, type ContactFormValues } from '../../api/schemas';
import { useApiMutation, useApiMutationVoid } from '../../api/hooks';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pagination,
  TableSkeleton,
  Input,
  Select,
  Textarea,
} from '../ui';
import { Contact } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { exportRowsToCsv } from '../../lib/csv';

type CreateContactDto = components['schemas']['CreateContactDto'];
type UpdateContactDto = components['schemas']['UpdateContactDto'];

const emptyContact: ContactFormValues = {
  fullName: '',
  customerId: '',
  title: '',
  email: '',
  phone: '',
  mobile: '',
  address: '',
  notes: '',
  active: true,
};

function toContactForm(contact: CrmContact): ContactFormValues {
  return {
    fullName: contact.fullName,
    customerId: contact.customerId ?? '',
    title: contact.title ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    mobile: contact.mobile ?? '',
    address: contact.address ?? '',
    notes: contact.notes ?? '',
    active: contact.active,
  };
}

function contactToDto(form: ContactFormValues): CreateContactDto {
  return {
    fullName: form.fullName.trim(),
    customerId: form.customerId || undefined,
    title: form.title.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    mobile: form.mobile.trim() || undefined,
    address: form.address.trim() || undefined,
    notes: form.notes.trim() || undefined,
    active: form.active,
  };
}

export function ContactPanel({ customers }: { customers: Customer[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CrmContact | null>(null);
  const [limit, setLimit] = useState(50);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<CrmContact>({
    path: '/api/v1/crm/contacts',
    page: 1,
    limit,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: emptyContact,
  });
  const active = watch('active');

  const createMutation = useApiMutation<CreateContactDto>('/api/v1/crm/contacts', 'POST');
  const updateMutation = useApiMutation<UpdateContactDto>(
    `/api/v1/crm/contacts/${editingId ?? ''}`,
    'PATCH',
  );
  const deleteMutation = useApiMutationVoid(`/api/v1/crm/contacts/${deleting?.id ?? ''}`, 'DELETE');

  const saving = createMutation.isPending || updateMutation.isPending;
  const deletingBusy = deleteMutation.isPending;

  const openCreate = () => {
    setEditingId(null);
    reset(emptyContact);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (contact: CrmContact) => {
    setEditingId(contact.id);
    reset(toContactForm(contact));
    setFormError(null);
    setOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? t('crm.contactUpdated') : t('crm.contactCreated'));
      setOpen(false);
      void reload();
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(contactToDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(contactToDto(values), { onSuccess, onError });
    }
  });

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t('crm.contactDeleted'));
        setDeleting(null);
        void reload();
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeleting(null);
      },
    });
  };

  const columns: Column<CrmContact>[] = [
    { key: 'fullName', header: t('fields.fullName') },
    { key: 'customer', header: t('fields.customer'), render: (row) => row.customer?.tradeName ?? '—' },
    { key: 'title', header: t('crm.title'), render: (row) => row.title ?? '—' },
    { key: 'email', header: t('fields.email'), render: (row) => row.email ?? '—' },
    { key: 'phone', header: t('fields.phone'), render: (row) => row.phone ?? '—' },
    {
      key: 'active',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? t('common.active') : t('common.inactive')}</Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  const handleLimitChange = (next: number) => {
    setLimit(next);
  };

  const handleExport = () => {
    if (!data || data.data.length === 0) return;
    exportRowsToCsv({ filename: 'contacts', columns, rows: data.data });
  };

  return (
    <>
      <PageHeader
        title={t('crm.contactsTitle')}
        subtitle={t('crm.contactsSubtitle')}
        action={
          <div className="flex justify-end gap-2">
            <Button type="button" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </Button>
            <Button onClick={openCreate}>{t('crm.newContact')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <TableSkeleton columns={columns.length} /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message={t('crm.noContacts')} icon={<Contact className="size-6" />} />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? t('crm.editContact') : t('crm.newContact')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-name">
                  {t('fields.fullName')}<span className="text-danger"> *</span>
                </label>
                <Input className="w-full" id="contact-name" {...register('fullName')} />
                {errors.fullName ? <div className="text-[12px] font-normal text-danger">{errors.fullName.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-customer">{t('fields.customer')}</label>
                <Select className="w-full" id="contact-customer" {...register('customerId')}>
                  <option value="">{t('crm.none')}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.tradeName}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-title">{t('crm.title')}</label>
                <Input className="w-full" id="contact-title" {...register('title')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-email">{t('fields.email')}</label>
                <Input className="w-full" id="contact-email" type="email" {...register('email')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-phone">{t('fields.phone')}</label>
                <Input className="w-full" id="contact-phone" {...register('phone')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-mobile">{t('crm.mobile')}</label>
                <Input className="w-full" id="contact-mobile" {...register('mobile')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-address">{t('fields.address')}</label>
                <Textarea className="w-full" id="contact-address" rows={2} {...register('address')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="contact-notes">{t('fields.notes')}</label>
                <Textarea className="w-full" id="contact-notes" rows={2} {...register('notes')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label>{t('common.status')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="contact-active"
                    checked={active}
                    onCheckedChange={(checked) => setValue('active', checked === true)}
                  />
                  <label htmlFor="contact-active" className="text-sm text-gray-700">
                    {t('common.active')}
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('crm.createContact')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}
        title={t('crm.deleteContactTitle')}
        description={t('crm.deleteContactMessage', { name: deleting?.fullName })}
        confirmLabel={t('common.delete')}
        busy={deletingBusy}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
