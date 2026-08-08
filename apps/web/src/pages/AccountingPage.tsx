import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { AccountingPeriod, ChartAccount, JournalEntry, Paginated } from '../api/types';
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
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/usePagedQuery';

function entryStatusTone(status: JournalEntry['status']): BadgeTone {
  if (status === 'posted') return 'success';
  if (status === 'reversed') return 'danger';
  return 'neutral';
}

interface JournalLineForm {
  accountCode: string;
  debit: string;
  credit: string;
  description: string;
}

interface JournalForm {
  entryDate: string;
  description: string;
  lines: JournalLineForm[];
}

const emptyLine: JournalLineForm = { accountCode: '', debit: '', credit: '', description: '' };

function journalColumns(openEntry: (entry: JournalEntry) => void): Column<JournalEntry>[] {
  return [
    { key: 'number', header: 'Number' },
    {
      key: 'entryDate',
      header: 'Date',
      render: (row) => formatDate(row.entryDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={entryStatusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => row.description ?? '—',
    },
    {
      key: 'debitTotal',
      header: 'Debit',
      render: (row) => formatMoney(row.debitTotal),
    },
    {
      key: 'creditTotal',
      header: 'Credit',
      render: (row) => formatMoney(row.creditTotal),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openEntry(row)}>
            View
          </Button>
        </div>
      ),
    },
  ];
}

function periodColumns(onClose: (period: AccountingPeriod) => void): Column<AccountingPeriod>[] {
  return [
    { key: 'period', header: 'Period' },
    { key: 'label', header: 'Label' },
    {
      key: 'startDate',
      header: 'From',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      header: 'To',
      render: (row) => formatDate(row.endDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'open' ? 'success' : 'neutral'}>{row.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) =>
        row.status === 'open' ? (
          <div className="table-actions">
            <Button variant="danger" size="sm" onClick={() => onClose(row)}>
              Close
            </Button>
          </div>
        ) : null,
    },
  ];
}

function JournalEntriesTab({ onOpenEntry }: { onOpenEntry: (entry: JournalEntry) => void }) {
  const [page, setPage] = useState(1);
  const { data, error } = usePagedQuery<JournalEntry>({
    path: '/api/v1/accounting/journal-entries',
    page,
  });

  return (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      {!data && !error ? <LoadingBlock /> : null}
      {data ? (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No journal entries." />
          ) : (
            <DataTable
              columns={journalColumns(onOpenEntry)}
              rows={data.data}
              rowKey={(row) => row.id}
            />
          )}
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}

export function AccountingPage() {
  const [tab, setTab] = useState<'entries' | 'periods'>('entries');
  const [refreshKey, setRefreshKey] = useState(0);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<JournalForm>({
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
    lines: [emptyLine, emptyLine],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<JournalEntry | null>(null);
  const [closingPeriod, setClosingPeriod] = useState<AccountingPeriod | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const toast = useToast();

  const { data: periods, error: periodsError, reload: reloadPeriods } = usePagedQuery<AccountingPeriod>({
    path: '/api/v1/accounting/periods',
    page: 1,
  });

  useEffect(() => {
    let cancelled = false;
    void apiFetch<Paginated<ChartAccount>>('/api/v1/accounting/accounts?page=1&limit=200')
      .then((result) => {
        if (!cancelled) setAccounts(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setForm({
      entryDate: new Date().toISOString().slice(0, 10),
      description: '',
      lines: [emptyLine, emptyLine],
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (!saving) setCreateOpen(false);
  };

  const setFormField = (key: keyof JournalForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setLineField = (index: number, key: keyof JournalLineForm, value: string) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    }));
  };

  const addLine = () => {
    setForm((current) => ({ ...current, lines: [...current.lines, emptyLine] }));
  };

  const removeLine = (index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, i) => i !== index),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const lines = form.lines
      .filter((line) => line.accountCode)
      .map((line) => ({
        accountCode: line.accountCode,
        debit: line.debit === '' ? undefined : Number(line.debit),
        credit: line.credit === '' ? undefined : Number(line.credit),
        description: line.description.trim() || undefined,
      }));
    if (lines.length === 0) {
      setFormError('Add at least one line.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      entryDate: form.entryDate,
      description: form.description.trim() || undefined,
      lines,
    };
    try {
      await apiFetch('/api/v1/accounting/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Journal entry posted.');
      setCreateOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not post journal entry.');
    } finally {
      setSaving(false);
    }
  };

  const confirmClose = async () => {
    if (!closingPeriod) return;
    setCloseBusy(true);
    try {
      await apiFetch(`/api/v1/accounting/periods/${closingPeriod.id}/close`, { method: 'POST' });
      toast.toast('Period closed.');
      setClosingPeriod(null);
      reloadPeriods();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not close period.', 'error');
      setClosingPeriod(null);
    } finally {
      setCloseBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="Journal entries and periods"
        action={<Button onClick={openCreate}>New journal entry</Button>}
      />
      <div className="tabs">
        <button type="button" className={tab === 'entries' ? 'tab tab-active' : 'tab'} onClick={() => setTab('entries')}>
          Journal entries
        </button>
        <button type="button" className={tab === 'periods' ? 'tab tab-active' : 'tab'} onClick={() => setTab('periods')}>
          Periods
        </button>
      </div>
      {tab === 'entries' ? (
        <JournalEntriesTab key={`entries-${refreshKey}`} onOpenEntry={setViewing} />
      ) : (
        <>
          {periodsError ? <ErrorBanner message={periodsError} /> : null}
          {!periods && !periodsError ? <LoadingBlock /> : null}
          {periods ? (
            <>
              {periods.data.length === 0 ? (
                <EmptyState message="No accounting periods." />
              ) : (
                <DataTable
                  columns={periodColumns(setClosingPeriod)}
                  rows={periods.data}
                  rowKey={(row) => row.id}
                />
              )}
              <Pagination
                page={periods.meta.page}
                limit={periods.meta.limit}
                total={periods.meta.total}
                onPage={() => {}}
              />
            </>
          ) : null}
        </>
      )}

      <Modal open={createOpen} title="New journal entry" onClose={closeCreate} width="lg">
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Entry date" htmlFor="je-date" required>
              <TextInput
                id="je-date"
                type="date"
                value={form.entryDate}
                onChange={(event) => setFormField('entryDate', event.target.value)}
              />
            </Field>
            <Field label="Description" htmlFor="je-description">
              <TextInput
                id="je-description"
                value={form.description}
                onChange={(event) => setFormField('description', event.target.value)}
              />
            </Field>
          </div>
          <div className="invoice-items">
            {form.lines.map((line, index) => (
              <div className="invoice-item" key={index}>
                <Field label="Account" htmlFor={`je-line-account-${index}`}>
                  <Select
                    id={`je-line-account-${index}`}
                    value={line.accountCode}
                    onChange={(event) => setLineField(index, 'accountCode', event.target.value)}
                  >
                    <option value="">— Select account —</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.code}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Debit" htmlFor={`je-line-debit-${index}`}>
                  <TextInput
                    id={`je-line-debit-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.debit}
                    onChange={(event) => setLineField(index, 'debit', event.target.value)}
                  />
                </Field>
                <Field label="Credit" htmlFor={`je-line-credit-${index}`}>
                  <TextInput
                    id={`je-line-credit-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.credit}
                    onChange={(event) => setLineField(index, 'credit', event.target.value)}
                  />
                </Field>
                <Field label="Memo" htmlFor={`je-line-memo-${index}`}>
                  <TextInput
                    id={`je-line-memo-${index}`}
                    value={line.description}
                    onChange={(event) => setLineField(index, 'description', event.target.value)}
                  />
                </Field>
                <div className="invoice-item-remove">
                  {form.lines.length > 2 ? (
                    <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={addLine}>
            + Add line
          </Button>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeCreate} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Posting…' : 'Post entry'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={viewing !== null} title={`Entry ${viewing?.number ?? ''}`} onClose={() => setViewing(null)} width="lg">
        {viewing ? (
          <>
            <p className="modal-message">
              {viewing.description ?? 'No description'} · {formatDate(viewing.entryDate)} ·{' '}
              <Badge tone={entryStatusTone(viewing.status)}>{viewing.status}</Badge>
            </p>
            <DataTable
              columns={[
                {
                  key: 'account',
                  header: 'Account',
                  render: (row) =>
                    row.account ? `${row.account.code} · ${row.account.name}` : '—',
                },
                { key: 'description', header: 'Description', render: (row) => row.description ?? '—' },
                { key: 'debit', header: 'Debit', render: (row) => (row.debit ? formatMoney(row.debit) : '—') },
                { key: 'credit', header: 'Credit', render: (row) => (row.credit ? formatMoney(row.credit) : '—') },
              ]}
              rows={viewing.lines}
              rowKey={(row) => row.id}
            />
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={closingPeriod !== null}
        title="Close accounting period"
        message={`Close period "${closingPeriod?.label}"? No further entries will be allowed in this period.`}
        confirmLabel="Close period"
        busy={closeBusy}
        onCancel={() => setClosingPeriod(null)}
        onConfirm={() => void confirmClose()}
      />
    </>
  );
}
