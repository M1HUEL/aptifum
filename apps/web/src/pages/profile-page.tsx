import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../api/schema';
import { profileFormSchema, type ProfileFormValues } from '../api/schemas';
import { useApiMutation } from '../api/hooks';
import { useAuth } from '../auth/auth-context';
import { Badge, ErrorBanner, PageHeader } from '../components/ui';
import { Button } from '../components/ui/button';
import { useToast } from '../components/toast';

type UpdateProfileDto = components['schemas']['UpdateProfileDto'];

const emptyForm: ProfileFormValues = {
  name: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function toDto(values: ProfileFormValues): UpdateProfileDto {
  return {
    name: values.name.trim() || undefined,
    ...(values.newPassword
      ? { currentPassword: values.currentPassword, newPassword: values.newPassword }
      : {}),
  };
}

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: emptyForm,
  });

  const updateMutation = useApiMutation<UpdateProfileDto>('/api/v1/auth/me', 'PATCH');
  const saving = updateMutation.isPending;

  useEffect(() => {
    if (user) {
      reset({ ...emptyForm, name: user.name ?? '' });
    }
  }, [user, reset]);

  if (!user) {
    return null;
  }

  const submit = handleSubmit((values) => {
    updateMutation.mutate(toDto(values), {
      onSuccess: async () => {
        await refreshProfile();
        reset({ ...emptyForm, name: values.name.trim() });
        toast.toast('Profile updated.');
      },
    });
  });

  return (
    <>
      <PageHeader title="My profile" subtitle="Manage your account information" />

      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="profile-email">Email</label>
            <input id="profile-email" type="email" value={user.email} disabled />
          </div>
          <div className="field">
            <label htmlFor="profile-name">Name</label>
            <input id="profile-name" {...register('name')} />
            {errors.name ? <div className="field-error">{errors.name.message}</div> : null}
          </div>
          <div className="field">
            <label>Roles</label>
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
          </div>
        </div>

        <h3 className="muted" style={{ marginTop: '1.5rem' }}>
          Change password
        </h3>
        <div className="form-grid" style={{ marginTop: '0.5rem' }}>
          <div className="field">
            <label htmlFor="profile-current">Current password</label>
            <input id="profile-current" type="password" {...register('currentPassword')} />
            {errors.currentPassword ? (
              <div className="field-error">{errors.currentPassword.message}</div>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="profile-new">New password</label>
            <input
              id="profile-new"
              type="password"
              placeholder="At least 8 characters"
              {...register('newPassword')}
            />
            {errors.newPassword ? <div className="field-error">{errors.newPassword.message}</div> : null}
          </div>
          <div className="field">
            <label htmlFor="profile-confirm">Confirm new password</label>
            <input id="profile-confirm" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword ? (
              <div className="field-error">{errors.confirmPassword.message}</div>
            ) : null}
          </div>
        </div>

        {updateMutation.isError ? <ErrorBanner message={updateMutation.error.message} /> : null}

        <div style={{ marginTop: '1rem' }}>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </>
  );
}
