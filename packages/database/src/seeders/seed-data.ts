import {
  AccountNormalBalance,
  AccountType,
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
  [DocumentSeriesKind.JOURNAL_ENTRY]: 'JE',
  [DocumentSeriesKind.LEAD]: 'LD',
};

export const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: AccountType;
  normalBalance: AccountNormalBalance;
}> = [
  { code: '1000', name: 'Caja y bancos', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '1100', name: 'Cuentas por cobrar', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '1200', name: 'Inventario', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '2000', name: 'Cuentas por pagar', type: AccountType.LIABILITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '2100', name: 'IVA ventas por pagar', type: AccountType.LIABILITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '3000', name: 'Utilidades acumuladas', type: AccountType.EQUITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '4000', name: 'Ingresos por ventas', type: AccountType.REVENUE, normalBalance: AccountNormalBalance.CREDIT },
  { code: '4100', name: 'Devoluciones sobre ventas', type: AccountType.REVENUE, normalBalance: AccountNormalBalance.DEBIT },
  { code: '5000', name: 'Costo de ventas', type: AccountType.EXPENSE, normalBalance: AccountNormalBalance.DEBIT },
];

export const DEFAULT_TENANT_ID = '00000000-0000-4000-8000-000000000001';
export const ADMIN_EMAIL = 'admin@aptifum.dev';
export const ADMIN_PASSWORD = 'Admin123!';
