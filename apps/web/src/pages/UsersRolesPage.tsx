import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { Paginated, Role, User } from '../api/types';
import {
  Badge,
  type Column,
  DataTable,
  EmptyState,
  ErrorBanner,
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
  TextArea,
  TextInput,
} from '../components/forms';
import { useToast } from '../components/toast';

const PERMISSION_MODULES = [
  'auth',
  'users',
  'rbac',
  'tenants',
  'inventory',
  'sales',
  'invoicing',
  'purchasing',
  'accounting',
  'hr',
  'crm',
  'production',
  'reporting',
  'audit',
];

const PERMISSION_ACTIONS = ['read', 'write', 'approve', 'adjust', 'delete'] as const;
const ALL_PERMISSIONS = '*';

interface UserForm {
  email: string;
  name: string;
  password: string;
  active: boolean;
  roleIds: string[];
}

const emptyUser: UserForm = { email: '', name: '', password: '', active: true, roleIds: [] };

interface RoleForm {
  name: string;
  description: string;
  permissions: string[];
}

const emptyRole: RoleForm = { name: '', description: '', permissions: [] };

export function UsersRolesPage() {
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const toast = useToast();

  const [userPage, setUserPage] = useState(1);
  const [userData, setUserData] = useState<Paginated<User> | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const [userOpen, setUserOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUser);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userSaving, setUserSaving] = useState(false);

  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRole);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [roleDeleteBusy, setRoleDeleteBusy] = useState(false);

  const loadUsers = async (page: number) => {
    setUserLoading(true);
    setUserError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      setUserData(
        await apiFetch<Paginated<User>>(`/api/v1/users?${params.toString()}`),
      );
    } catch (err) {
      setUserError(err instanceof ApiError ? err.message : 'Could not load users.');
    } finally {
      setUserLoading(false);
    }
  };

  const loadRoles = async () => {
    setRolesLoading(true);
    setRolesError(null);
    try {
      setRoles(await apiFetch<Role[]>('/api/v1/roles'));
    } catch (err) {
      setRolesError(err instanceof ApiError ? err.message : 'Could not load roles.');
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers(userPage);
  }, [userPage]);

  useEffect(() => {
    void loadRoles();
  }, []);

  const openCreateUser = () => {
    setEditingUserId(null);
    setUserForm(emptyUser);
    setUserFormError(null);
    setUserOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({
      email: user.email,
      name: user.name ?? '',
      password: '',
      active: user.active,
      roleIds: user.roles.map((role) => role.id),
    });
    setUserFormError(null);
    setUserOpen(true);
  };

  const toggleUserRole = (roleId: string) => {
    setUserForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((id) => id !== roleId)
        : [...current.roleIds, roleId],
    }));
  };

  const submitUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!userForm.email.trim()) {
      setUserFormError('Email is required.');
      return;
    }
    if (!editingUserId && userForm.password.length < 8) {
      setUserFormError('Password must be at least 8 characters.');
      return;
    }
    setUserSaving(true);
    setUserFormError(null);
    try {
      if (editingUserId) {
        await apiFetch(`/api/v1/users/${editingUserId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userForm.name.trim() || undefined,
            active: userForm.active,
            roleIds: userForm.roleIds,
            ...(userForm.password ? { password: userForm.password } : {}),
          }),
        });
        toast.toast('User updated.');
      } else {
        await apiFetch('/api/v1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userForm.email.trim(),
            password: userForm.password,
            name: userForm.name.trim() || undefined,
            active: userForm.active,
            roleIds: userForm.roleIds,
          }),
        });
        toast.toast('User created.');
      }
      setUserOpen(false);
      void loadUsers(userPage);
    } catch (err) {
      setUserFormError(err instanceof ApiError ? err.message : 'Could not save user.');
    } finally {
      setUserSaving(false);
    }
  };

  const openCreateRole = () => {
    setEditingRoleId(null);
    setRoleForm(emptyRole);
    setRoleFormError(null);
    setRoleOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions,
    });
    setRoleFormError(null);
    setRoleOpen(true);
  };

  const togglePermission = (permission: string) => {
    setRoleForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((p) => p !== permission)
        : [...current.permissions, permission],
    }));
  };

  const submitRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!roleForm.name.trim()) {
      setRoleFormError('Name is required.');
      return;
    }
    setRoleSaving(true);
    setRoleFormError(null);
    const payload = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim() || undefined,
      permissions: roleForm.permissions,
    };
    try {
      if (editingRoleId) {
        await apiFetch(`/api/v1/roles/${editingRoleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.toast('Role updated.');
      } else {
        await apiFetch('/api/v1/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.toast('Role created.');
      }
      setRoleOpen(false);
      void loadRoles();
    } catch (err) {
      setRoleFormError(err instanceof ApiError ? err.message : 'Could not save role.');
    } finally {
      setRoleSaving(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;
    setRoleDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/roles/${deletingRole.id}`, { method: 'DELETE' });
      toast.toast('Role deleted.');
      setDeletingRole(null);
      void loadRoles();
    } catch (err) {
      toast.toast(err instanceof ApiError ? err.message : 'Could not delete role.', 'error');
      setDeletingRole(null);
    } finally {
      setRoleDeleteBusy(false);
    }
  };

  const userColumns: Column<User>[] = [
    { key: 'email', header: 'Email' },
    { key: 'name', header: 'Name', render: (row) => row.name ?? '—' },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) =>
        row.roles.length === 0 ? (
          <span className="muted">None</span>
        ) : (
          <div className="badge-group">
            {row.roles.map((role) => (
              <Badge key={role.id} tone={role.isSystem ? 'info' : 'success'}>
                {role.name}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>
          {row.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openEditUser(row)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  const roleColumns: Column<Role>[] = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (row) => {
        if (row.permissions.length === 0) return <span className="muted">None</span>;
        if (row.permissions.includes(ALL_PERMISSIONS)) {
          return <Badge tone="info">All permissions (*)</Badge>;
        }
        return <span className="muted">{row.permissions.join(', ')}</span>;
      },
    },
    {
      key: 'isSystem',
      header: 'Type',
      render: (row) => (
        <Badge tone={row.isSystem ? 'info' : 'success'}>
          {row.isSystem ? 'System' : 'Custom'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" onClick={() => openEditRole(row)}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={row.isSystem}
            onClick={() => setDeletingRole(row)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const rolePermissionRows = PERMISSION_MODULES.map((module) => (
    <div key={module} className="permission-group">
      <div className="permission-module">{module}</div>
      <div className="permission-checks">
        {PERMISSION_ACTIONS.map((action) => {
          const value = `${module}:${action}`;
          return (
            <Checkbox
              key={value}
              label={action}
              checked={roleForm.permissions.includes(value)}
              onChange={() => togglePermission(value)}
            />
          );
        })}
      </div>
    </div>
  ));

  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle="Manage users and roles"
        action={
          tab === 'users' ? (
            <Button onClick={openCreateUser}>New user</Button>
          ) : (
            <Button onClick={openCreateRole}>New role</Button>
          )
        }
      />

      <div className="tabs">
        <button type="button" className={tab === 'users' ? 'tab tab-active' : 'tab'} onClick={() => setTab('users')}>
          Users
        </button>
        <button type="button" className={tab === 'roles' ? 'tab tab-active' : 'tab'} onClick={() => setTab('roles')}>
          Roles
        </button>
      </div>

      {tab === 'users' ? (
        <>
          {userError ? <ErrorBanner message={userError} /> : null}
          {userLoading && !userData ? <LoadingBlock /> : null}
          {userData ? (
            <>
              {userData.data.length === 0 ? (
                <EmptyState message="No users." />
              ) : (
                <DataTable columns={userColumns} rows={userData.data} rowKey={(row) => row.id} />
              )}
              <Pagination
                page={userData.meta.page}
                limit={userData.meta.limit}
                total={userData.meta.total}
                onPage={setUserPage}
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          {rolesError ? <ErrorBanner message={rolesError} /> : null}
          {rolesLoading && roles.length === 0 ? <LoadingBlock /> : null}
          {!rolesLoading && roles.length === 0 && !rolesError ? (
            <EmptyState message="No roles." />
          ) : (
            <DataTable columns={roleColumns} rows={roles} rowKey={(row) => row.id} />
          )}
        </>
      )}

      <Modal
        open={userOpen}
        title={editingUserId ? 'Edit user' : 'New user'}
        onClose={() => !userSaving && setUserOpen(false)}
        width="lg"
      >
        <form onSubmit={(event) => void submitUser(event)}>
          <div className="form-grid">
            <Field label="Email" htmlFor="usr-email" required>
              <TextInput
                id="usr-email"
                type="email"
                disabled={editingUserId !== null}
                value={userForm.email}
                onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
              />
            </Field>
            <Field label="Name" htmlFor="usr-name">
              <TextInput
                id="usr-name"
                value={userForm.name}
                onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label={editingUserId ? 'New password (optional)' : 'Password'} htmlFor="usr-password" required={!editingUserId}>
              <TextInput
                id="usr-password"
                type="password"
                placeholder={editingUserId ? 'Leave blank to keep' : ''}
                value={userForm.password}
                onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
              />
            </Field>
            <Field label="Status">
              <Checkbox
                label="Active"
                checked={userForm.active}
                onChange={(event) => setUserForm((current) => ({ ...current, active: event.target.checked }))}
              />
            </Field>
            <Field label="Roles" htmlFor="usr-roles">
              {roles.length === 0 ? (
                <div className="muted">No roles available.</div>
              ) : (
                <div className="permission-checks">
                  {roles.map((role) => (
                    <Checkbox
                      key={role.id}
                      label={role.name}
                      checked={userForm.roleIds.includes(role.id)}
                      onChange={() => toggleUserRole(role.id)}
                    />
                  ))}
                </div>
              )}
            </Field>
          </div>
          {userFormError ? <div className="error-banner">{userFormError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setUserOpen(false)} disabled={userSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={userSaving}>
              {userSaving ? 'Saving…' : editingUserId ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={roleOpen}
        title={editingRoleId ? 'Edit role' : 'New role'}
        onClose={() => !roleSaving && setRoleOpen(false)}
        width="lg"
      >
        <form onSubmit={(event) => void submitRole(event)}>
          <div className="form-grid">
            <Field label="Name" htmlFor="role-name" required>
              <TextInput
                id="role-name"
                value={roleForm.name}
                onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label="Description" htmlFor="role-description">
              <TextArea
                id="role-description"
                rows={2}
                value={roleForm.description}
                onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
              />
            </Field>
            <Field label="Permissions">
              <Checkbox
                label="All permissions (*)"
                checked={roleForm.permissions.includes(ALL_PERMISSIONS)}
                onChange={(event) => {
                  if (event.target.checked) {
                    setRoleForm((current) => ({ ...current, permissions: [ALL_PERMISSIONS] }));
                  } else {
                    setRoleForm((current) => ({
                      ...current,
                      permissions: current.permissions.filter((p) => p !== ALL_PERMISSIONS),
                    }));
                  }
                }}
              />
              {rolePermissionRows}
            </Field>
          </div>
          {roleFormError ? <div className="error-banner">{roleFormError}</div> : null}
          <div className="modal-footer">
            <Button variant="ghost" onClick={() => setRoleOpen(false)} disabled={roleSaving}>
              Cancel
            </Button>
            <button type="submit" className="btn btn-primary" disabled={roleSaving}>
              {roleSaving ? 'Saving…' : editingRoleId ? 'Save changes' : 'Create role'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingRole !== null}
        title="Delete role"
        message={`Delete role "${deletingRole?.name}"?`}
        confirmLabel="Delete"
        busy={roleDeleteBusy}
        onCancel={() => setDeletingRole(null)}
        onConfirm={() => void confirmDeleteRole()}
      />
    </>
  );
}
