import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, CalendarOff } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { apiFetch, ApiError } from '../api/client';
import { useApiMutation, useApiMutationVoid } from '../api/hooks';
import type { components } from '../api/schema';
import {
  attendanceFormSchema,
  clockFormSchema,
  leaveFormSchema,
  type AttendanceFormValues,
  type ClockFormValues,
  type LeaveFormValues,
} from '../api/schemas';
import type { AttendanceRecord, AttendanceStatus, Employee, Leave, LeaveStatus, Paginated } from '../api/types';
import { usePermission } from '../auth/auth-context';
import { useToast } from '../components/toast';
import {
  Badge,
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
  formatDate,
  PageHeader,
  Pagination,
  StatusSelect,
  TableSkeleton,
  Input,
  Select,
  Textarea,
} from '../components/ui';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
import { SearchableSelect } from '../components/ui/searchable-select';
import { exportRowsToCsv } from '../lib/csv';

const leaveTypes = ['vacation', 'sick', 'personal', 'other'] as const;
const leaveStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const;
const attendanceStatuses = ['present', 'late', 'absent', 'leave'] as const;

type ClockAttendanceDto = components['schemas']['ClockAttendanceDto'];
type CreateAttendanceDto = components['schemas']['CreateAttendanceDto'];
type UpdateAttendanceDto = components['schemas']['UpdateAttendanceDto'];
type CreateLeaveDto = components['schemas']['CreateLeaveDto'];

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

const emptyClock: ClockFormValues = { employeeId: '', action: 'in', at: '' };

const emptyAttendance: AttendanceFormValues = {
  employeeId: '',
  workDate: '',
  clockInAt: '',
  clockOutAt: '',
  status: 'present',
  notes: '',
};

const emptyLeave: LeaveFormValues = {
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

function attendanceToDto(form: AttendanceFormValues): CreateAttendanceDto {
  return {
    employeeId: form.employeeId,
    workDate: form.workDate,
    clockInAt: form.clockInAt ? new Date(form.clockInAt).toISOString() : undefined,
    clockOutAt: form.clockOutAt ? new Date(form.clockOutAt).toISOString() : undefined,
    status: form.status,
    notes: form.notes.trim() || undefined,
  };
}

function attendanceToUpdateDto(form: AttendanceFormValues): UpdateAttendanceDto {
  return {
    clockInAt: form.clockInAt ? new Date(form.clockInAt).toISOString() : undefined,
    clockOutAt: form.clockOutAt ? new Date(form.clockOutAt).toISOString() : undefined,
    status: form.status,
    notes: form.notes.trim() || undefined,
  };
}

function fromAttendance(record: AttendanceRecord): AttendanceFormValues {
  return {
    employeeId: record.employeeId,
    workDate: record.workDate,
    clockInAt: toLocalInput(record.clockInAt),
    clockOutAt: toLocalInput(record.clockOutAt),
    status: record.status,
    notes: record.notes ?? '',
  };
}

function leaveToDto(form: LeaveFormValues): CreateLeaveDto {
  return {
    employeeId: form.employeeId,
    leaveType: form.leaveType,
    startDate: form.startDate,
    endDate: form.endDate,
    days: form.days === '' ? undefined : Number(form.days),
    reason: form.reason.trim() || undefined,
  };
}

function fromLeave(leave: Leave): LeaveFormValues {
  return {
    employeeId: leave.employeeId,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    days: leave.days ? String(leave.days) : '',
    reason: leave.reason ?? '',
  };
}

export function AttendanceLeavesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'attendance' | 'leaves'>('attendance');
  const can = usePermission();
  const toast = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attPage, setAttPage] = useState(1);
  const [attLimit, setAttLimit] = useState(20);
  const [attData, setAttData] = useState<Paginated<AttendanceRecord> | null>(null);
  const [attError, setAttError] = useState<string | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attFilters, setAttFilters] = useState({ employeeId: '', from: '', to: '', status: '' });
  const [attFilterInput, setAttFilterInput] = useState({ employeeId: '', from: '', to: '', status: '' });

  const [leavePage, setLeavePage] = useState(1);
  const [leaveLimit, setLeaveLimit] = useState(20);
  const [leaveData, setLeaveData] = useState<Paginated<Leave> | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveFilters, setLeaveFilters] = useState({ employeeId: '', status: '', leaveType: '' });
  const [leaveFilterInput, setLeaveFilterInput] = useState({ employeeId: '', status: '', leaveType: '' });

  const [clockOpen, setClockOpen] = useState(false);
  const [clockError, setClockError] = useState<string | null>(null);

  const [attOpen, setAttOpen] = useState(false);
  const [editingAttId, setEditingAttId] = useState<string | null>(null);
  const [attFormError, setAttFormError] = useState<string | null>(null);
  const [deletingAtt, setDeletingAtt] = useState<AttendanceRecord | null>(null);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [leaveFormError, setLeaveFormError] = useState<string | null>(null);
  const [deletingLeave, setDeletingLeave] = useState<Leave | null>(null);
  const [leaveActionTarget, setLeaveActionTarget] = useState<{
    leave: Leave;
    action: 'approve' | 'reject';
  } | null>(null);

  const clockForm = useForm<ClockFormValues>({
    resolver: zodResolver(clockFormSchema),
    defaultValues: emptyClock,
  });
  const {
    register: registerClock,
    handleSubmit: submitClockForm,
    reset: resetClock,
    control: controlClock,
    formState: { errors: clockErrors },
  } = clockForm;

  const attForm = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: emptyAttendance,
  });
  const {
    register: registerAtt,
    handleSubmit: submitAttForm,
    reset: resetAtt,
    control: controlAtt,
    formState: { errors: attErrors },
  } = attForm;

  const leaveForm = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: emptyLeave,
  });
  const {
    register: registerLeave,
    handleSubmit: submitLeaveForm,
    reset: resetLeave,
    control: controlLeave,
    formState: { errors: leaveErrors },
  } = leaveForm;

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: employeeName(employee),
  }));

  const loadAttendance = async (page: number, limit: number, filters: typeof attFilters) => {
    setAttLoading(true);
    setAttError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.employeeId) params.set('employeeId', filters.employeeId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.status) params.set('status', filters.status);
      setAttData(await apiFetch<Paginated<AttendanceRecord>>(`/api/v1/hr/attendance?${params.toString()}`));
    } catch (err) {
      setAttError(err instanceof ApiError ? err.message : t('hr.couldNotLoadAttendance'));
    } finally {
      setAttLoading(false);
    }
  };

  const loadLeaves = async (page: number, limit: number, filters: typeof leaveFilters) => {
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.employeeId) params.set('employeeId', filters.employeeId);
      if (filters.status) params.set('status', filters.status);
      if (filters.leaveType) params.set('leaveType', filters.leaveType);
      setLeaveData(await apiFetch<Paginated<Leave>>(`/api/v1/hr/leaves?${params.toString()}`));
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : t('hr.couldNotLoadLeaves'));
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
    void loadAttendance(attPage, attLimit, attFilters);
  }, [attPage, attLimit, attFilters]);

  useEffect(() => {
    void loadLeaves(leavePage, leaveLimit, leaveFilters);
  }, [leavePage, leaveLimit, leaveFilters]);

  const clockMutation = useApiMutation<ClockAttendanceDto>('/api/v1/hr/attendance/clock', 'POST');
  const createAttMutation = useApiMutation<CreateAttendanceDto>('/api/v1/hr/attendance', 'POST');
  const updateAttMutation = useApiMutation<UpdateAttendanceDto>(`/api/v1/hr/attendance/${editingAttId ?? ''}`, 'PATCH');
  const deleteAttMutation = useApiMutationVoid(`/api/v1/hr/attendance/${deletingAtt?.id ?? ''}`, 'DELETE');

  const createLeaveMutation = useApiMutation<CreateLeaveDto>('/api/v1/hr/leaves', 'POST');
  const updateLeaveMutation = useApiMutation<CreateLeaveDto>(`/api/v1/hr/leaves/${editingLeaveId ?? ''}`, 'PATCH');
  const deleteLeaveMutation = useApiMutationVoid(`/api/v1/hr/leaves/${deletingLeave?.id ?? ''}`, 'DELETE');
  const leaveActionMutation = useApiMutationVoid(
    leaveActionTarget
      ? `/api/v1/hr/leaves/${leaveActionTarget.leave.id}/${leaveActionTarget.action}`
      : '/api/v1/hr/leaves',
    'POST',
  );

  const clockBusy = clockMutation.isPending;
  const attSaving = createAttMutation.isPending || updateAttMutation.isPending;
  const deleteBusy = deleteAttMutation.isPending;
  const leaveSaving = createLeaveMutation.isPending || updateLeaveMutation.isPending;

  useEffect(() => {
    if (!leaveActionTarget) return;
    leaveActionMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(leaveActionTarget.action === 'approve' ? t('hr.leaveApproved') : t('hr.leaveRejected'));
        void loadLeaves(leavePage, leaveLimit, leaveFilters);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
      },
    });
    setLeaveActionTarget(null);
  }, [leaveActionTarget]);

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
    resetClock(emptyClock);
    setClockError(null);
    setClockOpen(true);
  };

  const submitClock = submitClockForm((values) => {
    setClockError(null);
    clockMutation.mutate(
      {
        employeeId: values.employeeId,
        action: values.action,
        at: values.at || undefined,
      },
      {
        onSuccess: () => {
          toast.toast(values.action === 'in' ? t('hr.clockInRecorded') : t('hr.clockOutRecorded'));
          setClockOpen(false);
          void loadAttendance(attPage, attLimit, attFilters);
        },
        onError: (err) => setClockError(err.message),
      },
    );
  });

  const openAttendance = (record?: AttendanceRecord) => {
    if (record) {
      setEditingAttId(record.id);
      resetAtt(fromAttendance(record));
    } else {
      setEditingAttId(null);
      resetAtt(emptyAttendance);
    }
    setAttFormError(null);
    setAttOpen(true);
  };

  const submitAttendance = submitAttForm((values) => {
    setAttFormError(null);
    const onSuccess = () => {
      toast.toast(editingAttId ? t('hr.attendanceUpdated') : t('hr.attendanceCreated'));
      setAttOpen(false);
      void loadAttendance(attPage, attLimit, attFilters);
    };
    const onError = (err: { message: string }) => setAttFormError(err.message);
    if (editingAttId) {
      updateAttMutation.mutate(attendanceToUpdateDto(values), { onSuccess, onError });
    } else {
      createAttMutation.mutate(attendanceToDto(values), { onSuccess, onError });
    }
  });

  const confirmDeleteAtt = () => {
    if (!deletingAtt) return;
    deleteAttMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t('hr.attendanceDeleted'));
        setDeletingAtt(null);
        void loadAttendance(attPage, attLimit, attFilters);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeletingAtt(null);
      },
    });
  };

  const openLeave = (leave?: Leave) => {
    if (leave) {
      setEditingLeaveId(leave.id);
      resetLeave(fromLeave(leave));
    } else {
      setEditingLeaveId(null);
      resetLeave(emptyLeave);
    }
    setLeaveFormError(null);
    setLeaveOpen(true);
  };

  const submitLeave = submitLeaveForm((values) => {
    setLeaveFormError(null);
    const onSuccess = () => {
      toast.toast(editingLeaveId ? t('hr.leaveUpdated') : t('hr.leaveCreated'));
      setLeaveOpen(false);
      void loadLeaves(leavePage, leaveLimit, leaveFilters);
    };
    const onError = (err: { message: string }) => setLeaveFormError(err.message);
    if (editingLeaveId) {
      updateLeaveMutation.mutate(leaveToDto(values), { onSuccess, onError });
    } else {
      createLeaveMutation.mutate(leaveToDto(values), { onSuccess, onError });
    }
  });

  const confirmDeleteLeave = () => {
    if (!deletingLeave) return;
    deleteLeaveMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast(t('hr.leaveDeleted'));
        setDeletingLeave(null);
        void loadLeaves(leavePage, leaveLimit, leaveFilters);
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeletingLeave(null);
      },
    });
  };

  const attendanceColumns: Column<AttendanceRecord>[] = [
    {
      key: 'employee',
      header: t('fields.employee'),
      render: (row) => employeeName(row.employee),
    },
    { key: 'workDate', header: t('fields.workDate'), render: (row) => formatDate(row.workDate) },
    {
      key: 'clockInAt',
      header: t('hr.clockIn'),
      render: (row) =>
        row.clockInAt ? new Date(row.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      key: 'clockOutAt',
      header: t('hr.clockOut'),
      render: (row) =>
        row.clockOutAt ? new Date(row.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      key: 'workedMinutes',
      header: t('hr.worked'),
      render: (row) => (row.workedMinutes ? t('hr.workedMinutes', { minutes: row.workedMinutes }) : '—'),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={attendanceTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => openAttendance(row)}>
            {t('common.edit')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingAtt(row)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  const leaveColumns: Column<Leave>[] = [
    { key: 'employee', header: t('fields.employee'), render: (row) => employeeName(row.employee) },
    { key: 'leaveType', header: t('tables.type'), render: (row) => row.leaveType },
    { key: 'startDate', header: t('hr.start'), render: (row) => formatDate(row.startDate) },
    { key: 'endDate', header: t('hr.end'), render: (row) => formatDate(row.endDate) },
    { key: 'days', header: t('fields.days'), render: (row) => row.days },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge tone={leaveTone(row.status)}>{row.status}</Badge>,
    },
    { key: 'reason', header: t('fields.reason'), render: (row) => row.reason ?? '—' },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          {row.status === 'pending' ? (
            <>
              {can('hr:approve') ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeaveActionTarget({ leave: row, action: 'approve' })}
                  >
                    {t('hr.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setLeaveActionTarget({ leave: row, action: 'reject' })}
                  >
                    {t('hr.reject')}
                  </Button>
                </>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => openLeave(row)}>
                {t('common.edit')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeletingLeave(row)}>
                {t('common.delete')}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const handleAttLimitChange = (next: number) => {
    setAttLimit(next);
    setAttPage(1);
  };

  const handleLeaveLimitChange = (next: number) => {
    setLeaveLimit(next);
    setLeavePage(1);
  };

  const handleExport = () => {
    if (tab === 'attendance') {
      if (!attData || attData.data.length === 0) return;
      exportRowsToCsv({ filename: 'attendance', columns: attendanceColumns, rows: attData.data });
    } else {
      if (!leaveData || leaveData.data.length === 0) return;
      exportRowsToCsv({ filename: 'leaves', columns: leaveColumns, rows: leaveData.data });
    }
  };

  return (
    <>
      <PageHeader
        title={t('hr.attendanceTitle')}
        subtitle={t('hr.attendanceSubtitle')}
        action={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" aria-label={t('common.export')} onClick={handleExport}>
              {t('common.export')}
            </Button>
            {tab === 'attendance' ? (
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" onClick={openClock}>
                  {t('hr.clockInOut')}
                </Button>
                <Button onClick={() => openAttendance()}>{t('hr.newAttendance')}</Button>
              </div>
            ) : (
              <Button onClick={() => openLeave()}>{t('hr.newLeave')}</Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex gap-1">
        <button
          type="button"
          className={tab === 'attendance' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('attendance')}
        >
          {t('hr.attendanceTab')}
        </button>
        <button type="button" className={tab === 'leaves' ? 'tab tab-active' : 'tab'} onClick={() => setTab('leaves')}>
          {t('hr.leavesTab')}
        </button>
      </div>

      {tab === 'attendance' ? (
        <>
          {attError ? <ErrorBanner message={attError} /> : null}
          <form className="mb-4 flex gap-2.5" onSubmit={(event) => void submitAttFilters(event)}>
            <Select
              value={attFilterInput.employeeId}
              onChange={(event) => setAttFilterInput((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">{t('hr.allEmployees')}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeName(employee)}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={attFilterInput.from}
              onChange={(event) => setAttFilterInput((current) => ({ ...current, from: event.target.value }))}
            />
            <Input
              type="date"
              value={attFilterInput.to}
              onChange={(event) => setAttFilterInput((current) => ({ ...current, to: event.target.value }))}
            />
            <StatusSelect
              value={attFilterInput.status}
              onChange={(value) => setAttFilterInput((current) => ({ ...current, status: value }))}
              ariaLabel={t('common.status')}
              options={[
                { value: '', label: t('hr.allStatuses') },
                ...attendanceStatuses.map((status) => ({ value: status, label: status })),
              ]}
            />
            <Button type="submit">{t('common.search')}</Button>
          </form>
          {attLoading && !attData ? <TableSkeleton columns={attendanceColumns.length} /> : null}
          {attData ? (
            <>
              {attData.data.length === 0 ? (
                <EmptyState
                  message={t('hr.noAttendanceRecords')}
                  icon={<CalendarCheck className="size-6" />}
                  action={<Button onClick={() => openAttendance()}>{t('hr.newAttendance')}</Button>}
                />
              ) : (
                <DataTable columns={attendanceColumns} rows={attData.data} rowKey={(row) => row.id} />
              )}
              <Pagination
                page={attData.meta.page}
                limit={attData.meta.limit}
                total={attData.meta.total}
                onPage={setAttPage}
                onLimit={handleAttLimitChange}
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          {leaveError ? <ErrorBanner message={leaveError} /> : null}
          <form className="mb-4 flex gap-2.5" onSubmit={(event) => void submitLeaveFilters(event)}>
            <Select
              value={leaveFilterInput.employeeId}
              onChange={(event) => setLeaveFilterInput((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">{t('hr.allEmployees')}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeName(employee)}
                </option>
              ))}
            </Select>
            <StatusSelect
              value={leaveFilterInput.status}
              onChange={(value) => setLeaveFilterInput((current) => ({ ...current, status: value }))}
              ariaLabel={t('common.status')}
              options={[
                { value: '', label: t('hr.allStatuses') },
                ...leaveStatuses.map((status) => ({ value: status, label: status })),
              ]}
            />
            <Select
              value={leaveFilterInput.leaveType}
              onChange={(event) => setLeaveFilterInput((current) => ({ ...current, leaveType: event.target.value }))}
            >
              <option value="">{t('hr.allTypes')}</option>
              {leaveTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Button type="submit">{t('common.search')}</Button>
          </form>
          {leaveLoading && !leaveData ? <TableSkeleton columns={leaveColumns.length} /> : null}
          {leaveData ? (
            <>
              {leaveData.data.length === 0 ? (
                <EmptyState
                  message={t('hr.noLeaves')}
                  icon={<CalendarOff className="size-6" />}
                  action={<Button onClick={() => openLeave()}>{t('hr.newLeave')}</Button>}
                />
              ) : (
                <DataTable columns={leaveColumns} rows={leaveData.data} rowKey={(row) => row.id} />
              )}
              <Pagination
                page={leaveData.meta.page}
                limit={leaveData.meta.limit}
                total={leaveData.meta.total}
                onPage={setLeavePage}
                onLimit={handleLeaveLimitChange}
              />
            </>
          ) : null}
        </>
      )}

      <Dialog open={clockOpen} onOpenChange={(open) => !clockBusy && setClockOpen(open)}>
        <DialogContent>
          <DialogHeader title={t('hr.clockInOut')} />
          <form onSubmit={(event) => void submitClock(event)}>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="clock-employee">
                {t('fields.employee')}
                <span className="text-danger"> *</span>
              </label>
              <Controller
                control={controlClock}
                name="employeeId"
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={employeeOptions}
                    placeholder={t('hr.selectEmployee')}
                    ariaLabel={t('fields.employee')}
                  />
                )}
              />
              {clockErrors.employeeId ? (
                <div className="text-[12px] font-normal text-danger">{clockErrors.employeeId.message}</div>
              ) : null}
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="clock-action">
                {t('hr.action')}
                <span className="text-danger"> *</span>
              </label>
              <Select className="w-full" id="clock-action" {...registerClock('action')}>
                <option value="in">{t('hr.clockIn')}</option>
                <option value="out">{t('hr.clockOut')}</option>
              </Select>
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="clock-at">{t('hr.at')}</label>
              <Input className="w-full" id="clock-at" type="datetime-local" {...registerClock('at')} />
            </div>
            {clockError ? (
              <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
                {clockError}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={clockBusy} loading={clockBusy}>
                {clockBusy ? t('hr.recording') : t('hr.record')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={attOpen} onOpenChange={(open) => !attSaving && setAttOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingAttId ? t('hr.editAttendance') : t('hr.createAttendance')} />
          <form onSubmit={(event) => void submitAttendance(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="att-employee">
                  {t('fields.employee')}
                  <span className="text-danger"> *</span>
                </label>
                <Controller
                  control={controlAtt}
                  name="employeeId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={employeeOptions}
                      placeholder={t('hr.selectEmployee')}
                      ariaLabel={t('fields.employee')}
                    />
                  )}
                />
                {attErrors.employeeId ? (
                  <div className="text-[12px] font-normal text-danger">{attErrors.employeeId.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="att-date">
                  {t('fields.workDate')}
                  <span className="text-danger"> *</span>
                </label>
                <Input className="w-full" id="att-date" type="date" {...registerAtt('workDate')} />
                {attErrors.workDate ? (
                  <div className="text-[12px] font-normal text-danger">{attErrors.workDate.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="att-in">{t('hr.clockIn')}</label>
                <Input className="w-full" id="att-in" type="datetime-local" {...registerAtt('clockInAt')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="att-out">{t('hr.clockOut')}</label>
                <Input className="w-full" id="att-out" type="datetime-local" {...registerAtt('clockOutAt')} />
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="att-status">{t('common.status')}</label>
                <Select className="w-full" id="att-status" {...registerAtt('status')}>
                  {attendanceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="att-notes">{t('fields.notes')}</label>
              <Textarea className="w-full" id="att-notes" rows={2} {...registerAtt('notes')} />
            </div>
            {attFormError ? (
              <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
                {attFormError}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={attSaving} loading={attSaving}>
                {attSaving ? t('common.saving') : editingAttId ? t('common.saveChanges') : t('hr.createAttendance')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={(open) => !leaveSaving && setLeaveOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingLeaveId ? t('hr.editLeave') : t('hr.createLeave')} />
          <form onSubmit={(event) => void submitLeave(event)}>
            <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="leave-employee">
                  {t('fields.employee')}
                  <span className="text-danger"> *</span>
                </label>
                <Controller
                  control={controlLeave}
                  name="employeeId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={employeeOptions}
                      placeholder={t('hr.selectEmployee')}
                      ariaLabel={t('fields.employee')}
                    />
                  )}
                />
                {leaveErrors.employeeId ? (
                  <div className="text-[12px] font-normal text-danger">{leaveErrors.employeeId.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="leave-type">
                  {t('tables.type')}
                  <span className="text-danger"> *</span>
                </label>
                <Select className="w-full" id="leave-type" {...registerLeave('leaveType')}>
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="leave-start">
                  {t('fields.startDate')}
                  <span className="text-danger"> *</span>
                </label>
                <Input className="w-full" id="leave-start" type="date" {...registerLeave('startDate')} />
                {leaveErrors.startDate ? (
                  <div className="text-[12px] font-normal text-danger">{leaveErrors.startDate.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="leave-end">
                  {t('fields.endDate')}
                  <span className="text-danger"> *</span>
                </label>
                <Input className="w-full" id="leave-end" type="date" {...registerLeave('endDate')} />
                {leaveErrors.endDate ? (
                  <div className="text-[12px] font-normal text-danger">{leaveErrors.endDate.message}</div>
                ) : null}
              </div>
              <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                <label htmlFor="leave-days">{t('fields.days')}</label>
                <Input className="w-full" id="leave-days" type="number" min="1" max="365" {...registerLeave('days')} />
                {leaveErrors.days ? (
                  <div className="text-[12px] font-normal text-danger">{leaveErrors.days.message}</div>
                ) : null}
              </div>
            </div>
            <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
              <label htmlFor="leave-reason">{t('fields.reason')}</label>
              <Textarea className="w-full" id="leave-reason" rows={2} {...registerLeave('reason')} />
            </div>
            {leaveFormError ? (
              <div className="mb-4 rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
                {leaveFormError}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={leaveSaving} loading={leaveSaving}>
                {leaveSaving ? t('common.saving') : editingLeaveId ? t('common.saveChanges') : t('hr.createLeave')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingAtt !== null}
        onOpenChange={(open) => !deleteBusy && !open && setDeletingAtt(null)}
        title={t('hr.deleteAttendanceTitle')}
        description={t('hr.deleteAttendanceMessage', {
          name: deletingAtt ? employeeName(deletingAtt.employee) : '',
        })}
        confirmLabel={t('common.delete')}
        busy={deleteBusy}
        onConfirm={() => void confirmDeleteAtt()}
      />

      <ConfirmDialog
        open={deletingLeave !== null}
        onOpenChange={(open) => !open && setDeletingLeave(null)}
        title={t('hr.deleteLeaveTitle')}
        description={t('hr.deleteLeaveMessage', { type: deletingLeave?.leaveType })}
        confirmLabel={t('common.delete')}
        onConfirm={() => void confirmDeleteLeave()}
      />
    </>
  );
}
