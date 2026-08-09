import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge, ErrorBanner, PageHeader } from '../components/ui';
import { Button, Field, TextInput } from '../components/forms';
import { useToast } from '../components/toast';

interface ProfileForm {
  name: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<ProfileForm>({
    name: user?.name ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const passwordChange = Boolean(form.newPassword);
    if (passwordChange && form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (passwordChange && form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          ...(passwordChange
            ? { currentPassword: form.currentPassword, newPassword: form.newPassword }
            : {}),
        }),
      });
      await refreshProfile();
      setForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      toast.toast('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Manage your account information" />

      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <Field label="Email" htmlFor="profile-email">
            <TextInput id="profile-email" type="email" value={user.email} disabled />
          </Field>
          <Field label="Name" htmlFor="profile-name">
            <TextInput
              id="profile-name"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
            />
          </Field>
          <Field label="Roles">
            <div className="badge-group">
              {user.roles.length === 0 ? (
                <span className="muted">None</span>
              ) : (
                user.roles.map((role) => (
                  <Badge key={role.name} tone="info">
                    {role.name}
                  </Badge>
                ))
              )}
            </div>
          </Field>
        </div>

        <h3 className="muted" style={{ marginTop: '1.5rem' }}>
          Change password
        </h3>
        <div className="form-grid" style={{ marginTop: '0.5rem' }}>
          <Field label="Current password" htmlFor="profile-current">
            <TextInput
              id="profile-current"
              type="password"
              value={form.currentPassword}
              onChange={(event) => setField('currentPassword', event.target.value)}
            />
          </Field>
          <Field label="New password" htmlFor="profile-new">
            <TextInput
              id="profile-new"
              type="password"
              placeholder="At least 8 characters"
              value={form.newPassword}
              onChange={(event) => setField('newPassword', event.target.value)}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="profile-confirm">
            <TextInput
              id="profile-confirm"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setField('confirmPassword', event.target.value)}
            />
          </Field>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <div style={{ marginTop: '1rem' }}>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </>
  );
}
