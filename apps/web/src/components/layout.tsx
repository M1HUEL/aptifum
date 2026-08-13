import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, usePermission } from '../auth/auth-context';

const NAV_ITEMS: Array<{ to: string; label: string; permission?: string }> = [
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

export function Layout() {
  const { user, logout } = useAuth();
  const can = usePermission();
  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Aptifum</div>
        <nav className="sidebar-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user?.name || user?.email}</div>
            <div className="sidebar-user-role">
              {user?.roles.map((role) => role.name).join(', ')}
            </div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
