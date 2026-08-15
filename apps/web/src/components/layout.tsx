import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, usePermission } from '../auth/auth-context';
import { NAV_GROUPS, ROUTE_GUARDS } from '../auth/route-permissions';
import { useTheme } from '../lib/theme';
import { useLanguage } from '../lib/language';

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const can = usePermission();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleItems = ROUTE_GUARDS.filter((item) => !item.permission || can(item.permission));

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 z-50 flex h-screen w-[220px] shrink-0 flex-col bg-sidebar text-sidebar-text transition-transform duration-200 max-[900px]:fixed max-[900px]:left-0 max-[900px]:top-0 max-[900px]:z-50 max-[900px]:-translate-x-full print:hidden${sidebarOpen ? ' max-[900px]:translate-x-0' : ''}`}
      >
        <div className="px-5 pb-4 pt-5 text-lg font-bold text-white">Aptifum</div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2 pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-[3px] [&::-webkit-scrollbar-thumb]:bg-white/20">
          {NAV_GROUPS.map((group) => {
            const groupItems = visibleItems.filter((item) => item.group === group.key);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="px-[14px] pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-text opacity-55">{t(group.labelKey)}</div>
                {groupItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block rounded-ui px-[14px] py-[9px] font-medium text-sidebar-text no-underline${isActive ? ' bg-primary text-white hover:bg-primary' : ' hover:bg-white/10 hover:text-white'}`
                    }
                    onClick={closeSidebar}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="flex shrink-0 flex-col gap-2.5 border-t border-white/10 p-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-ui border border-white/20 bg-transparent px-[14px] py-2 text-sm font-semibold text-sidebar-text select-none hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
            <button
              type="button"
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-ui border border-white/20 bg-transparent px-[14px] py-2 text-sm font-semibold text-sidebar-text select-none hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={toggleLanguage}
              aria-label={t('layout.toggleLanguage')}
            >
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              <span>{language.toUpperCase()}</span>
            </button>
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">{user?.name || user?.email}</div>
            <div className="text-[12px] text-sidebar-text">
              {user?.roles.map((role) => role.name).join(', ')}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-white/20 bg-transparent px-[14px] py-2 text-sm font-semibold text-sidebar-text select-none hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void logout()}
          >
            {t('layout.signOut')}
          </button>
        </div>
      </aside>
      {sidebarOpen ? <div className="hidden max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-40 max-[900px]:block max-[900px]:bg-black/40" onClick={closeSidebar} /> : null}
      <main className="max-w-[1100px] flex-1 px-8 py-7 max-[900px]:px-4 max-[900px]:py-5 print:max-w-full print:p-0">
        <button
          type="button"
          className="hidden cursor-pointer items-center justify-center rounded-ui border border-border bg-surface px-[14px] py-2 font-semibold text-text select-none hover:bg-hover max-[900px]:fixed max-[900px]:left-3 max-[900px]:top-3 max-[900px]:z-50 max-[900px]:inline-flex print:hidden"
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
