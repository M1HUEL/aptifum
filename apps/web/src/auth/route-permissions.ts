export interface RouteGuard {
  to: string;
  labelKey: string;
  permission?: string;
}

export const ROUTE_GUARDS: RouteGuard[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', permission: 'reporting:read' },
  { to: '/pos', labelKey: 'nav.pos', permission: 'invoicing:read' },
  { to: '/products', labelKey: 'nav.products', permission: 'inventory:read' },
  { to: '/stock', labelKey: 'nav.stock', permission: 'inventory:read' },
  { to: '/warehouses', labelKey: 'nav.warehouses', permission: 'inventory:read' },
  { to: '/invoices', labelKey: 'nav.invoices', permission: 'invoicing:read' },
  { to: '/customers', labelKey: 'nav.customers', permission: 'sales:read' },
  { to: '/orders', labelKey: 'nav.salesOrders', permission: 'sales:read' },
  { to: '/purchasing', labelKey: 'nav.purchasing', permission: 'purchasing:read' },
  { to: '/suppliers', labelKey: 'nav.suppliers', permission: 'purchasing:read' },
  { to: '/accounting', labelKey: 'nav.accounting', permission: 'accounting:read' },
  { to: '/accounts', labelKey: 'nav.chartOfAccounts', permission: 'accounting:read' },
  { to: '/hr', labelKey: 'nav.hr', permission: 'hr:read' },
  { to: '/attendance', labelKey: 'nav.attendance', permission: 'hr:read' },
  { to: '/crm', labelKey: 'nav.crm', permission: 'crm:read' },
  { to: '/production', labelKey: 'nav.production', permission: 'production:read' },
  { to: '/reports', labelKey: 'nav.reports', permission: 'reporting:read' },
  { to: '/users-roles', labelKey: 'nav.usersRoles', permission: 'users:read' },
  { to: '/audit', labelKey: 'nav.audit', permission: 'audit:read' },
  { to: '/settings', labelKey: 'nav.settings', permission: 'tax:read' },
  { to: '/profile', labelKey: 'nav.profile' },
];

export function permissionForRoute(pathname: string): string | undefined {
  return ROUTE_GUARDS.find((guard) => guard.to === pathname)?.permission;
}
