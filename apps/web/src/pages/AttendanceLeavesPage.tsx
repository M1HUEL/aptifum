import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  Leave,
  LeaveStatus,
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
import { usePermission } from '../auth/AuthContext';
import { useToast } from '../components/toast';

const leaveTypes = ['vacation', 'sick', 'personal', 'other'] as const;
const leaveStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const;
const attendanceStatuses = ['present', 'late', 'absent', 'leave'] as const;

function attendanceTone(status: AttendanceStatus): BadgeTone {
  if (status === 'late') return 'warning';
  if (status === 'absent') return 'danger';
  if (status === 'leave') return 'info';
  return 'success';
}

function leaveTone(status: LeaveStatus): BadgeTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'cancelled') return 'neutral';
  return 'info';
}

function employeeName(employee: Employee | null | undefined): string {
  if (!employee) return '—';
  return `${employee.firstName} ${employee.lastName}`.trim();
}

interface ClockForm {
  employeeId: string;
  action: 'in' | 'out';
  at: string;
}

const emptyClock: ClockForm = { employeeId: '', action: 'in', at: '' };

interface AttendanceForm {
  employeeId: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string;
  status: string;
  notes: string;
}

const emptyAttendance: AttendanceForm = {
  employeeId: '',
  workDate: '',
  clockInAt: '',
  clockOutAt: '',
  status: 'present',
  notes: '',
};

interface LeaveForm {
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string;
}

const emptyLeave: LeaveForm = {
  employeeId: '',
  leaveType: 'vacation',
  startDate: '',
  endDate: '',
  days: '',
  reason: '',
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AttendanceLeavesPage() {
  const [tab, setTab] = useState<'attendance' | 'leaves'>('attendance');
  const can = usePermission();
  const toast = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attPage, setAttPage] = useState(1);
  const [attData, setAttData] = useState<Paginated<AttendanceRecord> | null>(null);
  const [attError, setAttError] = useState<string | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attFilters, setAttFilters] = useState({ employeeId: '', from: '', to: '', status: '' });
  const [attFilterInput, setAttFilterInput] = useState({ employeeId: '', from: '', to: '', status: '' });

  const [leavePage, setLeavePage] = useState(1);
  const [leaveData, setLeaveData] = useState<Paginated<Leave> | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveFilters, setLeaveFilters] = useState({ employeeId: '', status: '', leaveType: '' });
  const [leaveFilterInput, setLeaveFilterInput] = useState({ employeeId: '', status: '', leaveType: '' });

  const [clockOpen, setClockOpen] = useState(false);
  const [clockForm, setClockForm] = useState<ClockForm>(emptyClock);
  const [clockError, setClockError] = useState<string | null>(null);
  const [clockBusy, setClockBusy] = useState(false);

  const [attOpen, setAttOpen] = useState(false);
  const [editingAttId, setEditingAttId] = useState<string | null>(null);
  const [attForm, setAttForm] = useState<AttendanceForm>(emptyAttendance);
  const [attFormError, setAttFormError] = useState<string | null>(null);
  const [attSaving, setAttSaving] = useState(false);
  const [deletingAtt, setDeletingAtt] = useState<AttendanceRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState<LeaveForm>(emptyLeave);
  const [leaveFormError, setLeaveFormError] = useState<string | null>(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [deletingLeave, setDeletingLeave] = useState<Leave | null>(null);

  const loadAttendance = async (page: number, filters: typeof attFilters) => {
    setAttLoading(true);
    setAttError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filters.employeeId) params.set('employeeId', filters.employeeId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.status) params.set('status', filters.status);
      setAttData(await apiFetch<Paginated<AttendanceRecord>>(`/api/v1/hr/attendance?${params.toString()}`));
    } catch (err) {
      setAttError(err instanceof ApiError ? err.message : 'Could not load attendance.');
    } finally {
      setAttLoading(false);
    }
  };

  const loadLeaves = async (page: number, filters: typeof leaveFilters) => {
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filters.employeeId) params.set('employeeId', filters.employeeId);
      if (filters.status) params.set('status', filters.status);
      if (filters.leaveType) params.set('leaveType', filters.leaveType);
      setLeaveData(await apiFetch<Paginated<Leave>>(`/api/v1/hr/leaves?${params.toString()}`));
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : 'Could not load leaves.');
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch<Paginated<Employee>>('/api/v1/hr/employees?page=1&limit=100')
      .then((result) => {
        if (!cancelled) setEmployees(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadAttendance(attPage, attFilters);
  }, [attPage, attFilters]);

  useEffect(() => {
    void loadLeaves(leavePage, leaveFilters);
  }, [leavePage, leaveFilters]);

  const submitAttFilters = (event: FormEvent) => {
    event.preventDefault();
    setAttFilters(attFilterInput);
    setAttPage(1);
  };

  const submitLeaveFilters = (event: FormEvent) => {
    event.preventDefault();
    setLeaveFilters(leaveFilterInput);
    setLeavePage(1);
  };

  const openClock = () => {
    setClockForm(emptyClock);
    setClockError(null);
    setClockOpen(true);
  };

  const submitClock = async (event: FormEvent) => {
    event.preventDefault();
    if (!clockForm.employeeId) {
      setClockError('Select an employee.');
      return;
    }
    setClockBusy(true);
    setClockError(null);
    try {
      await apiFetch('/api/v1/hr/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: clockForm.employeeId,
          action: clockForm.action,
          at: clockForm.at || undefined,
        }),
      });
      toast.toast(clockForm.action === 'in' ? 'Clock in recorded.' : 'Clock out recorded.');
      setClockOpen(false);
      void loadAttendance(attPage, attFilters);
    } catch (err) {
      setClockError(err instanceof ApiError ? err.message : 'Could not record clock.');
    } finally {
      setClockBusy(false);
    }
  };

  const openAttendance = (record?: AttendanceRecord) => {
    if (record) {
      setEditingAttId(record.id);
      setAttForm({
        employeeId: record.employeeId,
        workDate: record.workDate,
        clockInAt: toLocalInput(record.clockInAt),
        clockOutAt: toLocalInput(record.clockOutAt),
        status: record.status,
        notes: record.notes ?? '',
      });
    } else {
      setEditingAttId(null);
      setAttForm(emptyAttendance);
    }
    setAttFormError(null);
    setAttOpen(true);
  };

  const submitAttendance = async (event: FormEvent) => {
    event.preventDefault();
    if (!attForm.employeeId || !attForm.workDate) {
      setAttFormError('Employee and work date are required.');
      return;
    }
    setAttSaving(true);
    setAttFormError(null);
    try {
      if (editingAttId) {
        await apiFetch(`/api/v1/hr/attendance/${editingAttId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clockInAt: attForm.clockInAt ? new Date(attForm.clockInAt).toISOString() : undefined,
            clockOutAt: attForm.clockOutAt ? new Date(attForm.clockOutAt).toISOString() : undefined,
            status: attForm.status,
            notes: attForm.notes.trim() || undefined,
          }),
        });
        toast.toast('Attendance updated.');
      } else {
        await apiFetch('/api/v1/hr/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: attForm.employeeId,
            workDate: attForm.workDate,
            clockInAt: attForm.clockInAt ? new Date(attForm.clockInAt).toISOString() : undefined,
            clockOutAt: attForm.clockOutAt ? new Date(attForm.clockOutAt).toISOString() : undefined,
            status: attForm.status,
            notes: attForm.notes.trim() || undefined,
          }),
        });
        toast.toast('Attendance created.');
      }
      setAttOpen(false);
      void loadAttendance(attPage, attFilters);
    } catch (err) {
      setAttFormError(err instanceof ApiError ? err.message : 'Could not save attendance.');
    } finally {
      setAttSaving(false);
    }
  };

  const confirmDeleteAtt = async () => {
    if (!deletingAtt) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/hr/attendance/${deletingAtt.id}`, { method: 'DELETE' });
      toast.toast('Attendance deleted.');
      setDeletingAtt(null);
      void loadAttendance(attPage, attFilters);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete attendance.', 'error');
      setDeletingAtt(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const openLeave = (leave?: Leave) => {
    if (leave) {
      setEditingLeaveId(leave.id);
      setLeaveForm({
        employeeId: leave.employeeId,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days ? String(leave.days) : '',
        reason: leave.reason ?? '',
      });
    } else {
      setEditingLeaveId(null);
      setLeaveForm(emptyLeave);
    }
    setLeaveFormError(null);
    setLeaveOpen(true);
  };

  const submitLeave = async (event: FormEvent) => {
    event.preventDefault();
    if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate) {
      setLeaveFormError('Employee, start date and end date are required.');
      return;
    }
    setLeaveSaving(true);
    setLeaveFormError(null);
    const body = {
      employeeId: leaveForm.employeeId,
      leaveType: leaveForm.leaveType,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      days: leaveForm.days === '' ? undefined : Number(leaveForm.days),
      reason: leaveForm.reason.trim() || undefined,
    };
    try {
      if (editingLeaveId) {
        await apiFetch(`/api/v1/hr/leaves/${editingLeaveId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Leave updated.');
      } else {
        await apiFetch('/api/v1/hr/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.toast('Leave created.');
      }
      setLeaveOpen(false);
      void loadLeaves(leavePage, leaveFilters);
    } catch (err) {
      setLeaveFormError(err instanceof ApiError ? err.message : 'Could not save leave.');
    } finally {
      setLeaveSaving(false);
    }
  };

  const leaveAction = async (leave: Leave, action: 'approve' | 'reject') => {
    try {
      await apiFetch(`/api/v1/hr/leaves/${leave.id}/${action}`, { method: 'POST' });
      toast.toast(action === 'approve' ? 'Leave approved.' : 'Leave rejected.');
      void loadLeaves(leavePage, leaveFilters);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    }
  };

  const confirmDeleteLeave = async () => {
    if (!deletingLeave) return;
    try {
      await apiFetch(`/api/v1/hr/leaves/${deletingLeave.id}`, { method: 'DELETE' });
      toast.toast('Leave deleted.');
      setDeletingLeave(null);
      void loadLeaves(leavePage, leaveFilters);
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete leave.', 'error');
      setDeletingLeave(null);
    }
  };

  const attendanceColumns: Column<AttendanceRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => employeeName(row.employee),
    },
    { key: 'workDate', header: 'Work date', render: (row) => formatDate(row.workDate) },
    {
      key: 'clockInAt',
      header: 'Clock in',
      render: (row) => (row.clockInAt ? new Date(row.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'),
    },
    {
      key: 'clockOutAt',
      header: 'Clock out',
      render: (row) => (row.clockOutAt ? new Date(row.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'),
    },
    {
      key: 'workedMinutes',
      header: 'Worked',
      render: (row) => (row.workedMinutes ? `${row.workedMinutes} min` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={attendanceTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openAttendance(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingAtt(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const leaveColumns: Column<Leave>[] = [
    { key: 'employee', header: 'Employee', render: (row) => employeeName(row.employee) },
    { key: 'leaveType', header: 'Type', render: (row) => row.leaveType },
    { key: 'startDate', header: 'Start', render: (row) => formatDate(row.startDate) },
    { key: 'endDate', header: 'End', render: (row) => formatDate(row.endDate) },
    { key: 'days', header: 'Days', render: (row) => row.days },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={leaveTone(row.status)}>{row.status}</Badge> },
    { key: 'reason', header: 'Reason', render: (row) => row.reason ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {row.status === 'pending' ? (
            <>
              {can('hr:approve') ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => void leaveAction(row, 'approve')}>
                    Approve
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void leaveAction(row, 'reject')}>
                    Reject
                  </Button>
                </>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => openLeave(row)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeletingLeave(row)}>
                Delete
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Attendance & leaves"
        subtitle="HR time tracking"
        action={
          tab === 'attendance' ? (
            <div className="table-actions">
              <Button variant="ghost" onClick={openClock}>
                Clock in / out
              </Button>
              <Button onClick={() => openAttendance()}>New attendance</Button>
            </div>
          ) : (
            <Button onClick={() => openLeave()}>New leave</Button>
          )
        }
      />

      <div className="tabs">
        <button type="button" className={tab === 'attendance' ? 'tab tab-active' : 'tab'} onClick={() => setTab('attendance')}>
          Attendance
        </button>
        <button type="button" className={tab === 'leaves' ? 'tab tab-active' : 'tab'} onClick={() => setTab('leaves')}>
          Leaves
        </button>
      </div>

      {tab === 'attendance' ? (
        <>
          {attError ? <ErrorBanner message={attError} /> : null}
          <form className="search-form" onSubmit={(event) => void submitAttFilters(event)}>
            <Select
              value={attFilterInput.employeeId}
              onChange={(event) => setAttFilterInput((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeName(employee)}
                </option>
              ))}
            </Select>
            <TextInput
              type="date"
              value={attFilterInput.from}
              onChange={(event) => setAttFilterInput((current) => ({ ...current, from: event.target.value }))}
            />
            <TextInput
              type="date"
              value={attFilterInput.to}
              onChange={(event) => setAttFilterInput((current) => ({ ...current, to: event.target.value }))}
            />
            <Select
              value={attFilterInput.status}
              onChange={(event) => setAttFilterInput((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {attendanceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <button type="submit" className="btn">
              Search
            </button>
          </form>
          {attLoading && !attData ? <LoadingBlock /> : null}
          {attData ? (
            <>
              {attData.data.length === 0 ? (
                <EmptyState message="No attendance records." />
              ) : (
                <DataTable columns={attendanceColumns} rows={attData.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={attData.meta.page} limit={attData.meta.limit} total={attData.meta.total} onPage={setAttPage} />
            </>
          ) : null}
        </>
      ) : (
        <>
          {leaveError ? <ErrorBanner message={leaveError} /> : null}
          <form className="search-form" onSubmit={(event) => void submitLeaveFilters(event)}>
            <Select
              value={leaveFilterInput.employeeId}
              onChange={(event) => setLeaveFilterInput((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeName(employee)}
                </option>
              ))}
            </Select>
            <Select
              value={leaveFilterInput.status}
              onChange={(event) => setLeaveFilterInput((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {leaveStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Select
              value={leaveFilterInput.leaveType}
              onChange={(event) => setLeaveFilterInput((current) => ({ ...current, leaveType: event.target.value }))}
            >
              <option value="">All types</option>
              {leaveTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <button type="submit" className="btn">
              Search
            </button>
          </form>
          {leaveLoading && !leaveData ? <LoadingBlock /> : null}
          {leaveData ? (
            <>
              {leaveData.data.length === 0 ? (
                <EmptyState message="No leaves." />
              ) : (
                <DataTable columns={leaveColumns} rows={leaveData.data} rowKey={(row) => row.id} />
              )}
              <Pagination page={leaveData.meta.page} limit={leaveData.meta.limit} total={leaveData.meta.total} onPage={setLeavePage} />
            </>
          ) : null}
        </>
      )}

      <Modal open={clockOpen} title="Clock in / out" onClose={() => setClockOpen(false)}>
        <form onSubmit={(event) => void submitClock(event)}>
          <Field label="Employee" htmlFor="clock-employee" required>
            <Select
              id="clock-employee"
              value={clockForm.employeeId}
              onChange={(event) => setClockForm((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">— Select employee —</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeName(employee)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action" htmlFor="clock-action" required>
            <Select
              id="clock-action"
              value={clockForm.action}
              onChange={(event) => setClockForm((current) => ({ ...current, action: event.target.value as 'in' | 'out' }))}
            >
              <option value="in">Clock in</option>
              <option value="out">Clock out</option>
            </Select>
          </Field>
          <Field label="At" htmlFor="clock-at">
            <TextInput
              id="clock-at"
              type="datetime-local"
              value={clockForm.at}
              onChange={(event) => setClockForm((current) => ({ ...current, at: event.target.value }))}
            />
          </Field>
          {clockError ? <div className="error-banner">{clockError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setClockOpen(false)} disabled={clockBusy}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={clockBusy}>
              {clockBusy ? 'Recording…' : 'Record'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={attOpen}
        title={editingAttId ? 'Edit attendance' : 'New attendance'}
        onClose={() => !attSaving && setAttOpen(false)}
        width="lg"
      >
        <form onSubmit={(event) => void submitAttendance(event)}>
          <div className="form-grid">
            <Field label="Employee" htmlFor="att-employee" required>
              <Select
                id="att-employee"
                value={attForm.employeeId}
                onChange={(event) => setAttForm((current) => ({ ...current, employeeId: event.target.value }))}
              >
                <option value="">— Select employee —</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Work date" htmlFor="att-date" required>
              <TextInput
                id="att-date"
                type="date"
                value={attForm.workDate}
                onChange={(event) => setAttForm((current) => ({ ...current, workDate: event.target.value }))}
              />
            </Field>
            <Field label="Clock in" htmlFor="att-in">
              <TextInput
                id="att-in"
                type="datetime-local"
                value={attForm.clockInAt}
                onChange={(event) => setAttForm((current) => ({ ...current, clockInAt: event.target.value }))}
              />
            </Field>
            <Field label="Clock out" htmlFor="att-out">
              <TextInput
                id="att-out"
                type="datetime-local"
                value={attForm.clockOutAt}
                onChange={(event) => setAttForm((current) => ({ ...current, clockOutAt: event.target.value }))}
              />
            </Field>
            <Field label="Status" htmlFor="att-status">
              <Select
                id="att-status"
                value={attForm.status}
                onChange={(event) => setAttForm((current) => ({ ...current, status: event.target.value }))}
              >
                {attendanceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="att-notes">
            <TextArea
              id="att-notes"
              rows={2}
              value={attForm.notes}
              onChange={(event) => setAttForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </Field>
          {attFormError ? <div className="error-banner">{attFormError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setAttOpen(false)} disabled={attSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={attSaving}>
              {attSaving ? 'Saving…' : editingAttId ? 'Save changes' : 'Create attendance'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={leaveOpen}
        title={editingLeaveId ? 'Edit leave' : 'New leave'}
        onClose={() => !leaveSaving && setLeaveOpen(false)}
        width="lg"
      >
        <form onSubmit={(event) => void submitLeave(event)}>
          <div className="form-grid">
            <Field label="Employee" htmlFor="leave-employee" required>
              <Select
                id="leave-employee"
                value={leaveForm.employeeId}
                onChange={(event) => setLeaveForm((current) => ({ ...current, employeeId: event.target.value }))}
              >
                <option value="">— Select employee —</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" htmlFor="leave-type" required>
              <Select
                id="leave-type"
                value={leaveForm.leaveType}
                onChange={(event) => setLeaveForm((current) => ({ ...current, leaveType: event.target.value }))}
              >
                {leaveTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start date" htmlFor="leave-start" required>
              <TextInput
                id="leave-start"
                type="date"
                value={leaveForm.startDate}
                onChange={(event) => setLeaveForm((current) => ({ ...current, startDate: event.target.value }))}
              />
            </Field>
            <Field label="End date" htmlFor="leave-end" required>
              <TextInput
                id="leave-end"
                type="date"
                value={leaveForm.endDate}
                onChange={(event) => setLeaveForm((current) => ({ ...current, endDate: event.target.value }))}
              />
            </Field>
            <Field label="Days" htmlFor="leave-days">
              <TextInput
                id="leave-days"
                type="number"
                min="1"
                max="365"
                value={leaveForm.days}
                onChange={(event) => setLeaveForm((current) => ({ ...current, days: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Reason" htmlFor="leave-reason">
            <TextArea
              id="leave-reason"
              rows={2}
              value={leaveForm.reason}
              onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))}
            />
          </Field>
          {leaveFormError ? <div className="error-banner">{leaveFormError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setLeaveOpen(false)} disabled={leaveSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={leaveSaving}>
              {leaveSaving ? 'Saving…' : editingLeaveId ? 'Save changes' : 'Create leave'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingAtt !== null}
        title="Delete attendance"
        message={`Delete attendance for ${deletingAtt ? employeeName(deletingAtt.employee) : ''}?`}
        confirmLabel="Delete"
        busy={deleteBusy}
        onCancel={() => setDeletingAtt(null)}
        onConfirm={() => void confirmDeleteAtt()}
      />

      <ConfirmDialog
        open={deletingLeave !== null}
        title="Delete leave"
        message={`Delete this ${deletingLeave?.leaveType} leave?`}
        confirmLabel="Delete"
        onCancel={() => setDeletingLeave(null)}
        onConfirm={() => void confirmDeleteLeave()}
      />
    </>
  );
}
