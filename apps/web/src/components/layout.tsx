import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, usePermission } from '../auth/auth-context';
import { NAV_GROUPS, ROUTE_GUARDS } from '../auth/route-permissions';
import { useTheme } from '../lib/theme';

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const can = usePermission();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleItems = ROUTE_GUARDS.filter((item) => !item.permission || can(item.permission));

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">Aptifum</div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const groupItems = visibleItems.filter((item) => item.group === group.key);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="sidebar-group-label">{t(group.labelKey)}</div>
                {groupItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={closeSidebar}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label={t('layout.toggleTheme')}
          >
            {theme === 'dark' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
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
      {sidebarOpen ? <div className="sidebar-overlay" onClick={closeSidebar} /> : null}
      <main className="main-content">
        <button
          type="button"
          className="btn sidebar-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={t('layout.toggleSidebar')}
          aria-expanded={sidebarOpen}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Outlet />
      </main>
    </div>
  );
}
