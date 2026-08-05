import {
  Banknote,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Home,
  LogOut,
  MoreHorizontal,
  Settings,
  Soup,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
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
const mobilePriority: PageKey[] = ['today', 'schedule', 'menu', 'reserve', 'cash', 'staff', 'admin'];

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
  const [moreOpen, setMoreOpen] = useState(false);

  const navigation = useMemo(() => user ? accessiblePages(user) : [], [user]);
  const activeKey = useMemo(
    () => navigation.find((key) => location.pathname.startsWith(pages[key].path)) || 'today',
    [location.pathname, navigation],
  );
  const mobilePrimary = useMemo(
    () => mobilePriority.filter((key) => navigation.includes(key)).slice(0, 4),
    [navigation],
  );
  const mobileSecondary = useMemo(
    () => navigation.filter((key) => !mobilePrimary.includes(key)),
    [mobilePrimary, navigation],
  );
  const moreContainsActive = mobileSecondary.includes(activeKey);

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

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  if (!user) return null;

  const roleLabel = user.role === 'sysadmin' ? 'Системний адміністратор' : user.role;
  const mobileNavCount = mobilePrimary.length + (mobileSecondary.length > 0 ? 1 : 0);

  return (
    <div className="app-shell" data-page={activeKey}>
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
            <span>{roleLabel}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => void logout()} aria-label="Вийти">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Тифліс · робочий портал</span>
            <h1>{pages[activeKey].title}</h1>
          </div>
          <div className="topbar-profile">
            <div className="avatar avatar-small">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>
        </header>
        <section className="page-content">
          <Outlet />
        </section>
      </main>

      <nav
        className="mobile-nav"
        aria-label="Мобільна навігація"
        style={{ '--mobile-nav-count': mobileNavCount } as React.CSSProperties}
      >
        {mobilePrimary.map((key) => {
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
        {mobileSecondary.length > 0 ? (
          <button
            type="button"
            className={`mobile-nav-item mobile-nav-more${moreContainsActive || moreOpen ? ' is-active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-controls="mobile-more-sheet"
          >
            <MoreHorizontal size={21} strokeWidth={1.9} />
            <span>Ще</span>
          </button>
        ) : null}
      </nav>

      <div
        className={`mobile-more-backdrop${moreOpen ? ' is-open' : ''}`}
        onMouseDown={() => setMoreOpen(false)}
        aria-hidden={!moreOpen}
      >
        <section
          id="mobile-more-sheet"
          className="mobile-more-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Додаткові розділи"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mobile-more-heading">
            <div>
              <span className="eyebrow">Навігація</span>
              <h2>Ще</h2>
            </div>
            <button className="mobile-more-close" type="button" onClick={() => setMoreOpen(false)} aria-label="Закрити">
              <X size={20} />
            </button>
          </div>

          <div className="mobile-more-profile">
            <div className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div className="mobile-more-profile-copy">
              <strong>{user.displayName}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>

          <nav className="mobile-more-links" aria-label="Додаткові розділи порталу">
            {mobileSecondary.map((key) => {
              const Icon = icons[key];
              return (
                <NavLink
                  key={key}
                  to={pages[key].path}
                  onPointerDown={() => warmPage(key)}
                  className={({ isActive }) => `mobile-more-link${isActive ? ' is-active' : ''}`}
                >
                  <Icon size={20} strokeWidth={1.9} />
                  <span>{pages[key].title}</span>
                  <ChevronRight size={17} />
                </NavLink>
              );
            })}
          </nav>

          <button className="mobile-more-logout" type="button" onClick={() => void logout()}>
            <LogOut size={18} />
            Вийти з порталу
          </button>
        </section>
      </div>
    </div>
  );
});
