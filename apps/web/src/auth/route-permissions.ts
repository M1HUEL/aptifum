export interface RouteGuard {
  to: string;
  label: string;
  permission?: string;
}

export const ROUTE_GUARDS: RouteGuard[] = [
  { to: '/dashboard', label: 'Dashboard', permission: 'reporting:read' },
  { to: '/pos', label: 'POS', permission: 'invoicing:read' },
  { to: '/products', label: 'Products', permission: 'inventory:read' },
  { to: '/stock', label: 'Stock', permission: 'inventory:read' },
  { to: '/warehouses', label: 'Warehouses', permission: 'inventory:read' },
  { to: '/invoices', label: 'Invoices', permission: 'invoicing:read' },
  { to: '/customers', label: 'Customers', permission: 'sales:read' },
  { to: '/orders', label: 'Sales orders', permission: 'sales:read' },
  { to: '/purchasing', label: 'Purchasing', permission: 'purchasing:read' },
  { to: '/suppliers', label: 'Suppliers', permission: 'purchasing:read' },
  { to: '/accounting', label: 'Accounting', permission: 'accounting:read' },
  { to: '/accounts', label: 'Chart of accounts', permission: 'accounting:read' },
  { to: '/hr', label: 'HR', permission: 'hr:read' },
  { to: '/attendance', label: 'Attendance', permission: 'hr:read' },
  { to: '/crm', label: 'CRM', permission: 'crm:read' },
  { to: '/production', label: 'Production', permission: 'production:read' },
  { to: '/reports', label: 'Reports', permission: 'reporting:read' },
  { to: '/users-roles', label: 'Users & roles', permission: 'users:read' },
  { to: '/audit', label: 'Audit', permission: 'audit:read' },
  { to: '/settings', label: 'Settings', permission: 'tax:read' },
  { to: '/profile', label: 'My profile' },
];

export function permissionForRoute(pathname: string): string | undefined {
  return ROUTE_GUARDS.find((guard) => guard.to === pathname)?.permission;
}
