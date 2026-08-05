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
  PURCHASE_ORDER = 'purchase_order',
  GOODS_RECEIPT = 'goods_receipt',
  JOURNAL_ENTRY = 'journal_entry',
  LEAD = 'lead',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export enum AccountNormalBalance {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum AccountingPeriodStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  REVERSED = 'reversed',
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  DISQUALIFIED = 'disqualified',
  CONVERTED = 'converted',
}

export enum OpportunityStage {
  PROSPECTING = 'prospecting',
  QUALIFICATION = 'qualification',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

export enum ActivityType {
  CALL = 'call',
  MEETING = 'meeting',
  TASK = 'task',
  NOTE = 'note',
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const today = (): string => new Date().toISOString().slice(0, 10);

export interface TotalsItem {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export function computeTotals(items: TotalsItem[], globalDiscount = 0) {
  const subtotal = round2(
    items.reduce((sum, i) => sum + (i.quantity * i.unitPrice - (i.discount ?? 0)), 0),
  );
  const tax = round2(
    items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.taxRate ?? 0), 0),
  );
  return {
    subtotal,
    discount: round2(globalDiscount),
    tax,
    total: round2(subtotal + tax - globalDiscount),
  };
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
