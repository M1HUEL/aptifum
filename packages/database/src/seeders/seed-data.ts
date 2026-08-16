import {
  AccountNormalBalance,
  AccountType,
  ALL_PERMISSIONS,
  DocumentSeriesKind,
  ModuleName,
  PermissionAction,
  RoleName,
  TaxKind,
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
    p(ModuleName.TAX, 'read'),
    p(ModuleName.TAX, 'write'),
  ],
  [RoleName.SELLER]: [
    p(ModuleName.SALES, 'read'),
    p(ModuleName.SALES, 'write'),
    p(ModuleName.INVOICING, 'read'),
    p(ModuleName.INVOICING, 'write'),
    p(ModuleName.INVENTORY, 'read'),
    p(ModuleName.CRM, 'read'),
    p(ModuleName.CRM, 'write'),
    p(ModuleName.TAX, 'read'),
  ],
  [RoleName.WAREHOUSE]: [
    p(ModuleName.INVENTORY, 'read'),
    p(ModuleName.INVENTORY, 'write'),
    p(ModuleName.INVENTORY, 'adjust'),
    p(ModuleName.PURCHASING, 'read'),
    p(ModuleName.PURCHASING, 'write'),
    p(ModuleName.PRODUCTION, 'read'),
    p(ModuleName.PRODUCTION, 'write'),
  ],
  [RoleName.HR]: [p(ModuleName.HR, 'read'), p(ModuleName.HR, 'write'), p(ModuleName.HR, 'approve')],
};

export const DEFAULT_SERIES: Record<DocumentSeriesKind, string> = {
  [DocumentSeriesKind.QUOTE]: 'QT',
  [DocumentSeriesKind.ORDER]: 'ORD',
  [DocumentSeriesKind.INVOICE]: 'INV',
  [DocumentSeriesKind.CREDIT_NOTE]: 'NC',
  [DocumentSeriesKind.PURCHASE_ORDER]: 'PO',
  [DocumentSeriesKind.GOODS_RECEIPT]: 'GR',
  [DocumentSeriesKind.SUPPLIER_BILL]: 'SB',
  [DocumentSeriesKind.JOURNAL_ENTRY]: 'JE',
  [DocumentSeriesKind.LEAD]: 'LD',
  [DocumentSeriesKind.PAYROLL]: 'PR',
  [DocumentSeriesKind.PRODUCTION_ORDER]: 'MO',
};

export const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: AccountType;
  normalBalance: AccountNormalBalance;
}> = [
  { code: '1000', name: 'Cash and banks', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '1100', name: 'Accounts receivable', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '1200', name: 'Inventory', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '2000', name: 'Accounts payable', type: AccountType.LIABILITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '2001', name: 'Payroll payable', type: AccountType.LIABILITY, normalBalance: AccountNormalBalance.CREDIT },
  {
    code: '2002',
    name: 'Withholdings and deductions payable',
    type: AccountType.LIABILITY,
    normalBalance: AccountNormalBalance.CREDIT,
  },
  { code: '2100', name: 'Sales tax payable', type: AccountType.LIABILITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '3000', name: 'Retained earnings', type: AccountType.EQUITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '4000', name: 'Sales revenue', type: AccountType.REVENUE, normalBalance: AccountNormalBalance.CREDIT },
  { code: '4100', name: 'Sales returns', type: AccountType.REVENUE, normalBalance: AccountNormalBalance.DEBIT },
  {
    code: '4200',
    name: 'Foreign exchange gain',
    type: AccountType.REVENUE,
    normalBalance: AccountNormalBalance.CREDIT,
  },
  { code: '5000', name: 'Cost of goods sold', type: AccountType.EXPENSE, normalBalance: AccountNormalBalance.DEBIT },
  { code: '6000', name: 'Payroll expense', type: AccountType.EXPENSE, normalBalance: AccountNormalBalance.DEBIT },
  { code: '6100', name: 'Foreign exchange loss', type: AccountType.EXPENSE, normalBalance: AccountNormalBalance.DEBIT },
];

export const DEFAULT_TAX_PRESETS: Record<string, Array<{ name: string; rate: number; kind: TaxKind }>> = {
  US: [{ name: 'Sales Tax', rate: 0.08, kind: TaxKind.SALES }],
  MX: [{ name: 'IVA', rate: 0.16, kind: TaxKind.SALES }],
};

export const DEFAULT_US_SALES_TAX_CONFIG = {
  nexusStates: ['CA', 'TX'],
  rates: {},
} as const;

export const WALK_IN_CUSTOMER = {
  code: 'WALK-IN',
  tradeName: 'Walk-in Customer',
  currency: 'USD',
} as const;

export const DEFAULT_TENANT_ID = '00000000-0000-4000-8000-000000000001';
export const ADMIN_EMAIL = 'admin@aptifum.dev';
export const ADMIN_PASSWORD = 'Admin123!';
