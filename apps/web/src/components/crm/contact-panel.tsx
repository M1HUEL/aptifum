import { useState } from 'react';
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
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../ui';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';

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
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CrmContact | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<CrmContact>({
    path: '/api/v1/crm/contacts',
    page: 1,
    limit: 50,
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
      toast.toast(editingId ? 'Contact updated.' : 'Contact created.');
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
        toast.toast('Contact deleted.');
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
    { key: 'fullName', header: 'Full name' },
    { key: 'customer', header: 'Customer', render: (row) => row.customer?.tradeName ?? '—' },
    { key: 'title', header: 'Title', render: (row) => row.title ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '—' },
    {
      key: 'active',
      header: 'Status',
      render: (row) => <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="Contacts linked to customer accounts"
        action={<Button onClick={openCreate}>New contact</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No contacts." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? 'Edit contact' : 'New contact'} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="contact-name">
                  Full name<span className="field-required"> *</span>
                </label>
                <input id="contact-name" {...register('fullName')} />
                {errors.fullName ? <div className="field-error">{errors.fullName.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="contact-customer">Customer</label>
                <select id="contact-customer" {...register('customerId')}>
                  <option value="">— None —</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.tradeName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="contact-title">Title</label>
                <input id="contact-title" {...register('title')} />
              </div>
              <div className="field">
                <label htmlFor="contact-email">Email</label>
                <input id="contact-email" type="email" {...register('email')} />
              </div>
              <div className="field">
                <label htmlFor="contact-phone">Phone</label>
                <input id="contact-phone" {...register('phone')} />
              </div>
              <div className="field">
                <label htmlFor="contact-mobile">Mobile</label>
                <input id="contact-mobile" {...register('mobile')} />
              </div>
              <div className="field">
                <label htmlFor="contact-address">Address</label>
                <textarea id="contact-address" rows={2} {...register('address')} />
              </div>
              <div className="field">
                <label htmlFor="contact-notes">Notes</label>
                <textarea id="contact-notes" rows={2} {...register('notes')} />
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="contact-active"
                    checked={active}
                    onCheckedChange={(checked) => setValue('active', checked === true)}
                  />
                  <label htmlFor="contact-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create contact'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}>
        <DialogContent>
          <DialogHeader title="Delete contact" description={`Delete contact "${deleting?.fullName}"?`} />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={deletingBusy} onClick={() => void confirmDelete()}>
              {deletingBusy ? 'Working…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
