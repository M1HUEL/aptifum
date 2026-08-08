import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type {
  ActivityType,
  CrmActivity,
  CrmContact,
  Customer,
  Lead,
  Opportunity,
  Paginated,
} from '../api/types';
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
  Checkbox,
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

const activityTypes: ActivityType[] = ['call', 'meeting', 'task', 'note'];

interface ContactForm {
  fullName: string;
  customerId: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  notes: string;
  active: boolean;
}

const emptyContact: ContactForm = {
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

interface ActivityForm {
  activityType: string;
  subject: string;
  description: string;
  dueAt: string;
  completedAt: string;
  referenceType: string;
  referenceId: string;
}

const emptyActivity: ActivityForm = {
  activityType: 'task',
  subject: '',
  description: '',
  dueAt: '',
  completedAt: '',
  referenceType: '',
  referenceId: '',
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CrmPage() {
  const [tab, setTab] = useState<'leads' | 'opportunities' | 'contacts' | 'activities'>('leads');
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
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [deletingContact, setDeletingContact] = useState<CrmContact | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>(emptyActivity);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activitySaving, setActivitySaving] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<CrmActivity | null>(null);
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

  const {
    data: contacts,
    error: contactsError,
    reload: reloadContacts,
  } = usePagedQuery<CrmContact>({ path: '/api/v1/crm/contacts', page: 1, limit: 50 });

  const {
    data: activities,
    error: activitiesError,
    reload: reloadActivities,
  } = usePagedQuery<CrmActivity>({ path: '/api/v1/crm/activities', page: 1, limit: 50 });

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

  const openContactCreate = () => {
    setEditingContactId(null);
    setContactForm(emptyContact);
    setContactError(null);
    setContactOpen(true);
  };

  const openContactEdit = (contact: CrmContact) => {
    setEditingContactId(contact.id);
    setContactForm({
      fullName: contact.fullName,
      customerId: contact.customerId ?? '',
      title: contact.title ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      mobile: contact.mobile ?? '',
      address: contact.address ?? '',
      notes: contact.notes ?? '',
      active: contact.active,
    });
    setContactError(null);
    setContactOpen(true);
  };

  const closeContact = () => {
    if (!contactSaving) setContactOpen(false);
  };

  const submitContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!contactForm.fullName.trim()) {
      setContactError('Full name is required.');
      return;
    }
    setContactSaving(true);
    setContactError(null);
    const body = {
      fullName: contactForm.fullName.trim(),
      customerId: contactForm.customerId || undefined,
      title: contactForm.title.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      phone: contactForm.phone.trim() || undefined,
      mobile: contactForm.mobile.trim() || undefined,
      address: contactForm.address.trim() || undefined,
      notes: contactForm.notes.trim() || undefined,
      active: contactForm.active,
    };
    try {
      if (editingContactId) {
        await apiFetch(`/api/v1/crm/contacts/${editingContactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Contact updated.');
      } else {
        await apiFetch('/api/v1/crm/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Contact created.');
      }
      setContactOpen(false);
      reloadContacts();
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : 'Could not save contact.');
    } finally {
      setContactSaving(false);
    }
  };

  const confirmDeleteContact = async () => {
    if (!deletingContact) return;
    try {
      await apiFetch(`/api/v1/crm/contacts/${deletingContact.id}`, { method: 'DELETE' });
      toast.toast('Contact deleted.');
      setDeletingContact(null);
      reloadContacts();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete contact.', 'error');
      setDeletingContact(null);
    }
  };

  const openActivityCreate = () => {
    setEditingActivityId(null);
    setActivityForm(emptyActivity);
    setActivityError(null);
    setActivityOpen(true);
  };

  const openActivityEdit = (activity: CrmActivity) => {
    setEditingActivityId(activity.id);
    setActivityForm({
      activityType: activity.activityType,
      subject: activity.subject,
      description: activity.description ?? '',
      dueAt: toLocalInput(activity.dueAt),
      completedAt: toLocalInput(activity.completedAt),
      referenceType: activity.referenceType ?? '',
      referenceId: activity.referenceId ?? '',
    });
    setActivityError(null);
    setActivityOpen(true);
  };

  const closeActivity = () => {
    if (!activitySaving) setActivityOpen(false);
  };

  const submitActivity = async (event: FormEvent) => {
    event.preventDefault();
    if (!activityForm.subject.trim()) {
      setActivityError('Subject is required.');
      return;
    }
    setActivitySaving(true);
    setActivityError(null);
    const body = {
      activityType: activityForm.activityType,
      subject: activityForm.subject.trim(),
      description: activityForm.description.trim() || undefined,
      dueAt: activityForm.dueAt ? new Date(activityForm.dueAt).toISOString() : undefined,
      completedAt: activityForm.completedAt ? new Date(activityForm.completedAt).toISOString() : undefined,
      referenceType: activityForm.referenceType.trim() || undefined,
      referenceId: activityForm.referenceId.trim() || undefined,
    };
    try {
      if (editingActivityId) {
        await apiFetch(`/api/v1/crm/activities/${editingActivityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Activity updated.');
      } else {
        await apiFetch('/api/v1/crm/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Activity created.');
      }
      setActivityOpen(false);
      reloadActivities();
    } catch (err) {
      setActivityError(err instanceof ApiError ? err.message : 'Could not save activity.');
    } finally {
      setActivitySaving(false);
    }
  };

  const markComplete = async (activity: CrmActivity) => {
    try {
      await apiFetch(`/api/v1/crm/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      toast.toast('Activity completed.');
      reloadActivities();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not complete activity.', 'error');
    }
  };

  const confirmDeleteActivity = async () => {
    if (!deletingActivity) return;
    try {
      await apiFetch(`/api/v1/crm/activities/${deletingActivity.id}`, { method: 'DELETE' });
      toast.toast('Activity deleted.');
      setDeletingActivity(null);
      reloadActivities();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete activity.', 'error');
      setDeletingActivity(null);
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

  const contactColumns: Column<CrmContact>[] = [
    { key: 'fullName', header: 'Full name' },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => row.customer?.tradeName ?? '—',
    },
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
          <Button variant="ghost" size="sm" onClick={() => openContactEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingContact(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const activityColumns: Column<CrmActivity>[] = [
    {
      key: 'activityType',
      header: 'Type',
      render: (row) => <Badge tone={row.activityType === 'note' ? 'neutral' : 'info'}>{row.activityType}</Badge>,
    },
    { key: 'subject', header: 'Subject' },
    { key: 'description', header: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'dueAt',
      header: 'Due',
      render: (row) => (row.dueAt ? new Date(row.dueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'),
    },
    {
      key: 'completedAt',
      header: 'Completed',
      render: (row) =>
        row.completedAt ? new Date(row.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {!row.completedAt ? (
            <Button variant="ghost" size="sm" onClick={() => void markComplete(row)}>
              Complete
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => openActivityEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingActivity(row)}>
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
        subtitle="Leads, opportunities, contacts and activities"
        action={
          tab === 'leads' ? (
            <Button onClick={openLeadCreate}>New lead</Button>
          ) : tab === 'opportunities' ? (
            <Button onClick={openOppCreate}>New opportunity</Button>
          ) : tab === 'contacts' ? (
            <Button onClick={openContactCreate}>New contact</Button>
          ) : (
            <Button onClick={openActivityCreate}>New activity</Button>
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
        <button
          type="button"
          className={tab === 'contacts' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('contacts')}
        >
          Contacts
        </button>
        <button
          type="button"
          className={tab === 'activities' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('activities')}
        >
          Activities
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
      ) : null}
      {tab === 'opportunities' ? (
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
      ) : null}
      {tab === 'contacts' ? (
        <>
          {contactsError ? <ErrorBanner message={contactsError} /> : null}
          {!contacts && !contactsError ? <LoadingBlock /> : null}
          {contacts ? (
            <>
              {contacts.data.length === 0 ? (
                <EmptyState message="No contacts." />
              ) : (
                <DataTable columns={contactColumns} rows={contacts.data} rowKey={(row) => row.id} />
              )}
              <Pagination
                page={contacts.meta.page}
                limit={contacts.meta.limit}
                total={contacts.meta.total}
                onPage={() => {}}
              />
            </>
          ) : null}
        </>
      ) : null}
      {tab === 'activities' ? (
        <>
          {activitiesError ? <ErrorBanner message={activitiesError} /> : null}
          {!activities && !activitiesError ? <LoadingBlock /> : null}
          {activities ? (
            <>
              {activities.data.length === 0 ? (
                <EmptyState message="No activities." />
              ) : (
                <DataTable columns={activityColumns} rows={activities.data} rowKey={(row) => row.id} />
              )}
              <Pagination
                page={activities.meta.page}
                limit={activities.meta.limit}
                total={activities.meta.total}
                onPage={() => {}}
              />
            </>
          ) : null}
        </>
      ) : null}

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

      <Modal
        open={contactOpen}
        title={editingContactId ? 'Edit contact' : 'New contact'}
        onClose={closeContact}
        width="lg"
      >
        <form onSubmit={(event) => void submitContact(event)}>
          <div className="form-grid">
            <Field label="Full name" htmlFor="contact-name" required>
              <TextInput
                id="contact-name"
                value={contactForm.fullName}
                onChange={(event) => setContactForm((current) => ({ ...current, fullName: event.target.value }))}
              />
            </Field>
            <Field label="Customer" htmlFor="contact-customer">
              <Select
                id="contact-customer"
                value={contactForm.customerId}
                onChange={(event) => setContactForm((current) => ({ ...current, customerId: event.target.value }))}
              >
                <option value="">— None —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="contact-title">
              <TextInput
                id="contact-title"
                value={contactForm.title}
                onChange={(event) => setContactForm((current) => ({ ...current, title: event.target.value }))}
              />
            </Field>
            <Field label="Email" htmlFor="contact-email">
              <TextInput
                id="contact-email"
                type="email"
                value={contactForm.email}
                onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
              />
            </Field>
            <Field label="Phone" htmlFor="contact-phone">
              <TextInput
                id="contact-phone"
                value={contactForm.phone}
                onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </Field>
            <Field label="Mobile" htmlFor="contact-mobile">
              <TextInput
                id="contact-mobile"
                value={contactForm.mobile}
                onChange={(event) => setContactForm((current) => ({ ...current, mobile: event.target.value }))}
              />
            </Field>
            <Field label="Address" htmlFor="contact-address">
              <TextArea
                id="contact-address"
                rows={2}
                value={contactForm.address}
                onChange={(event) => setContactForm((current) => ({ ...current, address: event.target.value }))}
              />
            </Field>
            <Field label="Notes" htmlFor="contact-notes">
              <TextArea
                id="contact-notes"
                rows={2}
                value={contactForm.notes}
                onChange={(event) => setContactForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </Field>
            <Field label="Status">
              <Checkbox
                label="Active"
                checked={contactForm.active}
                onChange={(event) => setContactForm((current) => ({ ...current, active: event.target.checked }))}
              />
            </Field>
          </div>
          {contactError ? <div className="error-banner">{contactError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeContact} disabled={contactSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={contactSaving}>
              {contactSaving ? 'Saving…' : editingContactId ? 'Save changes' : 'Create contact'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activityOpen}
        title={editingActivityId ? 'Edit activity' : 'New activity'}
        onClose={closeActivity}
        width="lg"
      >
        <form onSubmit={(event) => void submitActivity(event)}>
          <div className="form-grid">
            <Field label="Type" htmlFor="activity-type" required>
              <Select
                id="activity-type"
                value={activityForm.activityType}
                onChange={(event) => setActivityForm((current) => ({ ...current, activityType: event.target.value }))}
              >
                {activityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" htmlFor="activity-subject" required>
              <TextInput
                id="activity-subject"
                value={activityForm.subject}
                onChange={(event) => setActivityForm((current) => ({ ...current, subject: event.target.value }))}
              />
            </Field>
            <Field label="Due at" htmlFor="activity-due">
              <TextInput
                id="activity-due"
                type="datetime-local"
                value={activityForm.dueAt}
                onChange={(event) => setActivityForm((current) => ({ ...current, dueAt: event.target.value }))}
              />
            </Field>
            <Field label="Completed at" htmlFor="activity-completed">
              <TextInput
                id="activity-completed"
                type="datetime-local"
                value={activityForm.completedAt}
                onChange={(event) => setActivityForm((current) => ({ ...current, completedAt: event.target.value }))}
              />
            </Field>
            <Field label="Reference type" htmlFor="activity-ref-type">
              <TextInput
                id="activity-ref-type"
                placeholder="e.g. lead, opportunity"
                value={activityForm.referenceType}
                onChange={(event) => setActivityForm((current) => ({ ...current, referenceType: event.target.value }))}
              />
            </Field>
            <Field label="Reference id" htmlFor="activity-ref-id">
              <TextInput
                id="activity-ref-id"
                value={activityForm.referenceId}
                onChange={(event) => setActivityForm((current) => ({ ...current, referenceId: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="activity-description">
            <TextArea
              id="activity-description"
              rows={3}
              value={activityForm.description}
              onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
          {activityError ? <div className="error-banner">{activityError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeActivity} disabled={activitySaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={activitySaving}>
              {activitySaving ? 'Saving…' : editingActivityId ? 'Save changes' : 'Create activity'}
            </button>
          </div>
        </form>
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

      <ConfirmDialog
        open={deletingContact !== null}
        title="Delete contact"
        message={`Delete contact "${deletingContact?.fullName}"?`}
        confirmLabel="Delete"
        onCancel={() => setDeletingContact(null)}
        onConfirm={() => void confirmDeleteContact()}
      />

      <ConfirmDialog
        open={deletingActivity !== null}
        title="Delete activity"
        message={`Delete activity "${deletingActivity?.subject}"?`}
        confirmLabel="Delete"
        onCancel={() => setDeletingActivity(null)}
        onConfirm={() => void confirmDeleteActivity()}
      />
    </>
  );
}
