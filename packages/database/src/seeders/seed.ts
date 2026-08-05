import { DocumentSeriesKind, RoleName } from '@aptifum/core';
import * as bcrypt from 'bcryptjs';
import { createDataSource, DataSourceOverrides } from '../data-source';
import { DocumentSeries } from '../entities/document-series.entity';
import { Role } from '../entities/role.entity';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEFAULT_ROLES,
  DEFAULT_SERIES,
  DEFAULT_TENANT_ID,
} from './seed-data';

export async function seed(overrides: DataSourceOverrides = {}): Promise<void> {
  const ds = createDataSource(overrides);
  await ds.initialize();
  try {
    const tenantRepo = ds.getRepository(Tenant);
    const roleRepo = ds.getRepository(Role);
    const userRepo = ds.getRepository(User);
    const seriesRepo = ds.getRepository(DocumentSeries);

    let tenant = await tenantRepo.findOneBy({ id: DEFAULT_TENANT_ID });
    if (!tenant) {
      tenant = await tenantRepo.save(
        tenantRepo.create({ id: DEFAULT_TENANT_ID, name: 'Aptifum Demo', defaultCurrency: 'USD' }),
      );
    }

    const roles: Role[] = [];
    for (const name of Object.values(RoleName)) {
      let role = await roleRepo.findOneBy({ name });
      if (!role) {
        role = await roleRepo.save(
          roleRepo.create({ name, permissions: DEFAULT_ROLES[name], isSystem: true }),
        );
      } else {
        role.permissions = DEFAULT_ROLES[name];
        await roleRepo.save(role);
      }
      roles.push(role);
    }
    const adminRole = roles.find((role) => role.name === RoleName.ADMIN);
    if (!adminRole) {
      throw new Error('Admin role was not created');
    }

    for (const [kind, prefix] of Object.entries(DEFAULT_SERIES) as [
      DocumentSeriesKind,
      string,
    ][]) {
      const existing = await seriesRepo.findOneBy({
        tenantId: tenant.id,
        kind,
      });
      if (!existing) {
        await seriesRepo.save(
          seriesRepo.create({
            tenantId: tenant.id,
            kind,
            prefix,
            nextNumber: 1,
            active: true,
          }),
        );
      }
    }

    const existing = await userRepo.findOneBy({ email: ADMIN_EMAIL });
    if (!existing) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await userRepo.save(
        userRepo.create({
          email: ADMIN_EMAIL,
          passwordHash,
          name: 'System Admin',
          active: true,
          defaultTenantId: tenant.id,
          tenants: [tenant],
          roles: [adminRole],
        }),
      );
    }

    console.log(`Seeded tenant: ${tenant.name} (${tenant.id})`);
    console.log(`Seeded roles: ${roles.map((role) => role.name).join(', ')}`);
    console.log(`Seeded admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } finally {
    await ds.destroy();
  }
}

if (require.main === module) {
  seed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
