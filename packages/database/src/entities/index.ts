import { AuditLog } from './audit-log.entity';
import { Role } from './role.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

export const entities = [User, Role, Tenant, AuditLog];

export { AuditLog, Role, Tenant, User };
