import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Customer, Lead, Opportunity, Paginated } from '../api/types';
import {
  Badge,
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatDate,
  formatMoney,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/ui';
import {
  Button,
  ConfirmDialog,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/usePagedQuery';

const leadStatuses = ['new', 'contacted', 'qualified', 'disqualified', 'converted'] as const;
const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'] as const;

function leadStatusTone(status: Lead['status']): BadgeTone {
  if (status === 'converted') return 'success';
  if (status === 'disqualified') return 'danger';
  if (status === 'qualified') return 'info';
  return 'neutral';
}

function stageTone(stage: Opportunity['stage']): BadgeTone {
  if (stage === 'won') return 'success';
  if (stage === 'lost') return 'danger';
  if (stage === 'negotiation' || stage === 'proposal') return 'info';
  return 'neutral';
}

interface LeadForm {
  source: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  estimatedAmount: string;
  currency: string;
  notes: string;
}

const emptyLead: LeadForm = {
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

interface OpportunityForm {
  name: string;
  customerId: string;
  stage: string;
  amount: string;
  currency: string;
  probability: string;
  expectedCloseDate: string;
  notes: string;
}

const emptyOpportunity: OpportunityForm = {
  name: '',
  customerId: '',
  stage: 'prospecting',
  amount: '',
  currency: 'USD',
  probability: '',
  expectedCloseDate: '',
  notes: '',
};

export function CrmPage() {
  const [tab, setTab] = useState<'leads' | 'opportunities'>('leads');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leadOpen, setLeadOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLead);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSaving, setLeadSaving] = useState(false);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [convertBusy, setConvertBusy] = useState(false);
  const [deleting, setDeleting] = useState<Lead | Opportunity | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [oppOpen, setOppOpen] = useState(false);
  const [editingOppId, setEditingOppId] = useState<string | null>(null);
  const [oppForm, setOppForm] = useState<OpportunityForm>(emptyOpportunity);
  const [oppError, setOppError] = useState<string | null>(null);
  const [oppSaving, setOppSaving] = useState(false);
  const toast = useToast();

  const {
    data: leads,
    error: leadsError,
    reload: reloadLeads,
  } = usePagedQuery<Lead>({ path: '/api/v1/crm/leads', page: 1, limit: 50 });

  const {
    data: opportunities,
    error: opportunitiesError,
    reload: reloadOpportunities,
  } = usePagedQuery<Opportunity>({ path: '/api/v1/crm/opportunities', page: 1, limit: 50 });

  useEffect(() => {
    let cancelled = false;
    void apiFetch<Paginated<Customer>>('/api/v1/sales/customers?page=1&limit=100')
      .then((result) => {
        if (!cancelled) setCustomers(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const openLeadCreate = () => {
    setEditingLeadId(null);
    setLeadForm(emptyLead);
    setLeadError(null);
    setLeadOpen(true);
  };

  const openLeadEdit = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setLeadForm({
      source: lead.source ?? '',
      companyName: lead.companyName ?? '',
      contactName: lead.contactName,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      status: lead.status,
      estimatedAmount: lead.estimatedAmount ? String(lead.estimatedAmount) : '',
      currency: lead.currency,
      notes: lead.notes ?? '',
    });
    setLeadError(null);
    setLeadOpen(true);
  };

  const closeLead = () => {
    if (!leadSaving) setLeadOpen(false);
  };

  const setLeadField = (key: keyof LeadForm, value: string) => {
    setLeadForm((current) => ({ ...current, [key]: value }));
  };

  const submitLead = async (event: FormEvent) => {
    event.preventDefault();
    if (!leadForm.contactName.trim()) {
      setLeadError('Contact name is required.');
      return;
    }
    setLeadSaving(true);
    setLeadError(null);
    const body = {
      source: leadForm.source.trim() || undefined,
      companyName: leadForm.companyName.trim() || undefined,
      contactName: leadForm.contactName.trim(),
      email: leadForm.email.trim() || undefined,
      phone: leadForm.phone.trim() || undefined,
      status: leadForm.status,
      estimatedAmount: leadForm.estimatedAmount === '' ? undefined : Number(leadForm.estimatedAmount),
      currency: leadForm.currency.trim().toUpperCase() || undefined,
      notes: leadForm.notes.trim() || undefined,
    };
    try {
      if (editingLeadId) {
        await apiFetch(`/api/v1/crm/leads/${editingLeadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Lead updated.');
      } else {
        await apiFetch('/api/v1/crm/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Lead created.');
      }
      setLeadOpen(false);
      reloadLeads();
    } catch (err) {
      setLeadError(err instanceof ApiError ? err.message : 'Could not save lead.');
    } finally {
      setLeadSaving(false);
    }
  };

  const confirmConvert = async () => {
    if (!converting) return;
    setConvertBusy(true);
    try {
      await apiFetch(`/api/v1/crm/leads/${converting.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerCode: customerCode.trim() || undefined }),
      });
      toast.toast('Lead converted to customer.');
      setConverting(null);
      setCustomerCode('');
      reloadLeads();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not convert lead.', 'error');
      setConverting(null);
    } finally {
      setConvertBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    const isLead = 'contactName' in deleting;
    try {
      await apiFetch(`${isLead ? '/api/v1/crm/leads' : '/api/v1/crm/opportunities'}/${deleting.id}`, {
        method: 'DELETE',
      });
      toast.toast(isLead ? 'Lead deleted.' : 'Opportunity deleted.');
      setDeleting(null);
      if (isLead) reloadLeads();
      else reloadOpportunities();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete.', 'error');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const openOppCreate = () => {
    setEditingOppId(null);
    setOppForm(emptyOpportunity);
    setOppError(null);
    setOppOpen(true);
  };

  const openOppEdit = (opportunity: Opportunity) => {
    setEditingOppId(opportunity.id);
    setOppForm({
      name: opportunity.name,
      customerId: opportunity.customerId ?? '',
      stage: opportunity.stage,
      amount: opportunity.amount ? String(opportunity.amount) : '',
      currency: opportunity.currency,
      probability: opportunity.probability ? String(opportunity.probability) : '',
      expectedCloseDate: opportunity.expectedCloseDate ?? '',
      notes: opportunity.notes ?? '',
    });
    setOppError(null);
    setOppOpen(true);
  };

  const closeOpp = () => {
    if (!oppSaving) setOppOpen(false);
  };

  const setOppField = (key: keyof OpportunityForm, value: string) => {
    setOppForm((current) => ({ ...current, [key]: value }));
  };

  const submitOpportunity = async (event: FormEvent) => {
    event.preventDefault();
    if (!oppForm.name.trim()) {
      setOppError('Name is required.');
      return;
    }
    setOppSaving(true);
    setOppError(null);
    const body = {
      name: oppForm.name.trim(),
      customerId: oppForm.customerId || undefined,
      stage: oppForm.stage,
      amount: oppForm.amount === '' ? undefined : Number(oppForm.amount),
      currency: oppForm.currency.trim().toUpperCase() || undefined,
      probability: oppForm.probability === '' ? undefined : Number(oppForm.probability),
      expectedCloseDate: oppForm.expectedCloseDate || undefined,
      notes: oppForm.notes.trim() || undefined,
    };
    try {
      if (editingOppId) {
        await apiFetch(`/api/v1/crm/opportunities/${editingOppId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Opportunity updated.');
      } else {
        await apiFetch('/api/v1/crm/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Opportunity created.');
      }
      setOppOpen(false);
      reloadOpportunities();
    } catch (err) {
      setOppError(err instanceof ApiError ? err.message : 'Could not save opportunity.');
    } finally {
      setOppSaving(false);
    }
  };

  const runStageAction = async (id: string, action: 'mark-won' | 'mark-lost', message: string) => {
    try {
      await apiFetch(`/api/v1/crm/opportunities/${id}/${action}`, { method: 'POST' });
      toast.toast(message);
      reloadOpportunities();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    }
  };

  const leadColumns: Column<Lead>[] = [
    { key: 'number', header: 'Number' },
    { key: 'contactName', header: 'Contact' },
    { key: 'companyName', header: 'Company', render: (row) => row.companyName ?? '—' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    {
      key: 'estimatedAmount',
      header: 'Est. amount',
      render: (row) => formatMoney(row.estimatedAmount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={leadStatusTone(row.status)}>{row.status}</Badge>,
    },
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
          <Button variant="ghost" size="sm" onClick={() => openLeadEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const opportunityColumns: Column<Opportunity>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => row.customer?.tradeName ?? '—',
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (row) => <Badge tone={stageTone(row.stage)}>{row.stage}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatMoney(row.amount),
    },
    {
      key: 'probability',
      header: 'Probability',
      render: (row) => `${row.probability}%`,
    },
    {
      key: 'expectedCloseDate',
      header: 'Expected close',
      render: (row) => formatDate(row.expectedCloseDate),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.stage !== 'won' && row.stage !== 'lost' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void runStageAction(row.id, 'mark-won', 'Opportunity marked as won.')}
              >
                Won
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void runStageAction(row.id, 'mark-lost', 'Opportunity marked as lost.')}
              >
                Lost
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => openOppEdit(row)}>
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
        title="CRM"
        subtitle="Leads and opportunities"
        action={
          tab === 'leads' ? (
            <Button onClick={openLeadCreate}>New lead</Button>
          ) : (
            <Button onClick={openOppCreate}>New opportunity</Button>
          )
        }
      />
      <div className="tabs">
        <button type="button" className={tab === 'leads' ? 'tab tab-active' : 'tab'} onClick={() => setTab('leads')}>
          Leads
        </button>
        <button
          type="button"
          className={tab === 'opportunities' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('opportunities')}
        >
          Opportunities
        </button>
      </div>
      {tab === 'leads' ? (
        <>
          {leadsError ? <ErrorBanner message={leadsError} /> : null}
          {!leads && !leadsError ? <LoadingBlock /> : null}
          {leads ? (
            <>
              {leads.data.length === 0 ? (
                <EmptyState message="No leads." />
              ) : (
                <DataTable columns={leadColumns} rows={leads.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={leads.meta.page} limit={leads.meta.limit} total={leads.meta.total} onPage={() => {}} />
            </>
          ) : null}
        </>
      ) : (
        <>
          {opportunitiesError ? <ErrorBanner message={opportunitiesError} /> : null}
          {!opportunities && !opportunitiesError ? <LoadingBlock /> : null}
          {opportunities ? (
            <>
              {opportunities.data.length === 0 ? (
                <EmptyState message="No opportunities." />
              ) : (
                <DataTable columns={opportunityColumns} rows={opportunities.data} rowKey={(row) => row.id} />
              )}
              <Pagination
                page={opportunities.meta.page}
                limit={opportunities.meta.limit}
                total={opportunities.meta.total}
                onPage={() => {}}
              />
            </>
          ) : null}
        </>
      )}

      <Modal
        open={leadOpen}
        title={editingLeadId ? 'Edit lead' : 'New lead'}
        onClose={closeLead}
        width="lg"
      >
        <form onSubmit={(event) => void submitLead(event)}>
          <div className="form-grid">
            <Field label="Contact name" htmlFor="lead-contact" required>
              <TextInput
                id="lead-contact"
                value={leadForm.contactName}
                onChange={(event) => setLeadField('contactName', event.target.value)}
              />
            </Field>
            <Field label="Company" htmlFor="lead-company">
              <TextInput
                id="lead-company"
                value={leadForm.companyName}
                onChange={(event) => setLeadField('companyName', event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="lead-email">
              <TextInput
                id="lead-email"
                type="email"
                value={leadForm.email}
                onChange={(event) => setLeadField('email', event.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="lead-phone">
              <TextInput
                id="lead-phone"
                value={leadForm.phone}
                onChange={(event) => setLeadField('phone', event.target.value)}
              />
            </Field>
            <Field label="Source" htmlFor="lead-source">
              <TextInput
                id="lead-source"
                value={leadForm.source}
                onChange={(event) => setLeadField('source', event.target.value)}
              />
            </Field>
            <Field label="Status" htmlFor="lead-status">
              <Select
                id="lead-status"
                value={leadForm.status}
                onChange={(event) => setLeadField('status', event.target.value)}
              >
                {leadStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estimated amount" htmlFor="lead-amount">
              <TextInput
                id="lead-amount"
                type="number"
                min="0"
                step="0.01"
                value={leadForm.estimatedAmount}
                onChange={(event) => setLeadField('estimatedAmount', event.target.value)}
              />
            </Field>
            <Field label="Currency" htmlFor="lead-currency">
              <TextInput
                id="lead-currency"
                maxLength={3}
                value={leadForm.currency}
                onChange={(event) => setLeadField('currency', event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="lead-notes">
              <TextArea
                id="lead-notes"
                rows={3}
                value={leadForm.notes}
                onChange={(event) => setLeadField('notes', event.target.value)}
              />
            </Field>
          </div>
          {leadError ? <div className="error-banner">{leadError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeLead} disabled={leadSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={leadSaving}>
              {leadSaving ? 'Saving…' : editingLeadId ? 'Save changes' : 'Create lead'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={oppOpen} title={editingOppId ? 'Edit opportunity' : 'New opportunity'} onClose={closeOpp} width="lg">
        <form onSubmit={(event) => void submitOpportunity(event)}>
          <div className="form-grid">
            <Field label="Name" htmlFor="opp-name" required>
              <TextInput
                id="opp-name"
                value={oppForm.name}
                onChange={(event) => setOppField('name', event.target.value)}
              />
            </Field>
            <Field label="Customer" htmlFor="opp-customer">
              <Select
                id="opp-customer"
                value={oppForm.customerId}
                onChange={(event) => setOppField('customerId', event.target.value)}
              >
                <option value="">— None —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stage" htmlFor="opp-stage">
              <Select
                id="opp-stage"
                value={oppForm.stage}
                onChange={(event) => setOppField('stage', event.target.value)}
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" htmlFor="opp-amount">
              <TextInput
                id="opp-amount"
                type="number"
                min="0"
                step="0.01"
                value={oppForm.amount}
                onChange={(event) => setOppField('amount', event.target.value)}
              />
            </Field>
            <Field label="Currency" htmlFor="opp-currency">
              <TextInput
                id="opp-currency"
                maxLength={3}
                value={oppForm.currency}
                onChange={(event) => setOppField('currency', event.target.value)}
              />
            </Field>
            <Field label="Probability (%)" htmlFor="opp-probability">
              <TextInput
                id="opp-probability"
                type="number"
                min="0"
                max="100"
                step="1"
                value={oppForm.probability}
                onChange={(event) => setOppField('probability', event.target.value)}
              />
            </Field>
            <Field label="Expected close date" htmlFor="opp-close">
              <TextInput
                id="opp-close"
                type="date"
                value={oppForm.expectedCloseDate}
                onChange={(event) => setOppField('expectedCloseDate', event.target.value)}
              />
            </Field>
            <Field label="Notes" htmlFor="opp-notes">
              <TextArea
                id="opp-notes"
                rows={3}
                value={oppForm.notes}
                onChange={(event) => setOppField('notes', event.target.value)}
              />
            </Field>
          </div>
          {oppError ? <div className="error-banner">{oppError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeOpp} disabled={oppSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={oppSaving}>
              {oppSaving ? 'Saving…' : editingOppId ? 'Save changes' : 'Create opportunity'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={converting !== null}
        title={`Convert lead ${converting?.number ?? ''}`}
        onClose={() => setConverting(null)}
        width="sm"
      >
        <p className="modal-message">
          Create a customer account for “{converting?.contactName}”. A customer code is generated
          automatically unless you provide one.
        </p>
        <Field label="Customer code" htmlFor="convert-code">
          <TextInput
            id="convert-code"
            value={customerCode}
            onChange={(event) => setCustomerCode(event.target.value)}
          />
        </Field>
        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setConverting(null)} disabled={convertBusy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void confirmConvert()} disabled={convertBusy}>
            {convertBusy ? 'Converting…' : 'Convert to customer'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting && 'contactName' in deleting ? 'Delete lead' : 'Delete opportunity'}
        message={
          deleting && 'contactName' in deleting
            ? `Delete lead for "${deleting.contactName}"? This cannot be undone.`
            : `Delete opportunity "${deleting?.name}"? This cannot be undone.`
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
