import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { In } from 'typeorm';
import { UserProfile } from '@aptifum/core';
import { User } from '@aptifum/database';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { ConfigService } from '../src/config/config.module';

function buildAuthService() {
  const usersService = {
    findByEmailWithPassword: vi.fn<(email: string) => Promise<User | null>>(),
    getProfile: vi.fn<(id: string) => Promise<UserProfile>>(),
    updateName: vi.fn<(id: string, name: string) => Promise<UserProfile>>(),
    changePassword: vi.fn<(id: string, current: string, next: string) => Promise<void>>(),
  };
  const jwtService = {
    signAsync: vi.fn(async () => 'signed-token'),
    verifyAsync: vi.fn(),
  };
  const config = {
    env: {
      JWT_ACCESS_SECRET: 'a'.repeat(16),
      JWT_REFRESH_SECRET: 'b'.repeat(16),
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
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

  const service = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
    config as unknown as ConfigService,
    auditService as never,
    sessionsRepo as never,
  );

  return { service, usersService, jwtService, sessionsRepo, auditService };
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
});
