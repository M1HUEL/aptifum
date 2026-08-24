import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { RefreshSession } from '@aptifum/database';

import { ConfigService } from '../src/config/config.module.js';
import { SessionCleanupService } from '../src/modules/auth/session-cleanup.service.js';

describe('SessionCleanupService', () => {
  it('deletes revoked/expired sessions older than the retention window', async () => {
    const sessionsRepo = {
      find: vi.fn(async () => [{ id: 's1' }, { id: 's2' }, { id: 's3' }]),
      delete: vi.fn(async () => ({ affected: 3 })),
    };
    const config = { env: { SESSION_RETENTION_DAYS: 30 } };
    const service = new SessionCleanupService(
      sessionsRepo as unknown as Repository<RefreshSession>,
      config as unknown as ConfigService,
    );

    await service.purgeExpired();

    expect(sessionsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [{ revokedAt: expect.anything() }, { expiresAt: expect.anything() }],
        take: 5000,
        select: { id: true },
      }),
    );
    expect(sessionsRepo.delete).toHaveBeenCalledWith(['s1', 's2', 's3']);
  });

  it('skips deletion when there is nothing to purge', async () => {
    const sessionsRepo = {
      find: vi.fn(async () => []),
      delete: vi.fn(async () => ({ affected: 0 })),
    };
    const config = { env: { SESSION_RETENTION_DAYS: 30 } };
    const service = new SessionCleanupService(
      sessionsRepo as unknown as Repository<RefreshSession>,
      config as unknown as ConfigService,
    );

    await service.purgeExpired();

    expect(sessionsRepo.delete).not.toHaveBeenCalled();
  });
});
