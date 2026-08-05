import {
  ALL_PERMISSIONS,
  DocumentSeriesKind,
  ModuleName,
  PermissionAction,
  RoleName,
} from '@aptifum/core';

const p = (module: ModuleName, action: PermissionAction): string => `${module}:${action}`;

export const DEFAULT_ROLES: Record<RoleName, string[]> = {
  [RoleName.ADMIN]: [ALL_PERMISSIONS],
  [RoleName.ACCOUNTANT]: [
    p(ModuleName.SALES, 'read'),
    p(ModuleName.INVOICING, 'read'),
    p(ModuleName.PURCHASING, 'read'),
    p(ModuleName.ACCOUNTING, 'read'),
    p(ModuleName.ACCOUNTING, 'write'),
    p(ModuleName.REPORTING, 'read'),
  ],
  [RoleName.SELLER]: [
    p(ModuleName.SALES, 'read'),
    p(ModuleName.SALES, 'write'),
    p(ModuleName.INVOICING, 'read'),
    p(ModuleName.INVOICING, 'write'),
    p(ModuleName.INVENTORY, 'read'),
    p(ModuleName.CRM, 'read'),
    p(ModuleName.CRM, 'write'),
  ],
  [RoleName.WAREHOUSE]: [
    p(ModuleName.INVENTORY, 'read'),
    p(ModuleName.INVENTORY, 'write'),
    p(ModuleName.INVENTORY, 'adjust'),
    p(ModuleName.PURCHASING, 'read'),
    p(ModuleName.PURCHASING, 'write'),
  ],
  [RoleName.HR]: [p(ModuleName.HR, 'read'), p(ModuleName.HR, 'write')],
};

export const DEFAULT_SERIES: Record<DocumentSeriesKind, string> = {
  [DocumentSeriesKind.QUOTE]: 'QT',
  [DocumentSeriesKind.ORDER]: 'ORD',
  [DocumentSeriesKind.INVOICE]: 'INV',
  [DocumentSeriesKind.CREDIT_NOTE]: 'NC',
  [DocumentSeriesKind.PURCHASE_ORDER]: 'PO',
  [DocumentSeriesKind.GOODS_RECEIPT]: 'GR',
};

export const DEFAULT_TENANT_ID = '00000000-0000-4000-8000-000000000001';
export const ADMIN_EMAIL = 'admin@aptifum.dev';
export const ADMIN_PASSWORD = 'Admin123!';
