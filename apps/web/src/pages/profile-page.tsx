import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '../api/schema';
import { profileFormSchema, type ProfileFormValues } from '../api/schemas';
import { useApiMutation } from '../api/hooks';
import { useAuth } from '../auth/auth-context';
import { Badge, ErrorBanner, PageHeader , Input } from '../components/ui';
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
  const { t } = useTranslation();
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
        toast.toast(t('profile.updated'));
      },
    });
  });

  return (
    <>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <form onSubmit={(event) => void submit(event)}>
        <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1">
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="profile-email">{t('fields.email')}</label>
            <Input
              id="profile-email"
              type="email"
              value={user.email}
              disabled
              className="w-full"
            />
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="profile-name">{t('fields.name')}</label>
            <Input
              id="profile-name"
              {...register('name')}
              className="w-full"
            />
            {errors.name ? <div className="text-[12px] font-normal text-danger">{errors.name.message}</div> : null}
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label>{t('usersRoles.roles')}</label>
            <div className="flex flex-wrap gap-1">
              {user.roles.length === 0 ? (
                <span className="text-[12px] text-muted">{t('common.none')}</span>
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

        <h3 className="text-[12px] text-muted" style={{ marginTop: '1.5rem' }}>
          {t('profile.changePassword')}
        </h3>
        <div className="grid grid-cols-2 gap-x-4 max-[480px]:grid-cols-1" style={{ marginTop: '0.5rem' }}>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="profile-current">{t('fields.currentPassword')}</label>
            <Input
              id="profile-current"
              type="password"
              {...register('currentPassword')}
              className="w-full"
            />
            {errors.currentPassword ? (
              <div className="text-[12px] font-normal text-danger">{errors.currentPassword.message}</div>
            ) : null}
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="profile-new">{t('fields.newPassword')}</label>
            <Input
              id="profile-new"
              type="password"
              placeholder={t('profile.passwordHint')}
              {...register('newPassword')}
              className="w-full"
            />
            {errors.newPassword ? <div className="text-[12px] font-normal text-danger">{errors.newPassword.message}</div> : null}
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="profile-confirm">{t('fields.confirmPassword')}</label>
            <Input
              id="profile-confirm"
              type="password"
              {...register('confirmPassword')}
              className="w-full"
            />
            {errors.confirmPassword ? (
              <div className="text-[12px] font-normal text-danger">{errors.confirmPassword.message}</div>
            ) : null}
          </div>
        </div>

        {updateMutation.isError ? <ErrorBanner message={updateMutation.error.message} /> : null}

        <div style={{ marginTop: '1rem' }}>
          <Button type="submit" disabled={saving} loading={saving}>
            {saving ? t('common.saving') : t('common.saveChanges')}
          </Button>
        </div>
      </form>
    </>
  );
}
