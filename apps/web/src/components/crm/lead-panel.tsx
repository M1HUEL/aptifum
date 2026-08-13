import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../../api/schema';
import type { Lead } from '../../api/types';
import { leadFormSchema, type LeadFormValues } from '../../api/schemas';
import { useApiMutation, useApiMutationVoid } from '../../api/hooks';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../ui';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../ui/dialog';
import { useToast } from '../toast';
import { usePagedQuery } from '../../hooks/use-paged-query';
import { leadStatusTone, leadStatuses } from './crm-helpers';

type CreateLeadDto = components['schemas']['CreateLeadDto'];
type UpdateLeadDto = components['schemas']['UpdateLeadDto'];

const emptyLead: LeadFormValues = {
  source: '',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  status: 'new',
  estimatedAmount: '',
  currency: 'USD',
  notes: '',
};

function toLeadForm(lead: Lead): LeadFormValues {
  return {
    source: lead.source ?? '',
    companyName: lead.companyName ?? '',
    contactName: lead.contactName,
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    status: lead.status,
    estimatedAmount: lead.estimatedAmount ? String(lead.estimatedAmount) : '',
    currency: lead.currency,
    notes: lead.notes ?? '',
  };
}

function leadToDto(form: LeadFormValues): CreateLeadDto {
  return {
    source: form.source.trim() || undefined,
    companyName: form.companyName.trim() || undefined,
    contactName: form.contactName.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    status: form.status,
    estimatedAmount: form.estimatedAmount === '' ? undefined : Number(form.estimatedAmount),
    currency: form.currency.trim().toUpperCase() || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function LeadPanel() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Lead>({ path: '/api/v1/crm/leads', page: 1, limit: 50 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: emptyLead,
  });

  const createMutation = useApiMutation<CreateLeadDto>('/api/v1/crm/leads', 'POST');
  const updateMutation = useApiMutation<UpdateLeadDto>(`/api/v1/crm/leads/${editingId ?? ''}`, 'PATCH');
  const convertMutation = useApiMutation<{ customerCode?: string }>(
    `/api/v1/crm/leads/${converting?.id ?? ''}/convert`,
    'POST',
  );
  const deleteMutation = useApiMutationVoid(`/api/v1/crm/leads/${deleting?.id ?? ''}`, 'DELETE');

  const saving = createMutation.isPending || updateMutation.isPending;
  const convertBusy = convertMutation.isPending;
  const deletingBusy = deleteMutation.isPending;

  const openCreate = () => {
    setEditingId(null);
    reset(emptyLead);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    reset(toLeadForm(lead));
    setFormError(null);
    setOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? 'Lead updated.' : 'Lead created.');
      setOpen(false);
      void reload();
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(leadToDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(leadToDto(values), { onSuccess, onError });
    }
  });

  const confirmConvert = () => {
    if (!converting) return;
    convertMutation.mutate(
      { customerCode: customerCode.trim() || undefined },
      {
        onSuccess: () => {
          toast.toast('Lead converted to customer.');
          setConverting(null);
          setCustomerCode('');
          void reload();
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
          setConverting(null);
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast('Lead deleted.');
        setDeleting(null);
        void reload();
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeleting(null);
      },
    });
  };

  const columns: Column<Lead>[] = [
    { key: 'number', header: 'Number' },
    { key: 'contactName', header: 'Contact' },
    { key: 'companyName', header: 'Company', render: (row) => row.companyName ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'estimatedAmount', header: 'Est. amount', render: (row) => formatMoney(row.estimatedAmount) },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={leadStatusTone(row.status)}>{row.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status !== 'converted' ? (
            <Button variant="ghost" size="sm" onClick={() => setConverting(row)}>
              Convert
            </Button>
          ) : null}
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
        title="Leads"
        subtitle="Track and qualify sales leads"
        action={<Button onClick={openCreate}>New lead</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No leads." />
          ) : (
            <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={() => {}} />
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(isOpen) => !saving && setOpen(isOpen)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? 'Edit lead' : 'New lead'} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="lead-contact">
                  Contact name<span className="field-required"> *</span>
                </label>
                <input id="lead-contact" {...register('contactName')} />
                {errors.contactName ? (
                  <div className="field-error">{errors.contactName.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="lead-company">Company</label>
                <input id="lead-company" {...register('companyName')} />
              </div>
              <div className="field">
                <label htmlFor="lead-email">Email</label>
                <input id="lead-email" type="email" {...register('email')} />
              </div>
              <div className="field">
                <label htmlFor="lead-phone">Phone</label>
                <input id="lead-phone" {...register('phone')} />
              </div>
              <div className="field">
                <label htmlFor="lead-source">Source</label>
                <input id="lead-source" {...register('source')} />
              </div>
              <div className="field">
                <label htmlFor="lead-status">Status</label>
                <select id="lead-status" {...register('status')}>
                  {leadStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="lead-amount">Estimated amount</label>
                <input id="lead-amount" type="number" min="0" step="0.01" {...register('estimatedAmount')} />
              </div>
              <div className="field">
                <label htmlFor="lead-currency">Currency</label>
                <input id="lead-currency" maxLength={3} {...register('currency')} />
              </div>
              <div className="field">
                <label htmlFor="lead-notes">Notes</label>
                <textarea id="lead-notes" rows={3} {...register('notes')} />
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={converting !== null} onOpenChange={(isOpen) => !convertBusy && !isOpen && setConverting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader title={`Convert lead ${converting?.number ?? ''}`} />
          <p className="modal-message">
            Create a customer account for “{converting?.contactName}”. A customer code is generated automatically
            unless you provide one.
          </p>
          <div className="field">
            <label htmlFor="convert-code">Customer code</label>
            <input id="convert-code" value={customerCode} onChange={(event) => setCustomerCode(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="default" type="button" disabled={convertBusy} onClick={() => void confirmConvert()}>
              {convertBusy ? 'Converting…' : 'Convert to customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(isOpen) => !deletingBusy && !isOpen && setDeleting(null)}>
        <DialogContent>
          <DialogHeader
            title="Delete lead"
            description={`Delete lead for "${deleting?.contactName}"? This cannot be undone.`}
          />
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
