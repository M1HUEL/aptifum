import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { UserProfile } from '@aptifum/core';
import { User } from '@aptifum/database';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { ConfigService } from '../src/config/config.module';

function buildAuthService() {
  const usersService = {
    findByEmailWithPassword: vi.fn<(email: string) => Promise<User | null>>(),
    getProfile: vi.fn<(id: string) => Promise<UserProfile>>(),
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
    },
  };

  const service = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
    config as unknown as ConfigService,
  );

  return { service, usersService, jwtService };
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
});
