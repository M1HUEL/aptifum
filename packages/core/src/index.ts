export enum ModuleName {
  AUTH = 'auth',
  USERS = 'users',
  RBAC = 'rbac',
  TENANTS = 'tenants',
  INVENTORY = 'inventory',
  SALES = 'sales',
  INVOICING = 'invoicing',
  PURCHASING = 'purchasing',
  ACCOUNTING = 'accounting',
  HR = 'hr',
  CRM = 'crm',
  PRODUCTION = 'production',
  REPORTING = 'reporting',
  AUDIT = 'audit',
}

export type PermissionAction = 'read' | 'write' | 'approve' | 'adjust' | 'delete';

export const ALL_PERMISSIONS = '*';

export const permission = (module: ModuleName, action: PermissionAction): string =>
  `${module}:${action}`;

export type Permission = string;

export enum RoleName {
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  SELLER = 'seller',
  WAREHOUSE = 'warehouse',
  HR = 'hr',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
}

export enum MovementType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
  RETURN = 'return',
  DISPOSAL = 'disposal',
}

export enum SalesOrderKind {
  QUOTE = 'quote',
  ORDER = 'order',
}

export enum SalesOrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  INVOICED = 'invoiced',
  CANCELLED = 'cancelled',
}

export enum InvoiceType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  OTHER = 'other',
}

export enum TaxKind {
  SALES = 'sales',
  PURCHASE = 'purchase',
}

export enum DocumentSeriesKind {
  QUOTE = 'quote',
  ORDER = 'order',
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
}

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
}

export interface RoleWithPermissions {
  name: string;
  permissions: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  tenantId: string | null;
  roles: RoleWithPermissions[];
}
