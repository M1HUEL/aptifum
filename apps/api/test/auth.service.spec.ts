import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { In } from 'typeorm';
import { UserProfile } from '@aptifum/core';
import { User } from '@aptifum/database';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { ConfigService } from '../src/config/config.module';

function buildAuthService(
  jwtOverrides: Partial<{ signAsync: unknown; verifyAsync: unknown }> = {},
) {
  const usersService = {
    create: vi.fn<(input: Record<string, unknown>) => Promise<UserProfile>>(),
    findByEmailWithPassword: vi.fn<(email: string) => Promise<User | null>>(),
    findByEmail: vi.fn<(email: string) => Promise<User | null>>(),
    getProfile: vi.fn<(id: string) => Promise<UserProfile>>(),
    updateName: vi.fn<(id: string, name: string) => Promise<UserProfile>>(),
    changePassword: vi.fn<(id: string, current: string, next: string) => Promise<void>>(),
    setPassword: vi.fn<(id: string, next: string) => Promise<void>>(),
  };
  const jwtService = {
    signAsync: vi.fn(async () => 'signed-token'),
    verifyAsync: vi.fn(),
    ...jwtOverrides,
  };
  const config = {
    env: {
      JWT_ACCESS_SECRET: 'a'.repeat(16),
      JWT_REFRESH_SECRET: 'b'.repeat(16),
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
      PASSWORD_RESET_TTL: '15m',
      INVITE_TTL: '72h',
      APP_URL: 'http://localhost:5173',
      SMTP_HOST: '',
      SMTP_PORT: 587,
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM_EMAIL: 'no-reply@aptifum.dev',
      SMTP_FROM_NAME: 'Aptifum',
      MAX_ACTIVE_SESSIONS_PER_USER: 5,
      SESSION_RETENTION_DAYS: 30,
    },
  };
  const sessionsRepo = {
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (data: Record<string, unknown>) => ({
      ...data,
      id: 'session-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findOneBy: vi.fn(),
    find: vi.fn<(criteria: unknown) => Promise<Array<{ id: string }>>>(async () => []),
    update: vi.fn(),
    delete: vi.fn(async () => ({ affected: 0 })),
  };

  const auditService = {
    record: vi.fn(async () => undefined),
  };

  const emailService = {
    isConfigured: vi.fn(() => false),
    sendMail: vi.fn(async () => true),
  };

  const service = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
    config as unknown as ConfigService,
    auditService as never,
    emailService as never,
    sessionsRepo as never,
  );

  return { service, usersService, jwtService, sessionsRepo, auditService, emailService };
}

describe('AuthService', () => {
  it('rejects login with unknown email', async () => {
    const { service, usersService } = buildAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login({ email: 'ghost@aptifum.dev', password: 'password123' }),
    ).rejects.toThrow();
  });

  it('rejects login with wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-horse', 10);
    const { service, usersService } = buildAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      passwordHash: hash,
      active: true,
      defaultTenantId: null,
    } as User);

    await expect(
      service.login({ email: 'user@aptifum.dev', password: 'wrong-password' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('issues token pair on successful login', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-horse', 10);
    const { service, usersService, jwtService } = buildAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      passwordHash: hash,
      active: true,
      defaultTenantId: 't1',
    } as User);
    usersService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      name: null,
      active: true,
      tenantId: 't1',
      roles: [],
    });

    const result = await service.login({ email: 'user@aptifum.dev', password: 'correct-horse' });

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(result.user.email).toBe('user@aptifum.dev');
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
  });

  it('purgues expired sessions of the user on each new session', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-horse', 10);
    const { service, usersService, sessionsRepo } = buildAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      passwordHash: hash,
      active: true,
      defaultTenantId: 't1',
    } as User);
    usersService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      name: null,
      active: true,
      tenantId: 't1',
      roles: [],
    });

    await service.login({ email: 'user@aptifum.dev', password: 'correct-horse' });

    expect(sessionsRepo.delete).toHaveBeenCalledWith({ userId: 'u1', expiresAt: expect.anything() });
  });

  it('revokes the oldest sessions when the active session limit is exceeded', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-horse', 10);
    const { service, usersService, sessionsRepo } = buildAuthService();
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      passwordHash: hash,
      active: true,
      defaultTenantId: 't1',
    } as User);
    usersService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      name: null,
      active: true,
      tenantId: 't1',
      roles: [],
    });
    sessionsRepo.find.mockResolvedValue([
      { id: 's1' },
      { id: 's2' },
      { id: 's3' },
      { id: 's4' },
      { id: 's5' },
      { id: 's6' },
    ]);

    await service.login({ email: 'user@aptifum.dev', password: 'correct-horse' });

    expect(sessionsRepo.update).toHaveBeenCalledWith(
      { id: In(['s1']) },
      { revokedAt: expect.any(Date) },
    );
  });

  it('updates the profile name and records the change in the audit log', async () => {
    const { service, usersService, auditService } = buildAuthService();
    usersService.updateName.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      name: 'New Name',
      active: true,
      tenantId: 't1',
      roles: [],
    });
    usersService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      name: 'New Name',
      active: true,
      tenantId: 't1',
      roles: [],
    });

    const result = await service.updateProfile('u1', { name: 'New Name' });

    expect(usersService.updateName).toHaveBeenCalledWith('u1', 'New Name');
    expect(result.name).toBe('New Name');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        entity: 'profile',
        action: 'update',
        after: { name: 'New Name', passwordChanged: false },
      }),
    );
  });

  it('rejects a password change without the current password', async () => {
    const { service } = buildAuthService();

    await expect(
      service.updateProfile('u1', { newPassword: 'new-secret-pass' }),
    ).rejects.toThrow('Current password is required');
  });

  it('changes the password when the current password matches', async () => {
    const { service, usersService } = buildAuthService();
    usersService.changePassword.mockResolvedValue(undefined);
    usersService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      name: null,
      active: true,
      tenantId: 't1',
      roles: [],
    });

    await service.updateProfile('u1', {
      currentPassword: 'correct-horse',
      newPassword: 'new-secret-pass',
    });

    expect(usersService.changePassword).toHaveBeenCalledWith(
      'u1',
      'correct-horse',
      'new-secret-pass',
    );
  });

  it('returns a reset token for an existing user', async () => {
    const { service, usersService } = buildAuthService();
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      active: true,
      defaultTenantId: 't1',
    } as User);

    const result = await service.requestPasswordReset({ email: 'user@aptifum.dev' });

    expect(result.sent).toBe(true);
    expect(result.resetToken).toBe('signed-token');
  });

  it('does not reveal whether an email is registered', async () => {
    const { service, usersService } = buildAuthService();
    usersService.findByEmail.mockResolvedValue(null);

    const result = await service.requestPasswordReset({ email: 'ghost@aptifum.dev' });

    expect(result).toEqual({ sent: true, resetToken: null });
  });

  it('resets the password and revokes all active sessions', async () => {
    const { service, usersService, sessionsRepo, auditService } = buildAuthService({
      verifyAsync: vi.fn(async () => ({ sub: 'u1', type: 'password_reset', jti: 'reset-1' })),
    });
    usersService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@aptifum.dev',
      name: null,
      active: true,
      tenantId: 't1',
      roles: [],
    });
    usersService.setPassword.mockResolvedValue(undefined);

    const result = await service.resetPassword({
      token: 'valid-token',
      newPassword: 'new-secret-pass',
    });

    expect(result).toEqual({ success: true });
    expect(usersService.setPassword).toHaveBeenCalledWith('u1', 'new-secret-pass');
    expect(sessionsRepo.update).toHaveBeenCalledWith(
      { userId: 'u1', revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', entity: 'password-reset', action: 'update' }),
    );
  });

  it('rejects a reset token of the wrong type', async () => {
    const { service } = buildAuthService({
      verifyAsync: vi.fn(async () => ({ sub: 'u1', type: 'refresh', jti: 'x' })),
    });

    await expect(
      service.resetPassword({ token: 'bad-token', newPassword: 'new-secret-pass' }),
    ).rejects.toThrow('Invalid or expired token');
  });

  it('invites a user without a password and returns an invite token', async () => {
    const { service, usersService, jwtService, auditService } = buildAuthService();
    usersService.create.mockResolvedValue({
      id: 'u-invited',
      email: 'invited@aptifum.dev',
      name: null,
      active: true,
      tenantId: 't1',
      roles: [],
    } as UserProfile);

    const result = await service.inviteUser({ email: 'invited@aptifum.dev' });

    expect(result.inviteToken).toBe('signed-token');
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'invited@aptifum.dev' }),
    );
    expect(usersService.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ password: expect.anything() }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u-invited', type: 'invite' }),
      expect.objectContaining({ expiresIn: '72h' }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-invited', entity: 'user-invite', action: 'update' }),
    );
  });

  it('accepts an invite, sets the password and revokes active sessions', async () => {
    const { service, usersService, sessionsRepo } = buildAuthService({
      verifyAsync: vi.fn(async () => ({ sub: 'u1', type: 'invite', jti: 'invite-1' })),
    });
    usersService.getProfile.mockResolvedValue({
      id: 'u1',
      email: 'invited@aptifum.dev',
      name: null,
      active: true,
      tenantId: 't1',
      roles: [],
    });
    usersService.setPassword.mockResolvedValue(undefined);

    const result = await service.acceptInvite({
      token: 'valid-invite-token',
      newPassword: 'new-secret-pass',
    });

    expect(result).toEqual({ success: true });
    expect(usersService.setPassword).toHaveBeenCalledWith('u1', 'new-secret-pass');
    expect(sessionsRepo.update).toHaveBeenCalledWith(
      { userId: 'u1', revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });

  it('rejects an invite token of the wrong type', async () => {
    const { service } = buildAuthService({
      verifyAsync: vi.fn(async () => ({ sub: 'u1', type: 'password_reset', jti: 'x' })),
    });

    await expect(
      service.acceptInvite({ token: 'bad-token', newPassword: 'new-secret-pass' }),
    ).rejects.toThrow('Invalid or expired token');
  });
});
