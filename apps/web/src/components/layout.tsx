import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  FileText,
  Languages,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Truck,
  User,
  Users,
  Users2,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, usePermission } from '../auth/auth-context';
import { NAV_GROUPS, ROUTE_GUARDS } from '../auth/route-permissions';
import { useTheme } from '../lib/theme';
import { useLanguage } from '../lib/language';

const ROUTE_ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/profile': User,
  '/pos': ShoppingCart,
  '/invoices': FileText,
  '/customers': Users,
  '/orders': ClipboardList,
  '/purchasing': ShoppingBag,
  '/suppliers': Truck,
  '/products': Package,
  '/stock': Boxes,
  '/warehouses': Warehouse,
  '/accounting': FileSpreadsheet,
  '/accounts': ListOrdered,
  '/crm': Users2,
  '/hr': Briefcase,
  '/attendance': CalendarCheck,
  '/production': Factory,
  '/reports': BarChart3,
  '/users-roles': ShieldCheck,
  '/audit': ScrollText,
  '/settings': Settings,
};

function userInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
  }
  return email.slice(0, 2).toUpperCase();
}

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const can = usePermission();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('aptifum.sidebarCollapsed') === '1');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const effectiveCollapsed = collapsed && !isMobile;
  const visibleItems = ROUTE_GUARDS.filter((item) => !item.permission || can(item.permission));
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: visibleItems.filter((item) => item.group === group.key),
  })).filter((group) => group.items.length > 0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('aptifum.sidebarCollapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 z-50 flex h-screen ${effectiveCollapsed ? 'w-[64px]' : 'w-[220px]'} shrink-0 flex-col bg-sidebar text-sidebar-text transition-[width,transform] duration-200 max-[900px]:fixed max-[900px]:left-0 max-[900px]:top-0 max-[900px]:z-50 max-[900px]:-translate-x-full print:hidden${sidebarOpen ? ' max-[900px]:translate-x-0' : ''}`}
      >
        <div className={`flex items-center ${effectiveCollapsed ? 'flex-col gap-1 px-0 pt-5 pb-4' : 'justify-center gap-2.5 px-5 py-4'}`}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-ui bg-primary font-bold text-white">
            A
          </div>
          {!effectiveCollapsed ? <div className="min-w-0 truncate text-lg font-bold text-white">Aptifum</div> : null}
          <button
            type="button"
            className={`${effectiveCollapsed ? 'size-6' : 'size-8 border border-white/20'} flex shrink-0 cursor-pointer items-center justify-center rounded-ui text-sidebar-text transition-colors select-none hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 max-[900px]:hidden`}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
          >
            {effectiveCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2 pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-[3px] [&::-webkit-scrollbar-thumb]:bg-white/20">
          {visibleGroups.map((group, index) => (
            <div key={group.key}>
              {!effectiveCollapsed ? <div className="px-[14px] pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-text opacity-55">{t(group.labelKey)}</div> : null}
              {group.items.map((item) => {
                const ItemIcon = ROUTE_ICONS[item.to] ?? Building2;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={effectiveCollapsed ? t(item.labelKey) : undefined}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2 rounded-ui ${effectiveCollapsed ? 'justify-center px-0 py-[9px]' : 'px-[14px] py-[9px]'} font-medium text-sidebar-text no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40${isActive ? ' bg-primary text-white hover:bg-primary' : ' hover:bg-white/10 hover:text-white'}`
                    }
                    onClick={closeSidebar}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-white" aria-hidden="true" /> : null}
                        <ItemIcon className="size-4 shrink-0" />
                        {!effectiveCollapsed ? <span className="truncate">{t(item.labelKey)}</span> : null}
                      </>
                    )}
                  </NavLink>
                );
              })}
              {effectiveCollapsed && index < visibleGroups.length - 1 ? <div className="mx-3 my-2 border-t border-white/10" /> : null}
            </div>
          ))}
        </nav>
        <div className="flex shrink-0 flex-col gap-2.5 border-t border-white/10 p-3">
          <div className={`${effectiveCollapsed ? 'flex flex-col gap-2' : 'flex gap-2'}`}>
            <button
              type="button"
              className={`${effectiveCollapsed ? 'justify-center px-0' : 'flex-1 px-[14px]'} inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-white/20 bg-transparent py-2 text-sm font-semibold text-sidebar-text select-none hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={toggleTheme}
              aria-label={t('layout.toggleTheme')}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              type="button"
              className={`${effectiveCollapsed ? 'justify-center px-0' : 'flex-1 px-[14px]'} inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-white/20 bg-transparent py-2 text-sm font-semibold text-sidebar-text select-none hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={toggleLanguage}
              aria-label={t('layout.toggleLanguage')}
            >
              <Languages className="size-4" />
              {!effectiveCollapsed ? <span>{language.toUpperCase()}</span> : null}
            </button>
          </div>
          <div className={`flex items-center ${effectiveCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white select-none">
              {user ? userInitials(user.name, user.email) : '?'}
            </div>
            {!effectiveCollapsed ? (
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{user?.name || user?.email}</div>
                <div className="truncate text-[12px] text-sidebar-text">
                  {user?.roles.map((role) => role.name).join(', ')}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={`${effectiveCollapsed ? 'justify-center px-0' : 'px-[14px]'} inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-white/20 bg-transparent py-2 text-sm font-semibold text-sidebar-text select-none hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => void logout()}
            aria-label={t('layout.signOut')}
          >
            <LogOut className="size-4" />
            {!effectiveCollapsed ? t('layout.signOut') : null}
          </button>
        </div>
      </aside>
      {sidebarOpen ? <div className="hidden max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-40 max-[900px]:block max-[900px]:bg-black/40" onClick={closeSidebar} /> : null}
      <main className="max-w-[1100px] flex-1 px-8 py-7 max-[900px]:px-4 max-[900px]:py-5 print:max-w-full print:p-0">
        <button
          type="button"
          className="hidden cursor-pointer items-center justify-center rounded-ui border border-border bg-surface px-[14px] py-2 font-semibold text-text select-none hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary max-[900px]:fixed max-[900px]:left-3 max-[900px]:top-3 max-[900px]:z-50 max-[900px]:inline-flex print:hidden"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={t('layout.toggleSidebar')}
          aria-expanded={sidebarOpen}
        >
          <Menu className="size-5" />
        </button>
        <Outlet />
      </main>
    </div>
  );
}
