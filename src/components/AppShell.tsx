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
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { accessiblePages, pages, type PageKey } from '../lib/acl';

const icons: Record<PageKey, LucideIcon> = {
  today: Home,
  schedule: CalendarDays,
  cash: Banknote,
  menu: Soup,
  reserve: ClipboardList,
  staff: Users,
  admin: Settings,
};

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const navigation = accessiblePages(user);
  const activeKey = navigation.find((key) => location.pathname.startsWith(pages[key].path)) || 'today';

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
}
