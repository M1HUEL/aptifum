import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../api/client';
import type { components } from '../api/schema';
import type { AccountingPeriod, ChartAccount, JournalEntry, Paginated } from '../api/types';
import { journalEntryFormSchema, type JournalEntryFormValues } from '../api/schemas';
import { useApiInvalidation, useApiMutation, useApiMutationVoid } from '../api/hooks';
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
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

type CreateJournalEntryDto = components['schemas']['CreateJournalEntryDto'];
type CreateJournalEntryLineDto = components['schemas']['CreateJournalEntryLineDto'];

function entryStatusTone(status: JournalEntry['status']): BadgeTone {
  if (status === 'posted') return 'success';
  if (status === 'reversed') return 'danger';
  return 'neutral';
}

const emptyLine: JournalEntryFormValues['lines'][number] = {
  accountCode: '',
  debit: '',
  credit: '',
  description: '',
};

function emptyForm(): JournalEntryFormValues {
  return {
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
    lines: [emptyLine, emptyLine],
  };
}

function toDto(form: JournalEntryFormValues): CreateJournalEntryDto {
  const lines = form.lines
    .filter((line) => line.accountCode)
    .map((line) => {
      const dto: CreateJournalEntryLineDto = {
        accountCode: line.accountCode,
        debit: line.debit === '' ? undefined : Number(line.debit),
        credit: line.credit === '' ? undefined : Number(line.credit),
        description: line.description.trim() || undefined,
      };
      return dto;
    });
  return {
    entryDate: form.entryDate,
    description: form.description.trim() || undefined,
    lines,
  };
}

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
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<JournalEntry | null>(null);
  const [closingPeriod, setClosingPeriod] = useState<AccountingPeriod | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntryFormSchema),
    defaultValues: emptyForm(),
  });

  const lines = watch('lines');

  const { data: periods, error: periodsError } = usePagedQuery<AccountingPeriod>({
    path: '/api/v1/accounting/periods',
    page: 1,
  });

  const createMutation = useApiMutation<CreateJournalEntryDto>(
    '/api/v1/accounting/journal-entries',
    'POST',
  );
  const closeMutation = useApiMutationVoid(
    `/api/v1/accounting/periods/${closingPeriod?.id ?? ''}/close`,
    'POST',
  );

  const saving = createMutation.isPending;
  const closeBusy = closeMutation.isPending;

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
    reset(emptyForm());
    setFormError(null);
    setCreateOpen(true);
  };

  const addLine = () => {
    setValue('lines', [...lines, emptyLine]);
  };

  const removeLine = (index: number) => {
    setValue('lines', lines.filter((_, i) => i !== index));
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const body = toDto(values);
    if (body.lines.length === 0) {
      setFormError('Add at least one line.');
      return;
    }
    createMutation.mutate(body, {
      onSuccess: () => {
        toast.toast('Journal entry posted.');
        setCreateOpen(false);
        void invalidate(['paged', '/api/v1/accounting/journal-entries']);
      },
      onError: (err) => setFormError(err.message),
    });
  });

  const confirmClose = () => {
    if (!closingPeriod) return;
    closeMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast('Period closed.');
        setClosingPeriod(null);
        void invalidate(['paged', '/api/v1/accounting/periods']);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setClosingPeriod(null);
      },
    });
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
        <JournalEntriesTab onOpenEntry={setViewing} />
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

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title="New journal entry" />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="je-date">Entry date *</label>
                <input id="je-date" type="date" {...register('entryDate')} />
                {errors.entryDate ? <div className="field-error">{errors.entryDate.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="je-description">Description</label>
                <input id="je-description" {...register('description')} />
                {errors.description ? <div className="field-error">{errors.description.message}</div> : null}
              </div>
            </div>
            <div className="invoice-items">
              {lines.map((_, index) => (
                <div className="invoice-item" key={index}>
                  <div className="field">
                    <label htmlFor={`je-line-account-${index}`}>Account</label>
                    <select id={`je-line-account-${index}`} {...register(`lines.${index}.accountCode`)}>
                      <option value="">— Select account —</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.code}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`je-line-debit-${index}`}>Debit</label>
                    <input
                      id={`je-line-debit-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      {...register(`lines.${index}.debit`)}
                    />
                    {errors.lines?.[index]?.debit ? (
                      <div className="field-error">{errors.lines[index]?.debit?.message}</div>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor={`je-line-credit-${index}`}>Credit</label>
                    <input
                      id={`je-line-credit-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      {...register(`lines.${index}.credit`)}
                    />
                    {errors.lines?.[index]?.credit ? (
                      <div className="field-error">{errors.lines[index]?.credit?.message}</div>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor={`je-line-memo-${index}`}>Memo</label>
                    <input id={`je-line-memo-${index}`} {...register(`lines.${index}.description`)} />
                    {errors.lines?.[index]?.description ? (
                      <div className="field-error">{errors.lines[index]?.description?.message}</div>
                    ) : null}
                  </div>
                  <div className="invoice-item-remove">
                    {lines.length > 2 ? (
                      <Button variant="ghost" size="sm" type="button" onClick={() => removeLine(index)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addLine}>
              + Add line
            </Button>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Posting…' : 'Post entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={`Entry ${viewing?.number ?? ''}`} />
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
            </>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closingPeriod !== null}
        onOpenChange={(open) => !closeBusy && !open && setClosingPeriod(null)}
      >
        <DialogContent>
          <DialogHeader
            title="Close accounting period"
            description={`Close period "${closingPeriod?.label}"? No further entries will be allowed in this period.`}
          />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={closeBusy} onClick={() => void confirmClose()}>
              {closeBusy ? 'Working…' : 'Close period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
