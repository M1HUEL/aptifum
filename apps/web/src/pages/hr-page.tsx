import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, ApiError } from '../api/client';
import type { components } from '../api/schema';
import type {
  Department,
  Employee,
  EmployeeStatus,
  Paginated,
  Payroll,
  PayrollLine,
  PayrollStatus,
} from '../api/types';
import {
  employeeFormSchema,
  payrollFormSchema,
  type EmployeeFormValues,
  type PayrollFormValues,
} from '../api/schemas';
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
  Input,
  Select,
} from '../components/ui';
import { Users, Wallet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';
import { useNewRecordShortcut } from '../hooks/use-new-record-shortcut';

type CreateEmployeeDto = components['schemas']['CreateEmployeeDto'];
type GeneratePayrollDto = components['schemas']['GeneratePayrollDto'];
type PayrollLineInputDto = components['schemas']['PayrollLineInputDto'];

function employeeStatusTone(status: EmployeeStatus): BadgeTone {
  return status === 'active' ? 'success' : 'neutral';
}

function payrollStatusTone(status: PayrollStatus): BadgeTone {
  if (status === 'posted') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

const emptyEmployee: EmployeeFormValues = {
  employeeNo: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  departmentId: '',
  position: '',
  hireDate: new Date().toISOString().slice(0, 10),
  salary: '',
  salaryFrequency: 'monthly',
  status: 'active',
};

function toDto(form: EmployeeFormValues): CreateEmployeeDto {
  return {
    employeeNo: form.employeeNo.trim() || undefined,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    departmentId: form.departmentId || undefined,
    position: form.position.trim() || undefined,
    hireDate: form.hireDate,
    salary: form.salary === '' ? undefined : Number(form.salary),
    salaryFrequency: form.salaryFrequency.trim() || undefined,
    status: form.status,
  };
}

function fromEmployee(employee: Employee): EmployeeFormValues {
  return {
    employeeNo: employee.employeeNo,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    departmentId: employee.departmentId ?? '',
    position: employee.position ?? '',
    hireDate: employee.hireDate,
    salary: employee.salary ? String(employee.salary) : '',
    salaryFrequency: employee.salaryFrequency,
    status: employee.status,
  };
}

export function HrPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'employees' | 'payrolls'>('employees');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [viewingPayroll, setViewingPayroll] = useState<Payroll | null>(null);
  const [payrollAction, setPayrollAction] = useState<{
    id: string;
    action: 'post' | 'cancel';
    messageKey: 'hr.payrollPosted' | 'hr.payrollCancelled';
  } | null>(null);
  const toast = useToast();
  const { invalidate } = useApiInvalidation();

  const { data, error } = usePagedQuery<Employee>({
    path: '/api/v1/hr/employees',
    page: 1,
  });

  const { data: payrolls, error: payrollsError } = usePagedQuery<Payroll>({
    path: '/api/v1/hr/payrolls',
    page: 1,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: emptyEmployee,
  });

  const status = watch('status');

  const payrollForm = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: { period: '', lines: [] },
  });

  const {
    register: payrollRegister,
    handleSubmit: payrollHandleSubmit,
    reset: resetPayroll,
    formState: { errors: payrollErrors },
  } = payrollForm;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Paginated<Department>>('/api/v1/hr/departments?page=1&limit=100'),
      apiFetch<Paginated<Employee>>('/api/v1/hr/employees?page=1&limit=100'),
    ])
      .then(([departmentsResult, employeesResult]) => {
        if (cancelled) return;
        setDepartments(departmentsResult.data);
        setEmployees(employeesResult.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const createMutation = useApiMutation<CreateEmployeeDto>('/api/v1/hr/employees', 'POST');
  const updateMutation = useApiMutation<CreateEmployeeDto>(
    `/api/v1/hr/employees/${editingId ?? ''}`,
    'PATCH',
  );
  const generateMutation = useApiMutation<GeneratePayrollDto>('/api/v1/hr/payrolls/generate', 'POST');
  const payrollActionMutation = useApiMutationVoid(
    payrollAction
      ? `/api/v1/hr/payrolls/${payrollAction.id}/${payrollAction.action}`
      : '/api/v1/hr/payrolls',
    'POST',
  );

  const saving = createMutation.isPending || updateMutation.isPending;
  const payrollBusy = generateMutation.isPending;

  useEffect(() => {
    if (!payrollAction) return;
    payrollActionMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t(payrollAction.messageKey));
        void invalidate(['paged', '/api/v1/hr/payrolls']);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
      },
    });
    setPayrollAction(null);
  }, [payrollAction]);

  const openCreate = () => {
    setEditingId(null);
    reset(emptyEmployee);
    setFormError(null);
    setCreateOpen(true);
  };

  useNewRecordShortcut(openCreate);

  const openEdit = (employee: Employee) => {
    setEditingId(employee.id);
    reset(fromEmployee(employee));
    setFormError(null);
    setCreateOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? t('hr.employeeUpdated') : t('hr.employeeCreated'));
      setCreateOpen(false);
      void invalidate(['paged', '/api/v1/hr/employees']);
    };
    const onError = (err: { message: string }) => setFormError(err.message);
    if (editingId) {
      updateMutation.mutate(toDto(values), { onSuccess, onError });
    } else {
      createMutation.mutate(toDto(values), { onSuccess, onError });
    }
  });

  const openPayroll = () => {
    resetPayroll({
      period: new Date().toISOString().slice(0, 7),
      lines: employees
        .filter((employee) => employee.status === 'active')
        .map((employee) => ({ employeeId: employee.id, bonus: '', overtime: '', deductions: '' })),
    });
    setPayrollError(null);
    setPayrollOpen(true);
  };

  const submitPayroll = payrollHandleSubmit((values) => {
    setPayrollError(null);
    const lines = values.lines.map((line) => {
      const dto: PayrollLineInputDto = {
        employeeId: line.employeeId,
        bonus: line.bonus === '' ? undefined : Number(line.bonus),
        overtime: line.overtime === '' ? undefined : Number(line.overtime),
        deductions: line.deductions === '' ? undefined : Number(line.deductions),
      };
      return dto;
    });
    if (lines.length === 0) {
      setPayrollError(t('hr.noActiveEmployeesToPay'));
      return;
    }
    generateMutation.mutate(
      { period: values.period, lines },
      {
        onSuccess: () => {
          toast.toast(t('hr.draftPayrollGenerated'));
          setPayrollOpen(false);
          void invalidate(['paged', '/api/v1/hr/payrolls']);
        },
        onError: (err) => setPayrollError(err.message),
      },
    );
  });

  const runPayrollAction = (id: string, action: 'post' | 'cancel', messageKey: 'hr.payrollPosted' | 'hr.payrollCancelled') => {
    setPayrollAction({ id, action, messageKey });
  };

  const openPayrollView = async (payroll: Payroll) => {
    try {
      const detail = await apiFetch<Payroll>(`/api/v1/hr/payrolls/${payroll.id}`);
      setViewingPayroll(detail);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : t('errors.couldNotLoadPayroll'), 'error');
    }
  };

  const activeEmployees = employees.filter((employee) => employee.status === 'active');

  const employeeColumns: Column<Employee>[] = [
    { key: 'employeeNo', header: t('tables.shortNo') },
    {
      key: 'name',
      header: t('fields.name'),
      render: (row) => `${row.firstName} ${row.lastName}`,
    },
    { key: 'position', header: t('fields.position'), render: (row) => row.position ?? '—' },
    {
      key: 'department',
      header: t('fields.department'),
      render: (row) => row.department?.name ?? '—',
    },
    {
      key: 'hireDate',
      header: t('fields.hireDate'),
      render: (row) => formatDate(row.hireDate),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={employeeStatusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {t('common.edit')}
          </Button>
        </div>
      ),
    },
  ];

  const payrollColumns: Column<Payroll>[] = [
    { key: 'number', header: t('tables.number') },
    { key: 'period', header: t('tables.period') },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={payrollStatusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'totalGross',
      header: t('tables.gross'),
      render: (row) => formatMoney(row.totalGross),
    },
    {
      key: 'totalDeductions',
      header: t('fields.deductions'),
      render: (row) => formatMoney(row.totalDeductions),
    },
    {
      key: 'totalNet',
      header: t('tables.net'),
      render: (row) => formatMoney(row.totalNet),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => void openPayrollView(row)}>
            {t('common.view')}
          </Button>
          {row.status === 'draft' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => runPayrollAction(row.id, 'post', 'hr.payrollPosted')}
              >
                {t('hr.post')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => runPayrollAction(row.id, 'cancel', 'hr.payrollCancelled')}
              >
                {t('common.cancel')}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const payrollLineColumns: Column<PayrollLine>[] = [
    {
      key: 'employee',
      header: t('fields.employee'),
      render: (row) =>
        row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '—',
    },
    { key: 'gross', header: t('tables.gross'), render: (row) => formatMoney(row.gross) },
    { key: 'bonus', header: t('fields.bonus'), render: (row) => formatMoney(row.bonus) },
    { key: 'overtime', header: t('fields.overtime'), render: (row) => formatMoney(row.overtime) },
    { key: 'deductions', header: t('fields.deductions'), render: (row) => formatMoney(row.deductions) },
    { key: 'net', header: t('tables.net'), render: (row) => formatMoney(row.net) },
  ];

  return (
    <>
      <PageHeader
        title={t('hr.title')}
        subtitle={t('hr.subtitle')}
        action={
          tab === 'employees' ? (
            <Button onClick={openCreate}>{t('hr.newEmployee')}</Button>
          ) : (
            <Button onClick={openPayroll}>{t('hr.generatePayroll')}</Button>
          )
        }
      />
      <div className="mb-4 flex gap-1">
        <button type="button" className={tab === 'employees' ? 'tab tab-active' : 'tab'} onClick={() => setTab('employees')}>
          {t('hr.employees')}
        </button>
        <button type="button" className={tab === 'payrolls' ? 'tab tab-active' : 'tab'} onClick={() => setTab('payrolls')}>
          {t('hr.payrolls')}
        </button>
      </div>
      {tab === 'employees' ? (
        <>
          {error ? <ErrorBanner message={error} /> : null}
          {!data && !error ? <LoadingBlock /> : null}
          {data ? (
            data.data.length === 0 ? (
              <EmptyState
                message={t('hr.noEmployees')}
                icon={<Users className="size-6" />}
                action={<Button onClick={openCreate}>{t('hr.newEmployee')}</Button>}
              />
            ) : (
              <DataTable columns={employeeColumns} rows={data.data} rowKey={(row) => row.id} />
            )
          ) : null}
        </>
      ) : (
        <>
          {payrollsError ? <ErrorBanner message={payrollsError} /> : null}
          {!payrolls && !payrollsError ? <LoadingBlock /> : null}
          {payrolls ? (
            payrolls.data.length === 0 ? (
              <EmptyState message={t('hr.noPayrollsYet')} icon={<Wallet className="size-6" />} />
            ) : (
              <DataTable columns={payrollColumns} rows={payrolls.data} rowKey={(row) => row.id} />
            )
          ) : null}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? t('hr.editEmployee') : t('hr.newEmployeeTitle')} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-no">{t('fields.employeeNo')}</label>
                <Input className="w-full" id="emp-no" {...register('employeeNo')} />
                {errors.employeeNo ? <div className="text-[12px] font-normal text-danger">{errors.employeeNo.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-first">{t('fields.firstName')} *</label>
                <Input className="w-full" id="emp-first" {...register('firstName')} />
                {errors.firstName ? <div className="text-[12px] font-normal text-danger">{errors.firstName.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-last">{t('fields.lastName')} *</label>
                <Input className="w-full" id="emp-last" {...register('lastName')} />
                {errors.lastName ? <div className="text-[12px] font-normal text-danger">{errors.lastName.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-email">{t('fields.email')}</label>
                <Input className="w-full" id="emp-email" type="email" {...register('email')} />
                {errors.email ? <div className="text-[12px] font-normal text-danger">{errors.email.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-phone">{t('fields.phone')}</label>
                <Input className="w-full" id="emp-phone" {...register('phone')} />
                {errors.phone ? <div className="text-[12px] font-normal text-danger">{errors.phone.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-department">{t('fields.department')}</label>
                <Select className="w-full" id="emp-department" {...register('departmentId')}>
                  <option value="">{t('hr.none')}</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-position">{t('fields.position')}</label>
                <Input className="w-full" id="emp-position" {...register('position')} />
                {errors.position ? <div className="text-[12px] font-normal text-danger">{errors.position.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-hire">{t('fields.hireDate')} *</label>
                <Input className="w-full" id="emp-hire" type="date" {...register('hireDate')} />
                {errors.hireDate ? <div className="text-[12px] font-normal text-danger">{errors.hireDate.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-salary">{t('fields.salary')}</label>
                <Input className="w-full" id="emp-salary" type="number" min="0" step="0.01" {...register('salary')} />
                {errors.salary ? <div className="text-[12px] font-normal text-danger">{errors.salary.message}</div> : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="emp-frequency">{t('fields.salaryFrequency')}</label>
                <Select className="w-full" id="emp-frequency" {...register('salaryFrequency')}>
                  <option value="monthly">{t('hr.monthly')}</option>
                  <option value="biweekly">{t('hr.biweekly')}</option>
                  <option value="weekly">{t('hr.weekly')}</option>
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label>{t('common.status')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="emp-active"
                    checked={status === 'active'}
                    onCheckedChange={(checked) => setValue('status', checked === true ? 'active' : 'inactive')}
                  />
                  <label htmlFor="emp-active" className="text-sm text-gray-700">
                    {t('common.active')}
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving} loading={saving}>
                {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('hr.createEmployee')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payrollOpen} onOpenChange={(open) => !payrollBusy && setPayrollOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('hr.generatePayrollTitle')} />
          <form onSubmit={(event) => void submitPayroll(event)}>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="payroll-period">{t('fields.period')} *</label>
              <Input className="w-full" id="payroll-period" type="month" {...payrollRegister('period')} />
              {payrollErrors.period ? (
                <div className="text-[12px] font-normal text-danger">{payrollErrors.period.message}</div>
              ) : null}
            </div>
            {activeEmployees.length === 0 ? (
              <p className="text-muted">{t('hr.noActiveEmployeesToInclude')}</p>
            ) : (
              <div className="mb-3 rounded-ui border border-border p-3">
                {activeEmployees.map((employee, index) => (
                  <div className="grid grid-cols-[3fr_1fr_1.5fr_1fr_auto] items-start gap-2.5" key={employee.id}>
                    <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                      <label>{t('fields.employee')}</label>
                      <Input className="w-full" value={`${employee.firstName} ${employee.lastName}`} readOnly />
                    </div>
                    <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                      <label htmlFor={`pay-bonus-${employee.id}`}>{t('fields.bonus')}</label>
                      <Input className="w-full"
                        id={`pay-bonus-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        {...payrollRegister(`lines.${index}.bonus`)}
                      />
                      {payrollErrors.lines?.[index]?.bonus ? (
                        <div className="text-[12px] font-normal text-danger">{payrollErrors.lines[index]?.bonus?.message}</div>
                      ) : null}
                    </div>
                    <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                      <label htmlFor={`pay-overtime-${employee.id}`}>{t('fields.overtime')}</label>
                      <Input className="w-full"
                        id={`pay-overtime-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        {...payrollRegister(`lines.${index}.overtime`)}
                      />
                      {payrollErrors.lines?.[index]?.overtime ? (
                        <div className="text-[12px] font-normal text-danger">{payrollErrors.lines[index]?.overtime?.message}</div>
                      ) : null}
                    </div>
                    <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                      <label htmlFor={`pay-deductions-${employee.id}`}>{t('fields.deductions')}</label>
                      <Input className="w-full"
                        id={`pay-deductions-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        {...payrollRegister(`lines.${index}.deductions`)}
                      />
                      {payrollErrors.lines?.[index]?.deductions ? (
                        <div className="text-[12px] font-normal text-danger">{payrollErrors.lines[index]?.deductions?.message}</div>
                      ) : null}
                    </div>
                    <div className="pt-6" />
                  </div>
                ))}
              </div>
            )}
            {payrollError ? <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">{payrollError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={payrollBusy} loading={payrollBusy}>
                {payrollBusy ? t('hr.generating') : t('hr.generateDraft')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewingPayroll !== null} onOpenChange={(open) => !open && setViewingPayroll(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={t('hr.payroll', { number: viewingPayroll?.number ?? '' })} />
          {viewingPayroll ? (
            <>
              <p className="text-muted">
                {viewingPayroll.period} · <Badge tone={payrollStatusTone(viewingPayroll.status)}>{viewingPayroll.status}</Badge>
              </p>
              <DataTable
                columns={payrollLineColumns}
                rows={viewingPayroll.lines}
                rowKey={(row) => row.id}
              />
            </>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setViewingPayroll(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
