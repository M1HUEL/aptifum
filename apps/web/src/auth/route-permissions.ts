export interface RouteGuard {
  to: string;
  labelKey: string;
  permission?: string;
  group?: string;
}

export interface NavGroup {
  key: string;
  labelKey: string;
}

export const NAV_GROUPS: NavGroup[] = [
  { key: 'overview', labelKey: 'nav.groups.overview' },
  { key: 'sales', labelKey: 'nav.groups.sales' },
  { key: 'purchasing', labelKey: 'nav.groups.purchasing' },
  { key: 'inventory', labelKey: 'nav.groups.inventory' },
  { key: 'finance', labelKey: 'nav.groups.finance' },
  { key: 'crm', labelKey: 'nav.groups.crm' },
  { key: 'hr', labelKey: 'nav.groups.hr' },
  { key: 'production', labelKey: 'nav.groups.production' },
  { key: 'system', labelKey: 'nav.groups.system' },
];

export const ROUTE_GUARDS: RouteGuard[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', permission: 'reporting:read', group: 'overview' },
  { to: '/profile', labelKey: 'nav.profile', group: 'overview' },
  { to: '/pos', labelKey: 'nav.pos', permission: 'invoicing:read', group: 'sales' },
  { to: '/invoices', labelKey: 'nav.invoices', permission: 'invoicing:read', group: 'sales' },
  { to: '/customers', labelKey: 'nav.customers', permission: 'sales:read', group: 'sales' },
  { to: '/orders', labelKey: 'nav.salesOrders', permission: 'sales:read', group: 'sales' },
  { to: '/purchasing', labelKey: 'nav.purchasing', permission: 'purchasing:read', group: 'purchasing' },
  { to: '/purchasing/reorder', labelKey: 'nav.reorder', permission: 'purchasing:read', group: 'purchasing' },
  { to: '/suppliers', labelKey: 'nav.suppliers', permission: 'purchasing:read', group: 'purchasing' },
  { to: '/products', labelKey: 'nav.products', permission: 'inventory:read', group: 'inventory' },
  { to: '/stock', labelKey: 'nav.stock', permission: 'inventory:read', group: 'inventory' },
  { to: '/warehouses', labelKey: 'nav.warehouses', permission: 'inventory:read', group: 'inventory' },
  { to: '/accounting', labelKey: 'nav.accounting', permission: 'accounting:read', group: 'finance' },
  { to: '/accounts', labelKey: 'nav.chartOfAccounts', permission: 'accounting:read', group: 'finance' },
  { to: '/crm', labelKey: 'nav.crm', permission: 'crm:read', group: 'crm' },
  { to: '/hr', labelKey: 'nav.hr', permission: 'hr:read', group: 'hr' },
  { to: '/attendance', labelKey: 'nav.attendance', permission: 'hr:read', group: 'hr' },
  { to: '/production', labelKey: 'nav.production', permission: 'production:read', group: 'production' },
  { to: '/reports', labelKey: 'nav.reports', permission: 'reporting:read', group: 'system' },
  { to: '/users-roles', labelKey: 'nav.usersRoles', permission: 'users:read', group: 'system' },
  { to: '/audit', labelKey: 'nav.audit', permission: 'audit:read', group: 'system' },
  { to: '/settings', labelKey: 'nav.settings', permission: 'tax:read', group: 'system' },
];

export function permissionForRoute(pathname: string): string | undefined {
  return ROUTE_GUARDS.find((guard) => guard.to === pathname)?.permission;
}
