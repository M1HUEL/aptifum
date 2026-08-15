import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AccountNormalBalance, AccountType, ChartAccount } from '../api/types';
import { accountFormSchema, type AccountFormValues } from '../api/schemas';
import { useApiInvalidation, useApiMutation } from '../api/hooks';
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
} from '../components/ui';
import { ListOrdered } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { exportRowsToCsv } from '../lib/csv';

const accountTypes: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const normalBalances: AccountNormalBalance[] = ['debit', 'credit'];

function typeTone(type: AccountType) {
  if (type === 'asset' || type === 'expense') return 'info';
  if (type === 'liability' || type === 'equity' || type === 'revenue') return 'warning';
  return 'neutral';
}

interface CreateAccountDto {
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  parentId?: string;
  active: boolean;
  description?: string;
}

interface UpdateAccountDto {
  name: string;
  type: string;
  normalBalance: string;
  parentId?: string;
  active: boolean;
  description?: string;
}

const emptyForm: AccountFormValues = {
  code: '',
  name: '',
  type: 'asset',
  normalBalance: 'debit',
  parentId: '',
  active: true,
  description: '',
};

export function ChartAccountsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ChartAccount | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: emptyForm,
  });

  const active = watch('active');

  const { data, error, loading } = usePagedQuery<ChartAccount>({
    path: '/api/v1/accounting/accounts',
    page,
    limit,
  });

  const accounts = data?.data ?? [];

  const createMutation = useApiMutation<CreateAccountDto>('/api/v1/accounting/accounts', 'POST');
  const updateMutation = useApiMutation<UpdateAccountDto>(
    `/api/v1/accounting/accounts/${editingId ?? ''}`,
    'PATCH',
  );
  const deleteMutation = useApiMutation<Record<string, never>, unknown>(
    `/api/v1/accounting/accounts/${deleting?.id ?? ''}`,
    'DELETE',
  );

  const saving = createMutation.isPending || updateMutation.isPending;
  const deleteBusy = deleteMutation.isPending;

  const openCreate = () => {
    setEditingId(null);
    reset(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (account: ChartAccount) => {
    setEditingId(account.id);
    reset({
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      parentId: account.parentId ?? '',
      active: account.active,
      description: account.description ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? t('accounts.accountUpdated') : t('accounts.accountCreated'));
      setModalOpen(false);
      void invalidate(['paged', '/api/v1/accounting/accounts']);
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(
        {
          name: values.name,
          type: values.type,
          normalBalance: values.normalBalance,
          parentId: values.parentId || undefined,
          active: values.active,
          description: values.description || undefined,
        },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(
        {
          code: values.code,
          name: values.name,
          type: values.type,
          normalBalance: values.normalBalance,
          parentId: values.parentId || undefined,
          active: values.active,
          description: values.description || undefined,
        },
        { onSuccess, onError },
      );
    }
  });

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      {},
      {
        onSuccess: () => {
          toast.toast(t('accounts.accountDeleted'));
          setDeleting(null);
          void invalidate(['paged', '/api/v1/accounting/accounts']);
        },
        onError: (err) => {
          toast.toast(err.message, 'error');
          setDeleting(null);
        },
      },
    );
  };

  const columns: Column<ChartAccount>[] = [
    { key: 'code', header: t('fields.code') },
    { key: 'name', header: t('fields.name') },
    {
      key: 'type',
      header: t('tables.type'),
      render: (row) => <Badge tone={typeTone(row.type)}>{row.type}</Badge>,
    },
    { key: 'normalBalance', header: t('tables.normalBalance'), render: (row) => row.normalBalance },
    {
      key: 'parent',
      header: t('tables.parent'),
      render: (row) => (row.parent ? `${row.parent.code} · ${row.parent.name}` : '—'),
    },
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
    setPage(1);
  };

  const handleExport = () => {
    if (!data || accounts.length === 0) return;
    exportRowsToCsv({ filename: 'chart-accounts', columns, rows: accounts });
  };

  return (
    <>
      <PageHeader
        title={t('accounts.title')}
        subtitle={t('accounts.subtitle')}
        action={
          <div className="flex justify-end gap-2">
            <Button type="button" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </Button>
            <Button onClick={openCreate}>{t('accounts.newAccount')}</Button>
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {loading && accounts.length === 0 ? <TableSkeleton columns={columns.length} /> : null}
      {!loading && accounts.length === 0 && !error ? <EmptyState message={t('accounts.noAccounts')} icon={<ListOrdered className="size-6" />} /> : null}
      {accounts.length > 0 ? (
        <>
          <DataTable columns={columns} rows={accounts} rowKey={(row) => row.id} />
          <Pagination page={data?.meta.page ?? page} limit={data?.meta.limit ?? limit} total={data?.meta.total ?? 0} onPage={setPage} onLimit={handleLimitChange} />
        </>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent>
          <DialogHeader title={editingId ? t('accounts.editAccount') : t('accounts.newAccountTitle')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="acc-code">{t('fields.code')} *</label>
                <Input className="w-full" id="acc-code" disabled={editingId !== null} {...register('code')} />
                {errors.code ? <div className="text-[12px] font-normal text-danger">{errors.code.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="acc-name">{t('fields.name')} *</label>
                <Input className="w-full" id="acc-name" {...register('name')} />
                {errors.name ? <div className="text-[12px] font-normal text-danger">{errors.name.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="acc-type">{t('tables.type')} *</label>
                <Select className="w-full" id="acc-type" {...register('type')}>
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="acc-balance">{t('tables.normalBalance')} *</label>
                <Select className="w-full" id="acc-balance" {...register('normalBalance')}>
                  {normalBalances.map((balance) => (
                    <option key={balance} value={balance}>
                      {balance}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="acc-parent">{t('tables.parent')}</label>
                <Select className="w-full" id="acc-parent" {...register('parentId')}>
                  <option value="">{t('accounts.none')}</option>
                  {accounts
                    .filter((account) => account.id !== editingId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="acc-description">{t('fields.description')}</label>
                <Textarea className="w-full" id="acc-description" rows={2} {...register('description')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label>{t('common.status')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="acc-active"
                    checked={active}
                    onCheckedChange={(checked) => setValue('active', checked === true)}
                  />
                  <label htmlFor="acc-active" className="text-sm text-gray-700">
                    {t('common.active')}
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('accounts.createAccount')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !deleteBusy && !open && setDeleting(null)}
        title={t('accounts.deleteAccount')}
        description={t('accounts.deleteAccountMessage', { account: `${deleting?.code} · ${deleting?.name}` })}
        confirmLabel={t('common.delete')}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
