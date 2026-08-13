import { useEffect, useState } from 'react';
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
} from '../components/ui';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/use-paged-query';

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
    message: string;
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
        toast.toast(payrollAction.message);
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

  const openEdit = (employee: Employee) => {
    setEditingId(employee.id);
    reset(fromEmployee(employee));
    setFormError(null);
    setCreateOpen(true);
  };

  const submit = handleSubmit((values) => {
    setFormError(null);
    const onSuccess = () => {
      toast.toast(editingId ? 'Employee updated.' : 'Employee created.');
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
      setPayrollError('No active employees to pay.');
      return;
    }
    generateMutation.mutate(
      { period: values.period, lines },
      {
        onSuccess: () => {
          toast.toast('Draft payroll generated.');
          setPayrollOpen(false);
          void invalidate(['paged', '/api/v1/hr/payrolls']);
        },
        onError: (err) => setPayrollError(err.message),
      },
    );
  });

  const runPayrollAction = (id: string, action: 'post' | 'cancel', message: string) => {
    setPayrollAction({ id, action, message });
  };

  const openPayrollView = async (payroll: Payroll) => {
    try {
      const detail = await apiFetch<Payroll>(`/api/v1/hr/payrolls/${payroll.id}`);
      setViewingPayroll(detail);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not load payroll.', 'error');
    }
  };

  const activeEmployees = employees.filter((employee) => employee.status === 'active');

  const employeeColumns: Column<Employee>[] = [
    { key: 'employeeNo', header: 'No.' },
    {
      key: 'name',
      header: 'Name',
      render: (row) => `${row.firstName} ${row.lastName}`,
    },
    { key: 'position', header: 'Position', render: (row) => row.position ?? '—' },
    {
      key: 'department',
      header: 'Department',
      render: (row) => row.department?.name ?? '—',
    },
    {
      key: 'hireDate',
      header: 'Hire date',
      render: (row) => formatDate(row.hireDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={employeeStatusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  const payrollColumns: Column<Payroll>[] = [
    { key: 'number', header: 'Number' },
    { key: 'period', header: 'Period' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={payrollStatusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'totalGross',
      header: 'Gross',
      render: (row) => formatMoney(row.totalGross),
    },
    {
      key: 'totalDeductions',
      header: 'Deductions',
      render: (row) => formatMoney(row.totalDeductions),
    },
    {
      key: 'totalNet',
      header: 'Net',
      render: (row) => formatMoney(row.totalNet),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => void openPayrollView(row)}>
            View
          </Button>
          {row.status === 'draft' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => runPayrollAction(row.id, 'post', 'Payroll posted.')}
              >
                Post
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => runPayrollAction(row.id, 'cancel', 'Payroll cancelled.')}
              >
                Cancel
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
      header: 'Employee',
      render: (row) =>
        row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '—',
    },
    { key: 'gross', header: 'Gross', render: (row) => formatMoney(row.gross) },
    { key: 'bonus', header: 'Bonus', render: (row) => formatMoney(row.bonus) },
    { key: 'overtime', header: 'Overtime', render: (row) => formatMoney(row.overtime) },
    { key: 'deductions', header: 'Deductions', render: (row) => formatMoney(row.deductions) },
    { key: 'net', header: 'Net', render: (row) => formatMoney(row.net) },
  ];

  return (
    <>
      <PageHeader
        title="Human resources"
        subtitle="Employees and payroll"
        action={
          tab === 'employees' ? (
            <Button onClick={openCreate}>New employee</Button>
          ) : (
            <Button onClick={openPayroll}>Generate payroll</Button>
          )
        }
      />
      <div className="tabs">
        <button type="button" className={tab === 'employees' ? 'tab tab-active' : 'tab'} onClick={() => setTab('employees')}>
          Employees
        </button>
        <button type="button" className={tab === 'payrolls' ? 'tab tab-active' : 'tab'} onClick={() => setTab('payrolls')}>
          Payrolls
        </button>
      </div>
      {tab === 'employees' ? (
        <>
          {error ? <ErrorBanner message={error} /> : null}
          {!data && !error ? <LoadingBlock /> : null}
          {data ? (
            data.data.length === 0 ? (
              <EmptyState message="No employees." />
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
              <EmptyState message="No payrolls yet." />
            ) : (
              <DataTable columns={payrollColumns} rows={payrolls.data} rowKey={(row) => row.id} />
            )
          ) : null}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingId ? 'Edit employee' : 'New employee'} />
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="emp-no">Employee no.</label>
                <input id="emp-no" {...register('employeeNo')} />
                {errors.employeeNo ? <div className="field-error">{errors.employeeNo.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-first">First name *</label>
                <input id="emp-first" {...register('firstName')} />
                {errors.firstName ? <div className="field-error">{errors.firstName.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-last">Last name *</label>
                <input id="emp-last" {...register('lastName')} />
                {errors.lastName ? <div className="field-error">{errors.lastName.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-email">Email</label>
                <input id="emp-email" type="email" {...register('email')} />
                {errors.email ? <div className="field-error">{errors.email.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-phone">Phone</label>
                <input id="emp-phone" {...register('phone')} />
                {errors.phone ? <div className="field-error">{errors.phone.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-department">Department</label>
                <select id="emp-department" {...register('departmentId')}>
                  <option value="">— None —</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="emp-position">Position</label>
                <input id="emp-position" {...register('position')} />
                {errors.position ? <div className="field-error">{errors.position.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-hire">Hire date *</label>
                <input id="emp-hire" type="date" {...register('hireDate')} />
                {errors.hireDate ? <div className="field-error">{errors.hireDate.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-salary">Salary</label>
                <input id="emp-salary" type="number" min="0" step="0.01" {...register('salary')} />
                {errors.salary ? <div className="field-error">{errors.salary.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="emp-frequency">Salary frequency</label>
                <select id="emp-frequency" {...register('salaryFrequency')}>
                  <option value="monthly">monthly</option>
                  <option value="biweekly">biweekly</option>
                  <option value="weekly">weekly</option>
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="emp-active"
                    checked={status === 'active'}
                    onCheckedChange={(checked) => setValue('status', checked === true ? 'active' : 'inactive')}
                  />
                  <label htmlFor="emp-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            </div>
            {formError ? <div className="error-banner">{formError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create employee'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payrollOpen} onOpenChange={(open) => !payrollBusy && setPayrollOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title="Generate payroll" />
          <form onSubmit={(event) => void submitPayroll(event)}>
            <div className="field">
              <label htmlFor="payroll-period">Period *</label>
              <input id="payroll-period" type="month" {...payrollRegister('period')} />
              {payrollErrors.period ? (
                <div className="field-error">{payrollErrors.period.message}</div>
              ) : null}
            </div>
            {activeEmployees.length === 0 ? (
              <p className="modal-message">No active employees to include.</p>
            ) : (
              <div className="invoice-items">
                {activeEmployees.map((employee, index) => (
                  <div className="invoice-item" key={employee.id}>
                    <div className="field">
                      <label>Employee</label>
                      <input value={`${employee.firstName} ${employee.lastName}`} readOnly />
                    </div>
                    <div className="field">
                      <label htmlFor={`pay-bonus-${employee.id}`}>Bonus</label>
                      <input
                        id={`pay-bonus-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        {...payrollRegister(`lines.${index}.bonus`)}
                      />
                      {payrollErrors.lines?.[index]?.bonus ? (
                        <div className="field-error">{payrollErrors.lines[index]?.bonus?.message}</div>
                      ) : null}
                    </div>
                    <div className="field">
                      <label htmlFor={`pay-overtime-${employee.id}`}>Overtime</label>
                      <input
                        id={`pay-overtime-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        {...payrollRegister(`lines.${index}.overtime`)}
                      />
                      {payrollErrors.lines?.[index]?.overtime ? (
                        <div className="field-error">{payrollErrors.lines[index]?.overtime?.message}</div>
                      ) : null}
                    </div>
                    <div className="field">
                      <label htmlFor={`pay-deductions-${employee.id}`}>Deductions</label>
                      <input
                        id={`pay-deductions-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        {...payrollRegister(`lines.${index}.deductions`)}
                      />
                      {payrollErrors.lines?.[index]?.deductions ? (
                        <div className="field-error">{payrollErrors.lines[index]?.deductions?.message}</div>
                      ) : null}
                    </div>
                    <div className="invoice-item-remove" />
                  </div>
                ))}
              </div>
            )}
            {payrollError ? <div className="error-banner">{payrollError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={payrollBusy}>
                {payrollBusy ? 'Generating…' : 'Generate draft'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewingPayroll !== null} onOpenChange={(open) => !open && setViewingPayroll(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={`Payroll ${viewingPayroll?.number ?? ''}`} />
          {viewingPayroll ? (
            <>
              <p className="modal-message">
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
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
