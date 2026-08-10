import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Customer } from '@aptifum/database';
import { OpportunitiesService } from '../src/modules/crm/opportunities.service';

const TENANT = '00000000-0000-4000-8000-000000000001';

function buildService(
  extras: {
    oppRepo?: Record<string, unknown>;
    customersRepo?: Record<string, unknown>;
    leadsRepo?: Record<string, unknown>;
  } = {},
) {
  const oppRepo = {
    save: vi.fn((o: unknown) => Promise.resolve(o)),
    create: vi.fn((o: unknown) => o),
    ...(extras.oppRepo ?? {}),
  };
  const customerRepo = {
    save: vi.fn((c: Record<string, unknown>) => Promise.resolve({ id: 'cust-1', ...c })),
    create: vi.fn((c: Record<string, unknown>) => c),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === Customer) {
        return customerRepo;
      }
      return oppRepo;
    }),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(manager)),
  };
  const service = new OpportunitiesService(
    oppRepo as never,
    (extras.customersRepo ?? {}) as never,
    (extras.leadsRepo ?? {}) as never,
    dataSource as never,
  );
  return { service, manager, oppRepo, customerRepo };
}

describe('OpportunitiesService markWon', () => {
  it('creates a customer from the linked lead when the opportunity has no customer', async () => {
    const opp = {
      id: 'o1',
      tenantId: TENANT,
      stage: 'proposal',
      customerId: null,
      lead: { number: 'LD-000123', companyName: 'Acme Co', contactName: 'Ann', currency: 'USD' },
    };
    const oppRepo = {
      findOne: vi.fn().mockResolvedValue(opp),
    };
    const { service, customerRepo } = buildService({ oppRepo });
    const result = await service.markWon(TENANT, 'o1');
    expect(customerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CUST-000123', tradeName: 'Acme Co' }),
    );
    expect(result).toMatchObject({ stage: 'won', probability: 100, customerId: 'cust-1' });
  });

  it('does not create a customer when the opportunity already has one', async () => {
    const opp = {
      id: 'o1',
      tenantId: TENANT,
      stage: 'negotiation',
      customerId: 'cust-existing',
      lead: null,
      customer: { id: 'cust-existing' },
    };
    const oppRepo = { findOne: vi.fn().mockResolvedValue(opp) };
    const { service, customerRepo } = buildService({ oppRepo });
    const result = await service.markWon(TENANT, 'o1');
    expect(customerRepo.save).not.toHaveBeenCalled();
    expect(result).toMatchObject({ stage: 'won', customerId: 'cust-existing' });
  });

  it('rejects reopening a lost opportunity as won', async () => {
    const service = new OpportunitiesService(
      {
        findOne: vi.fn().mockResolvedValue({ id: 'o1', stage: 'lost' }),
      } as never,
      {} as never,
      {} as never,
      { transaction: vi.fn() } as never,
    );
    await expect(service.markWon(TENANT, 'o1')).rejects.toThrow(BadRequestException);
  });
});
