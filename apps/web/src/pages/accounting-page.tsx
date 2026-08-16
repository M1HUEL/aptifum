import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
  Input,
  Select,
} from '../components/ui';
import { CalendarRange, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DetailTable, SectionHeading } from '../components/ui/detail-table';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { useNewRecordShortcut } from '../hooks/use-new-record-shortcut';

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

function journalColumns(t: TFunction, openEntry: (entry: JournalEntry) => void): Column<JournalEntry>[] {
  return [
    { key: 'number', header: t('tables.number') },
    {
      key: 'entryDate',
      header: t('tables.date'),
      render: (row) => formatDate(row.entryDate),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={entryStatusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'description',
      header: t('fields.description'),
      render: (row) => row.description ?? '—',
    },
    {
      key: 'debitTotal',
      header: t('fields.debit'),
      render: (row) => formatMoney(row.debitTotal),
    },
    {
      key: 'creditTotal',
      header: t('fields.credit'),
      render: (row) => formatMoney(row.creditTotal),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => openEntry(row)}>
            {t('common.view')}
          </Button>
        </div>
      ),
    },
  ];
}

function periodColumns(t: TFunction, onClose: (period: AccountingPeriod) => void): Column<AccountingPeriod>[] {
  return [
    { key: 'period', header: t('tables.period') },
    { key: 'label', header: t('tables.label') },
    {
      key: 'startDate',
      header: t('tables.from'),
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      header: t('tables.to'),
      render: (row) => formatDate(row.endDate),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.status === 'open' ? 'success' : 'neutral'}>{row.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) =>
        row.status === 'open' ? (
          <div className="flex justify-end gap-1.5">
            <Button variant="danger" size="sm" onClick={() => onClose(row)}>
              {t('accounting.closePeriod')}
            </Button>
          </div>
        ) : null,
    },
  ];
}

function JournalEntriesTab({
  onOpenEntry,
  onCreate,
}: {
  onOpenEntry: (entry: JournalEntry) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
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
            <EmptyState
              message={t('accounting.noJournalEntries')}
              icon={<FileSpreadsheet className="size-6" />}
              action={<Button onClick={onCreate}>{t('accounting.newJournalEntry')}</Button>}
            />
          ) : (
            <DataTable
              columns={journalColumns(t, onOpenEntry)}
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
  const { t } = useTranslation();
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

  useNewRecordShortcut(openCreate);

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
      setFormError(t('accounting.addAtLeastOneLine'));
      return;
    }
    createMutation.mutate(body, {
      onSuccess: () => {
        toast.toast(t('accounting.journalEntryPosted'));
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
        toast.toast(t('accounting.periodClosed'));
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
        title={t('accounting.title')}
        subtitle={t('accounting.subtitle')}
        action={<Button onClick={openCreate}>{t('accounting.newJournalEntry')}</Button>}
      />
      <div className="mb-4 flex gap-1">
        <button type="button" className={tab === 'entries' ? 'tab tab-active' : 'tab'} onClick={() => setTab('entries')}>
          {t('accounting.journalEntries')}
        </button>
        <button type="button" className={tab === 'periods' ? 'tab tab-active' : 'tab'} onClick={() => setTab('periods')}>
          {t('accounting.periods')}
        </button>
      </div>
      {tab === 'entries' ? (
        <JournalEntriesTab onOpenEntry={setViewing} onCreate={openCreate} />
      ) : (
        <>
          {periodsError ? <ErrorBanner message={periodsError} /> : null}
          {!periods && !periodsError ? <LoadingBlock /> : null}
          {periods ? (
            <>
              {periods.data.length === 0 ? (
                <EmptyState message={t('accounting.noAccountingPeriods')} icon={<CalendarRange className="size-6" />} />
              ) : (
                <DataTable
                  columns={periodColumns(t, setClosingPeriod)}
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
          <DialogHeader title={t('accounting.newJournalEntry')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="je-date">{t('fields.entryDate')} *</label>
                <Input className="w-full" id="je-date" type="date" {...register('entryDate')} />
                {errors.entryDate ? <div className="text-[12px] font-normal text-danger">{errors.entryDate.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="je-description">{t('fields.description')}</label>
                <Input className="w-full" id="je-description" {...register('description')} />
                {errors.description ? <div className="text-[12px] font-normal text-danger">{errors.description.message}</div> : null}
              </div>
            </div>
            <div className="mb-3 rounded-ui border border-border p-3">
              {lines.map((_, index) => (
                <div className="grid grid-cols-[3fr_1fr_1.5fr_1fr_auto] items-start gap-2.5" key={index}>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`je-line-account-${index}`}>{t('tables.account')}</label>
                    <Select className="w-full" id={`je-line-account-${index}`} {...register(`lines.${index}.accountCode`)}>
                      <option value="">{t('accounting.selectAccount')}</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.code}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`je-line-debit-${index}`}>{t('fields.debit')}</label>
                    <Input className="w-full"
                      id={`je-line-debit-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      {...register(`lines.${index}.debit`)}
                    />
                    {errors.lines?.[index]?.debit ? (
                      <div className="text-[12px] font-normal text-danger">{errors.lines[index]?.debit?.message}</div>
                    ) : null}
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`je-line-credit-${index}`}>{t('fields.credit')}</label>
                    <Input className="w-full"
                      id={`je-line-credit-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      {...register(`lines.${index}.credit`)}
                    />
                    {errors.lines?.[index]?.credit ? (
                      <div className="text-[12px] font-normal text-danger">{errors.lines[index]?.credit?.message}</div>
                    ) : null}
                  </div>
                  <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <label htmlFor={`je-line-memo-${index}`}>{t('fields.memo')}</label>
                    <Input className="w-full" id={`je-line-memo-${index}`} {...register(`lines.${index}.description`)} />
                    {errors.lines?.[index]?.description ? (
                      <div className="text-[12px] font-normal text-danger">{errors.lines[index]?.description?.message}</div>
                    ) : null}
                  </div>
                  <div className="pt-6">
                    {lines.length > 2 ? (
                      <Button variant="ghost" size="sm" type="button" onClick={() => removeLine(index)}>
                        {t('common.remove')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addLine}>
              {t('common.addLine')}
            </Button>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('accounting.posting') : t('accounting.postEntry')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('accounting.entry', { number: viewing?.number ?? '' })} />
          {viewing ? (
            <>
              <DetailTable
                rows={[
                  {
                    label: t('common.status'),
                    value: (
                      <Badge tone={entryStatusTone(viewing.status)}>{t(`accounting.${viewing.status}`)}</Badge>
                    ),
                  },
                  {
                    label: t('fields.description'),
                    value: viewing.description ?? t('accounting.noDescription'),
                  },
                  { label: t('fields.entryDate'), value: formatDate(viewing.entryDate) },
                  { label: t('fields.debit'), value: formatMoney(viewing.debitTotal) },
                  { label: t('fields.credit'), value: formatMoney(viewing.creditTotal) },
                ]}
              />
              <SectionHeading>{t('accounting.lines')}</SectionHeading>
              <div className="mb-3.5 max-h-[480px] overflow-auto rounded-ui border border-border bg-surface shadow-(--shadow)">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="h-10 bg-bg px-[14px] text-left align-middle text-xs font-medium uppercase tracking-wide text-muted">
                        {t('tables.account')}
                      </th>
                      <th className="h-10 bg-bg px-[14px] text-left align-middle text-xs font-medium uppercase tracking-wide text-muted">
                        {t('fields.description')}
                      </th>
                      <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                        {t('fields.debit')}
                      </th>
                      <th className="h-10 bg-bg px-[14px] text-right align-middle text-xs font-medium uppercase tracking-wide text-muted tabular-nums">
                        {t('fields.credit')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.lines.map((line) => (
                      <tr key={line.id} className="border-t border-border">
                        <td className="px-[14px] py-2.5 align-middle">
                          {line.account ? `${line.account.code} · ${line.account.name}` : '—'}
                        </td>
                        <td className="px-[14px] py-2.5 align-middle">{line.description ?? '—'}</td>
                        <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">
                          {line.debit ? formatMoney(line.debit) : '—'}
                        </td>
                        <td className="px-[14px] py-2.5 text-right align-middle tabular-nums">
                          {line.credit ? formatMoney(line.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <DialogFooter cancelLabel={t('common.close')} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={closingPeriod !== null}
        onOpenChange={(open) => !closeBusy && !open && setClosingPeriod(null)}
      >
        <DialogContent>
          <DialogHeader
            title={t('accounting.closePeriodTitle')}
            description={t('accounting.closePeriodMessage', { label: closingPeriod?.label ?? '' })}
          />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={closeBusy} onClick={() => void confirmClose()}>
              {closeBusy ? t('common.working') : t('accounting.closePeriod')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
