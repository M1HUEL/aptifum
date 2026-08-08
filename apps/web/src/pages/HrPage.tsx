import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
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
import {
  Button,
  Checkbox,
  Field,
  Modal,
  Select,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';
import { usePagedQuery } from '../hooks/usePagedQuery';

function employeeStatusTone(status: EmployeeStatus): BadgeTone {
  return status === 'active' ? 'success' : 'neutral';
}

function payrollStatusTone(status: PayrollStatus): BadgeTone {
  if (status === 'posted') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

interface EmployeeForm {
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  hireDate: string;
  salary: string;
  salaryFrequency: string;
  status: EmployeeStatus;
}

const emptyEmployee: EmployeeForm = {
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

export function HrPage() {
  const [tab, setTab] = useState<'employees' | 'payrolls'>('employees');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyEmployee);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [payrollLines, setPayrollLines] = useState<Record<string, { bonus: string; overtime: string; deductions: string }>>({});
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [payrollBusy, setPayrollBusy] = useState(false);
  const [viewingPayroll, setViewingPayroll] = useState<Payroll | null>(null);
  const toast = useToast();

  const { data, error, reload } = usePagedQuery<Employee>({
    path: '/api/v1/hr/employees',
    page: 1,
  });

  const {
    data: payrolls,
    error: payrollsError,
    reload: reloadPayrolls,
  } = usePagedQuery<Payroll>({
    path: '/api/v1/hr/payrolls',
    page: 1,
  });

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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyEmployee);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setForm({
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
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (!saving) setCreateOpen(false);
  };

  const setField = (key: keyof EmployeeForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.hireDate) {
      setFormError('First name, last name and hire date are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
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
    try {
      if (editingId) {
        await apiFetch(`/api/v1/hr/employees/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Employee updated.');
      } else {
        await apiFetch('/api/v1/hr/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Employee created.');
      }
      setCreateOpen(false);
      void reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save employee.');
    } finally {
      setSaving(false);
    }
  };

  const openPayroll = () => {
    setPayrollPeriod(new Date().toISOString().slice(0, 7));
    const lines: Record<string, { bonus: string; overtime: string; deductions: string }> = {};
    for (const employee of employees) {
      if (employee.status === 'active') {
        lines[employee.id] = { bonus: '', overtime: '', deductions: '' };
      }
    }
    setPayrollLines(lines);
    setPayrollError(null);
    setPayrollOpen(true);
  };

  const closePayroll = () => {
    if (!payrollBusy) setPayrollOpen(false);
  };

  const setPayrollLineField = (employeeId: string, key: 'bonus' | 'overtime' | 'deductions', value: string) => {
    setPayrollLines((current) => ({
      ...current,
      [employeeId]: { ...current[employeeId], [key]: value },
    }));
  };

  const submitPayroll = async (event: FormEvent) => {
    event.preventDefault();
    const lines = employees
      .filter((employee) => employee.status === 'active')
      .map((employee) => ({
        employeeId: employee.id,
        bonus:
          payrollLines[employee.id]?.bonus === '' ? undefined : Number(payrollLines[employee.id]?.bonus ?? 0),
        overtime:
          payrollLines[employee.id]?.overtime === ''
            ? undefined
            : Number(payrollLines[employee.id]?.overtime ?? 0),
        deductions:
          payrollLines[employee.id]?.deductions === ''
            ? undefined
            : Number(payrollLines[employee.id]?.deductions ?? 0),
      }));
    if (lines.length === 0) {
      setPayrollError('No active employees to pay.');
      return;
    }
    setPayrollBusy(true);
    setPayrollError(null);
    const body = { period: payrollPeriod, lines };
    try {
      await apiFetch('/api/v1/hr/payrolls/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.toast('Draft payroll generated.');
      setPayrollOpen(false);
      reloadPayrolls();
    } catch (err) {
      setPayrollError(err instanceof ApiError ? err.message : 'Could not generate payroll.');
    } finally {
      setPayrollBusy(false);
    }
  };

  const runPayrollAction = async (id: string, action: 'post' | 'cancel', message: string) => {
    try {
      await apiFetch(`/api/v1/hr/payrolls/${id}/${action}`, { method: 'POST' });
      toast.toast(message);
      reloadPayrolls();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    }
  };

  const openPayrollView = async (payroll: Payroll) => {
    try {
      const detail = await apiFetch<Payroll>(`/api/v1/hr/payrolls/${payroll.id}`);
      setViewingPayroll(detail);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not load payroll.', 'error');
    }
  };

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
                onClick={() => void runPayrollAction(row.id, 'post', 'Payroll posted.')}
              >
                Post
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void runPayrollAction(row.id, 'cancel', 'Payroll cancelled.')}
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

      <Modal
        open={createOpen}
        title={editingId ? 'Edit employee' : 'New employee'}
        onClose={closeCreate}
        width="lg"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="Employee no." htmlFor="emp-no">
              <TextInput
                id="emp-no"
                value={form.employeeNo}
                onChange={(event) => setField('employeeNo', event.target.value)}
              />
            </Field>
            <Field label="First name" htmlFor="emp-first" required>
              <TextInput
                id="emp-first"
                value={form.firstName}
                onChange={(event) => setField('firstName', event.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="emp-last" required>
              <TextInput
                id="emp-last"
                value={form.lastName}
                onChange={(event) => setField('lastName', event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="emp-email">
              <TextInput
                id="emp-email"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="emp-phone">
              <TextInput
                id="emp-phone"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </Field>
            <Field label="Department" htmlFor="emp-department">
              <Select
                id="emp-department"
                value={form.departmentId}
                onChange={(event) => setField('departmentId', event.target.value)}
              >
                <option value="">— None —</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Position" htmlFor="emp-position">
              <TextInput
                id="emp-position"
                value={form.position}
                onChange={(event) => setField('position', event.target.value)}
              />
            </Field>
            <Field label="Hire date" htmlFor="emp-hire" required>
              <TextInput
                id="emp-hire"
                type="date"
                value={form.hireDate}
                onChange={(event) => setField('hireDate', event.target.value)}
              />
            </Field>
            <Field label="Salary" htmlFor="emp-salary">
              <TextInput
                id="emp-salary"
                type="number"
                min="0"
                step="0.01"
                value={form.salary}
                onChange={(event) => setField('salary', event.target.value)}
              />
            </Field>
            <Field label="Salary frequency" htmlFor="emp-frequency">
              <Select
                id="emp-frequency"
                value={form.salaryFrequency}
                onChange={(event) => setField('salaryFrequency', event.target.value)}
              >
                <option value="monthly">monthly</option>
                <option value="biweekly">biweekly</option>
                <option value="weekly">weekly</option>
              </Select>
            </Field>
            <Field label="Status">
              <Checkbox
                label="Active"
                checked={form.status === 'active'}
                onChange={(event) => setField('status', event.target.checked ? 'active' : 'inactive')}
              />
            </Field>
          </div>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeCreate} disabled={saving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create employee'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={payrollOpen} title="Generate payroll" onClose={closePayroll} width="lg">
        <form onSubmit={(event) => void submitPayroll(event)}>
          <Field label="Period" htmlFor="payroll-period" required>
            <TextInput
              id="payroll-period"
              type="month"
              value={payrollPeriod}
              onChange={(event) => setPayrollPeriod(event.target.value)}
            />
          </Field>
          {employees.filter((employee) => employee.status === 'active').length === 0 ? (
            <p className="modal-message">No active employees to include.</p>
          ) : (
            <div className="invoice-items">
              {employees
                .filter((employee) => employee.status === 'active')
                .map((employee) => (
                  <div className="invoice-item" key={employee.id}>
                    <Field label="Employee">
                      <TextInput
                        value={`${employee.firstName} ${employee.lastName}`}
                        readOnly
                      />
                    </Field>
                    <Field label="Bonus" htmlFor={`pay-bonus-${employee.id}`}>
                      <TextInput
                        id={`pay-bonus-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={payrollLines[employee.id]?.bonus ?? ''}
                        onChange={(event) => setPayrollLineField(employee.id, 'bonus', event.target.value)}
                      />
                    </Field>
                    <Field label="Overtime" htmlFor={`pay-overtime-${employee.id}`}>
                      <TextInput
                        id={`pay-overtime-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={payrollLines[employee.id]?.overtime ?? ''}
                        onChange={(event) => setPayrollLineField(employee.id, 'overtime', event.target.value)}
                      />
                    </Field>
                    <Field label="Deductions" htmlFor={`pay-deductions-${employee.id}`}>
                      <TextInput
                        id={`pay-deductions-${employee.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={payrollLines[employee.id]?.deductions ?? ''}
                        onChange={(event) => setPayrollLineField(employee.id, 'deductions', event.target.value)}
                      />
                    </Field>
                    <div className="invoice-item-remove" />
                  </div>
                ))}
            </div>
          )}
          {payrollError ? <div className="error-banner">{payrollError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={closePayroll} disabled={payrollBusy}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={payrollBusy}>
              {payrollBusy ? 'Generating…' : 'Generate draft'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={viewingPayroll !== null}
        title={`Payroll ${viewingPayroll?.number ?? ''}`}
        onClose={() => setViewingPayroll(null)}
        width="lg"
      >
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
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setViewingPayroll(null)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
