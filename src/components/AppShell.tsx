import {
  Banknote,
  CalendarDays,
  ClipboardList,
  Home,
  LogOut,
  Settings,
  Soup,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { memo, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { accessiblePages, pages, type PageKey } from '../lib/acl';
import { preloadPage, preloadPages } from '../lib/pageLoaders';

const icons: Record<PageKey, LucideIcon> = {
  today: Home,
  schedule: CalendarDays,
  cash: Banknote,
  menu: Soup,
  reserve: ClipboardList,
  staff: Users,
  admin: Settings,
};

const preferredWarmOrder: PageKey[] = ['schedule', 'menu', 'reserve', 'cash', 'staff', 'admin'];

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

function warmPage(page: PageKey) {
  void preloadPage(page).catch(() => undefined);
}

export const AppShell = memo(function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navigation = useMemo(() => user ? accessiblePages(user) : [], [user]);
  const activeKey = useMemo(
    () => navigation.find((key) => location.pathname.startsWith(pages[key].path)) || 'today',
    [location.pathname, navigation],
  );

  useEffect(() => {
    if (!user) return;
    const connection = (navigator as NavigatorWithConnection).connection;
    if (connection?.saveData || connection?.effectiveType?.includes('2g')) return;

    const likelyPages = preferredWarmOrder
      .filter((page) => page !== activeKey && navigation.includes(page))
      .slice(0, 2);
    if (likelyPages.length === 0) return;

    const timer = window.setTimeout(() => {
      void preloadPages(likelyPages);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [activeKey, navigation, user]);

  if (!user) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">თ</div>
          <div>
            <div className="brand-name">Тифліс</div>
            <div className="brand-caption">портал персоналу</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Основна навігація">
          {navigation.map((key) => {
            const Icon = icons[key];
            return (
              <NavLink
                key={key}
                to={pages[key].path}
                onPointerEnter={() => warmPage(key)}
                onFocus={() => warmPage(key)}
                onTouchStart={() => warmPage(key)}
                className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
              >
                <Icon size={19} strokeWidth={1.9} />
                <span>{pages[key].title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
          <div className="sidebar-user-copy">
            <strong>{user.displayName}</strong>
            <span>{user.role === 'sysadmin' ? 'Системний адміністратор' : user.role}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => void logout()} aria-label="Вийти">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Тифліс · v2</span>
            <h1>{pages[activeKey].title}</h1>
          </div>
          <div className="topbar-profile">
            <div className="avatar avatar-small">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{user.role}</span>
            </div>
          </div>
        </header>
        <section className="page-content">
          <Outlet />
        </section>
      </main>

      <nav className="mobile-nav" aria-label="Мобільна навігація">
        {navigation.map((key) => {
          const Icon = icons[key];
          return (
            <NavLink
              key={key}
              to={pages[key].path}
              onPointerDown={() => warmPage(key)}
              onFocus={() => warmPage(key)}
              className={({ isActive }) => `mobile-nav-item${isActive ? ' is-active' : ''}`}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span>{pages[key].shortTitle}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
});
