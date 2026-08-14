import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, usePermission } from '../auth/auth-context';
import { ROUTE_GUARDS } from '../auth/route-permissions';

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const can = usePermission();
  const visibleItems = ROUTE_GUARDS.filter((item) => !item.permission || can(item.permission));

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
              {t(item.labelKey)}
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
            {t('layout.signOut')}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
