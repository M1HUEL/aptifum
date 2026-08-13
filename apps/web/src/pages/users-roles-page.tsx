import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, ApiError } from '../api/client';
import type { components } from '../api/schema';
import type { Paginated, Role, User } from '../api/types';
import {
  roleFormSchema,
  userFormSchema,
  type RoleFormValues,
  type UserFormValues,
} from '../api/schemas';
import { useApiMutation, useApiMutationVoid } from '../api/hooks';
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
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '../components/ui/dialog';
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

type CreateUserDto = components['schemas']['CreateUserDto'];
type UpdateUserDto = components['schemas']['UpdateUserDto'];
type InviteUserDto = components['schemas']['InviteUserDto'];
type CreateRoleDto = components['schemas']['CreateRoleDto'];

const emptyUser: UserFormValues = {
  email: '',
  name: '',
  password: '',
  active: true,
  roleIds: [],
  invite: false,
};

const emptyRole: RoleFormValues = { name: '', description: '', permissions: [] };

function fromUser(user: User): UserFormValues {
  return {
    email: user.email,
    name: user.name ?? '',
    password: '',
    active: user.active,
    roleIds: user.roles.map((role) => role.id),
    invite: false,
  };
}

function userToUpdateDto(form: UserFormValues): UpdateUserDto {
  return {
    name: form.name.trim() || undefined,
    active: form.active,
    roleIds: form.roleIds,
    ...(form.password ? { password: form.password } : {}),
  };
}

function userToCreateDto(form: UserFormValues): CreateUserDto {
  return {
    email: form.email.trim(),
    password: form.password,
    name: form.name.trim() || undefined,
    active: form.active,
    roleIds: form.roleIds,
  };
}

function userToInviteDto(form: UserFormValues): InviteUserDto {
  return {
    email: form.email.trim(),
    name: form.name.trim() || undefined,
    roleIds: form.roleIds,
  };
}

function fromRole(role: Role): RoleFormValues {
  return { name: role.name, description: role.description ?? '', permissions: role.permissions };
}

function roleToDto(form: RoleFormValues): CreateRoleDto {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    permissions: form.permissions,
  };
}

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
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);

  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: emptyUser,
  });
  const {
    register: registerUser,
    handleSubmit: submitUserForm,
    reset: resetUser,
    setValue: setUserValue,
    watch: watchUser,
    formState: { errors: userErrors },
  } = userForm;

  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: emptyRole,
  });
  const {
    register: registerRole,
    handleSubmit: submitRoleForm,
    reset: resetRole,
    setValue: setRoleValue,
    watch: watchRole,
    formState: { errors: roleErrors },
  } = roleForm;

  const userInvite = watchUser('invite');
  const userActive = watchUser('active');
  const userRoleIds = watchUser('roleIds');
  const rolePermissions = watchRole('permissions');

  const loadUsers = async (page: number) => {
    setUserLoading(true);
    setUserError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      setUserData(await apiFetch<Paginated<User>>(`/api/v1/users?${params.toString()}`));
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

  const createUserMutation = useApiMutation<CreateUserDto>('/api/v1/users', 'POST');
  const updateUserMutation = useApiMutation<UpdateUserDto>(`/api/v1/users/${editingUserId ?? ''}`, 'PATCH');
  const inviteMutation = useApiMutation<InviteUserDto, { user: User; inviteToken: string | null }>(
    '/api/v1/auth/invite',
    'POST',
  );

  const createRoleMutation = useApiMutation<CreateRoleDto>('/api/v1/roles', 'POST');
  const updateRoleMutation = useApiMutation<CreateRoleDto>(`/api/v1/roles/${editingRoleId ?? ''}`, 'PATCH');
  const deleteRoleMutation = useApiMutationVoid(`/api/v1/roles/${deletingRole?.id ?? ''}`, 'DELETE');

  const userSaving =
    createUserMutation.isPending || updateUserMutation.isPending || inviteMutation.isPending;
  const roleSaving = createRoleMutation.isPending || updateRoleMutation.isPending;
  const roleDeleteBusy = deleteRoleMutation.isPending;

  const openCreateUser = () => {
    setEditingUserId(null);
    resetUser(emptyUser);
    setUserFormError(null);
    setInviteLink(null);
    setUserOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUserId(user.id);
    resetUser(fromUser(user));
    setUserFormError(null);
    setUserOpen(true);
  };

  const toggleUserRole = (roleId: string) => {
    setUserValue(
      'roleIds',
      userRoleIds.includes(roleId)
        ? userRoleIds.filter((id) => id !== roleId)
        : [...userRoleIds, roleId],
    );
  };

  const submitUser = submitUserForm((values) => {
    if (!editingUserId && !values.invite && values.password.length < 8) {
      setUserFormError('Password must be at least 8 characters.');
      return;
    }
    setUserFormError(null);
    if (editingUserId) {
      updateUserMutation.mutate(userToUpdateDto(values), {
        onSuccess: () => {
          toast.toast('User updated.');
          setUserOpen(false);
          void loadUsers(userPage);
        },
        onError: (err) => setUserFormError(err.message),
      });
      return;
    }
    if (values.invite) {
      inviteMutation.mutate(userToInviteDto(values), {
        onSuccess: (result) => {
          if (result.inviteToken) {
            setInviteLink(
              `${window.location.origin}/accept-invite?token=${encodeURIComponent(result.inviteToken)}`,
            );
          } else {
            setInviteEmailSent(true);
          }
          setUserOpen(false);
          void loadUsers(userPage);
        },
        onError: (err) => setUserFormError(err.message),
      });
      return;
    }
    createUserMutation.mutate(userToCreateDto(values), {
      onSuccess: () => {
        toast.toast('User created.');
        setUserOpen(false);
        void loadUsers(userPage);
      },
      onError: (err) => setUserFormError(err.message),
    });
  });

  const openCreateRole = () => {
    setEditingRoleId(null);
    resetRole(emptyRole);
    setRoleFormError(null);
    setRoleOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    resetRole(fromRole(role));
    setRoleFormError(null);
    setRoleOpen(true);
  };

  const togglePermission = (permission: string) => {
    setRoleValue(
      'permissions',
      rolePermissions.includes(permission)
        ? rolePermissions.filter((p) => p !== permission)
        : [...rolePermissions, permission],
    );
  };

  const submitRole = submitRoleForm((values) => {
    setRoleFormError(null);
    const onSuccess = () => {
      toast.toast(editingRoleId ? 'Role updated.' : 'Role created.');
      setRoleOpen(false);
      void loadRoles();
    };
    const onError = (err: { message: string }) => setRoleFormError(err.message);
    if (editingRoleId) {
      updateRoleMutation.mutate(roleToDto(values), { onSuccess, onError });
    } else {
      createRoleMutation.mutate(roleToDto(values), { onSuccess, onError });
    }
  });

  const confirmDeleteRole = () => {
    if (!deletingRole) return;
    deleteRoleMutation.mutate(undefined, {
      onSuccess: () => {
        toast.toast('Role deleted.');
        setDeletingRole(null);
        void loadRoles();
      },
      onError: (err) => {
        toast.toast(err.message, 'error');
        setDeletingRole(null);
      },
    });
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
            <div key={value} className="flex items-center gap-1.5">
              <Checkbox id={value} checked={rolePermissions.includes(value)} onCheckedChange={() => togglePermission(value)} />
              <label htmlFor={value} className="text-sm text-gray-700">
                {action}
              </label>
            </div>
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

      <Dialog open={userOpen} onOpenChange={(open) => !userSaving && setUserOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingUserId ? 'Edit user' : 'New user'} />
          <form onSubmit={(event) => void submitUser(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="usr-email">Email *</label>
                <input
                  id="usr-email"
                  type="email"
                  disabled={editingUserId !== null}
                  {...registerUser('email')}
                />
                {userErrors.email ? <div className="field-error">{userErrors.email.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="usr-name">Name</label>
                <input id="usr-name" {...registerUser('name')} />
              </div>
              {!editingUserId ? (
                <div className="field">
                  <label>Invitation</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Checkbox
                      id="usr-invite"
                      checked={userInvite}
                      onCheckedChange={(checked) => setUserValue('invite', checked === true)}
                    />
                    <label htmlFor="usr-invite" className="text-sm text-gray-700">
                      Invite by email (no password)
                    </label>
                  </div>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="usr-password">
                  {editingUserId ? 'New password (optional)' : 'Password'}
                  {!editingUserId && !userInvite ? ' *' : ''}
                </label>
                <input
                  id="usr-password"
                  type="password"
                  placeholder={editingUserId ? 'Leave blank to keep' : userInvite ? 'Set by invite' : ''}
                  disabled={userInvite}
                  {...registerUser('password')}
                />
                {userErrors.password ? (
                  <div className="field-error">{userErrors.password.message}</div>
                ) : null}
              </div>
              <div className="field">
                <label>Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="usr-active"
                    checked={userActive}
                    onCheckedChange={(checked) => setUserValue('active', checked === true)}
                  />
                  <label htmlFor="usr-active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
              <div className="field">
                <label>Roles</label>
                {roles.length === 0 ? (
                  <div className="muted">No roles available.</div>
                ) : (
                  <div className="permission-checks">
                    {roles.map((role) => (
                      <div key={role.id} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`usr-role-${role.id}`}
                          checked={userRoleIds.includes(role.id)}
                          onCheckedChange={() => toggleUserRole(role.id)}
                        />
                        <label htmlFor={`usr-role-${role.id}`} className="text-sm text-gray-700">
                          {role.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {userFormError ? <div className="error-banner">{userFormError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={userSaving}>
                {userSaving ? 'Saving…' : editingUserId ? 'Save changes' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteLink !== null || inviteEmailSent}
        onOpenChange={(open) => {
          if (!open) {
            setInviteLink(null);
            setInviteEmailSent(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader title="Invitation sent" />
          {inviteEmailSent ? (
            <div className="success-banner">
              An invitation email was sent to {watchUser('email').trim() || 'the user'}.
            </div>
          ) : (
            <>
              <div className="success-banner">
                Demo mode has no email server, so share the invite link below with{' '}
                {watchUser('email') || 'the user'}:
              </div>
              <input readOnly value={inviteLink ?? ''} />
            </>
          )}
          <div className="modal-footer">
            <Button
              variant="ghost"
              onClick={() => {
                setInviteLink(null);
                setInviteEmailSent(false);
              }}
            >
              Close
            </Button>
            {inviteLink ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (inviteLink) {
                    void navigator.clipboard?.writeText(inviteLink);
                    toast.toast('Invite link copied.');
                  }
                }}
              >
                Copy link
              </button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={(open) => !roleSaving && setRoleOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title={editingRoleId ? 'Edit role' : 'New role'} />
          <form onSubmit={(event) => void submitRole(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="role-name">Name *</label>
                <input id="role-name" {...registerRole('name')} />
                {roleErrors.name ? <div className="field-error">{roleErrors.name.message}</div> : null}
              </div>
              <div className="field">
                <label htmlFor="role-description">Description</label>
                <textarea id="role-description" rows={2} {...registerRole('description')} />
              </div>
              <div className="field">
                <label>Permissions</label>
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id="role-permissions-all"
                    checked={rolePermissions.includes(ALL_PERMISSIONS)}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        setRoleValue('permissions', [ALL_PERMISSIONS]);
                      } else {
                        setRoleValue('permissions', rolePermissions.filter((p) => p !== ALL_PERMISSIONS));
                      }
                    }}
                  />
                  <label htmlFor="role-permissions-all" className="text-sm text-gray-700">
                    All permissions (*)
                  </label>
                </div>
                {rolePermissionRows}
              </div>
            </div>
            {roleFormError ? <div className="error-banner">{roleFormError}</div> : null}
            <DialogFooter>
              <Button variant="default" type="submit" disabled={roleSaving}>
                {roleSaving ? 'Saving…' : editingRoleId ? 'Save changes' : 'Create role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingRole !== null}
        onOpenChange={(open) => !roleDeleteBusy && !open && setDeletingRole(null)}
      >
        <DialogContent>
          <DialogHeader title="Delete role" description={`Delete role "${deletingRole?.name}"?`} />
          <DialogFooter>
            <Button variant="danger" type="button" disabled={roleDeleteBusy} onClick={() => void confirmDeleteRole()}>
              {roleDeleteBusy ? 'Working…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
