import {
  Banknote,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Home,
  LogOut,
  MessageSquarePlus,
  MoreHorizontal,
  Settings,
  Soup,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
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
  duties: ClipboardCheck,
  handover: MessageSquarePlus,
  admin: Settings,
};

const roleNames: Record<string, string> = {
  sysadmin: 'Системний адміністратор',
  admin: 'Адміністратор',
  chef: 'Шеф-кухар',
  cook: 'Кухар',
  waiter: 'Офіціант',
  bar: 'Бар',
  hostess: 'Хостес',
  runner: 'Ранер',
  staff: 'Працівник',
};

// Порядок із попереднього порталу: головна завжди перша в desktop-sidebar,
// далі графік, каса, персонал, меню, резерви й управління.
const legacyDesktopOrder: PageKey[] = [
  'today',
  'schedule',
  'cash',
  'staff',
  'menu',
  'reserve',
  'duties',
  'handover',
  'admin',
];

const preferredWarmOrder: PageKey[] = ['schedule', 'cash', 'menu', 'reserve', 'duties', 'handover', 'staff', 'admin'];
const ROUTE_SWIPE_BREAKPOINT = 980;
const ROUTE_SWIPE_EDGE_GUARD = 24;
const ROUTE_SWIPE_MAX_DURATION = 900;

interface RouteSwipeGesture {
  identifier: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  blocked: boolean;
}

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

type MobileSlot = 'schedule' | 'role' | 'home' | 'menu';

function warmPage(page: PageKey) {
  void preloadPage(page).catch(() => undefined);
}

function blocksRouteSwipe(target: EventTarget | null, boundary: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;

  if (target.closest([
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="dialog"]',
    '.mobile-more-sheet',
  ].join(','))) return true;

  let element: Element | null = target;
  while (element && element !== boundary) {
    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element);
      const horizontalScroller = style.overflowX === 'auto' || style.overflowX === 'scroll';
      if (horizontalScroller && element.scrollWidth > element.clientWidth + 8) return true;
    }
    element = element.parentElement;
  }

  return false;
}

function MobilePageLink({
  pageKey,
  slot,
  home = false,
}: {
  pageKey: PageKey;
  slot: MobileSlot;
  home?: boolean;
}) {
  const Icon = icons[pageKey];
  return (
    <NavLink
      to={pages[pageKey].path}
      onPointerDown={() => warmPage(pageKey)}
      onFocus={() => warmPage(pageKey)}
      className={({ isActive }) => [
        'mobile-nav-item',
        `mobile-slot-${slot}`,
        home ? 'mobile-nav-home' : '',
        isActive ? 'is-active' : '',
      ].filter(Boolean).join(' ')}
    >
      {home ? (
        <div className="mobile-nav-home-icon" aria-hidden="true">
          <Icon size={23} strokeWidth={2} />
        </div>
      ) : (
        <Icon size={20} strokeWidth={1.9} />
      )}
      <span>{pages[pageKey].shortTitle}</span>
    </NavLink>
  );
}

export const AppShell = memo(function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const routeSwipeRef = useRef<RouteSwipeGesture | null>(null);
  const suppressClickUntilRef = useRef(0);
  const swipeTransitionDirectionRef = useRef<'forward' | 'backward' | null>(null);

  const accessible = useMemo(
    () => new Set<PageKey>(user ? accessiblePages(user) : []),
    [user],
  );
  const navigation = useMemo(
    () => legacyDesktopOrder.filter((key) => accessible.has(key)),
    [accessible],
  );
  const activeKey = useMemo(
    () => navigation.find((key) => location.pathname.startsWith(pages[key].path)) || 'today',
    [location.pathname, navigation],
  );
  const previousActiveRef = useRef<PageKey>(activeKey);
  const previousIndex = navigation.indexOf(previousActiveRef.current);
  const activeIndex = navigation.indexOf(activeKey);
  const transitionDirection = swipeTransitionDirectionRef.current || (
    previousIndex >= 0 && activeIndex >= 0 && activeIndex < previousIndex
      ? 'backward'
      : 'forward'
  );

  // Стара мобільна схема: Графік · Каса/рольова заміна · Головна · Меню · Ще.
  // Якщо каса недоступна для ролі, на її місце стає найближчий робочий модуль,
  // але головна завжди залишається строго в третій, центральній позиції.
  const mobileRoleKey = useMemo<PageKey | null>(() => {
    const fallbackOrder: PageKey[] = ['cash', 'reserve', 'staff'];
    return fallbackOrder.find((key) => navigation.includes(key)) || null;
  }, [navigation]);

  const mobileFixedKeys = useMemo(() => new Set<PageKey>([
    'today',
    ...(navigation.includes('schedule') ? ['schedule' as PageKey] : []),
    ...(mobileRoleKey ? [mobileRoleKey] : []),
    ...(navigation.includes('menu') ? ['menu' as PageKey] : []),
  ]), [mobileRoleKey, navigation]);

  const mobileSecondary = useMemo(
    () => navigation.filter((key) => !mobileFixedKeys.has(key)),
    [mobileFixedKeys, navigation],
  );
  const moreContainsActive = mobileSecondary.includes(activeKey);

  // Свайпи йдуть у тому самому порядку, у якому модулі стоять у мобільній навігації.
  const swipeNavigation = useMemo<PageKey[]>(() => {
    const ordered: PageKey[] = [];
    const add = (key: PageKey | null) => {
      if (key && navigation.includes(key) && !ordered.includes(key)) ordered.push(key);
    };

    add('schedule');
    add(mobileRoleKey);
    add('today');
    add('menu');
    mobileSecondary.forEach(add);
    return ordered;
  }, [mobileRoleKey, mobileSecondary, navigation]);

  useEffect(() => {
    previousActiveRef.current = activeKey;
    swipeTransitionDirectionRef.current = null;
  }, [activeKey]);

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

  function handleRouteTouchStart(event: ReactTouchEvent<HTMLElement>) {
    routeSwipeRef.current = null;
    if (window.innerWidth > ROUTE_SWIPE_BREAKPOINT || moreOpen || event.touches.length !== 1) return;

    const touch = event.touches.item(0);
    if (!touch) return;

    const startsAtSystemEdge = touch.clientX <= ROUTE_SWIPE_EDGE_GUARD
      || touch.clientX >= window.innerWidth - ROUTE_SWIPE_EDGE_GUARD;

    routeSwipeRef.current = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startedAt: performance.now(),
      blocked: startsAtSystemEdge || blocksRouteSwipe(event.target, event.currentTarget),
    };
  }

  function handleRouteTouchMove(event: ReactTouchEvent<HTMLElement>) {
    const gesture = routeSwipeRef.current;
    if (!gesture) return;

    const touch = Array.from(event.touches).find((item) => item.identifier === gesture.identifier);
    if (!touch) return;

    gesture.lastX = touch.clientX;
    gesture.lastY = touch.clientY;

    const deltaX = gesture.lastX - gesture.startX;
    const deltaY = gesture.lastY - gesture.startY;
    if (Math.abs(deltaY) > 26 && Math.abs(deltaY) > Math.abs(deltaX) * 1.05) {
      gesture.blocked = true;
    }
  }

  function handleRouteTouchEnd(event: ReactTouchEvent<HTMLElement>) {
    const gesture = routeSwipeRef.current;
    routeSwipeRef.current = null;
    if (!gesture || gesture.blocked || window.innerWidth > ROUTE_SWIPE_BREAKPOINT) return;

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === gesture.identifier);
    const endX = touch?.clientX ?? gesture.lastX;
    const endY = touch?.clientY ?? gesture.lastY;
    const deltaX = endX - gesture.startX;
    const deltaY = endY - gesture.startY;
    const elapsed = performance.now() - gesture.startedAt;
    const minimumDistance = Math.min(96, Math.max(64, window.innerWidth * 0.16));

    if (elapsed > ROUTE_SWIPE_MAX_DURATION) return;
    if (Math.abs(deltaX) < minimumDistance) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    const currentIndex = swipeNavigation.indexOf(activeKey);
    if (currentIndex < 0) return;

    const step = deltaX < 0 ? 1 : -1;
    const nextKey = swipeNavigation[currentIndex + step];
    if (!nextKey) return;

    suppressClickUntilRef.current = performance.now() + 650;
    swipeTransitionDirectionRef.current = step > 0 ? 'forward' : 'backward';
    warmPage(nextKey);
    navigate(pages[nextKey].path);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }

  function handleRouteTouchCancel() {
    routeSwipeRef.current = null;
  }

  function handleRouteClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (performance.now() >= suppressClickUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  if (!user) return null;

  const roleLabel = roleNames[user.role] || user.role;

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
            <h1 key={activeKey} className="topbar-title-transition">{pages[activeKey].title}</h1>
          </div>
          <div className="topbar-profile">
            <div className="avatar avatar-small">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>
        </header>
        <section
          className="page-content route-swipe-surface"
          onTouchStartCapture={handleRouteTouchStart}
          onTouchMoveCapture={handleRouteTouchMove}
          onTouchEndCapture={handleRouteTouchEnd}
          onTouchCancelCapture={handleRouteTouchCancel}
          onClickCapture={handleRouteClickCapture}
        >
          <div
            key={location.pathname}
            className="route-transition"
            data-direction={transitionDirection}
          >
            <Outlet />
          </div>
        </section>
      </main>

      <nav className="mobile-nav legacy-mobile-nav" aria-label="Мобільна навігація">
        {navigation.includes('schedule') ? (
          <MobilePageLink pageKey="schedule" slot="schedule" />
        ) : null}

        {mobileRoleKey ? (
          <MobilePageLink pageKey={mobileRoleKey} slot="role" />
        ) : null}

        <MobilePageLink pageKey="today" slot="home" home />

        {navigation.includes('menu') ? (
          <MobilePageLink pageKey="menu" slot="menu" />
        ) : null}

        {mobileSecondary.length > 0 ? (
          <button
            type="button"
            className={`mobile-nav-item mobile-nav-more mobile-slot-more${moreContainsActive || moreOpen ? ' is-active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-controls="mobile-more-sheet"
          >
            <MoreHorizontal size={21} strokeWidth={1.9} />
            <span>Ще</span>
          </button>
        ) : null}
      </nav>

      {moreOpen ? (
        <div className="mobile-more-backdrop is-open" onMouseDown={() => setMoreOpen(false)}>
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
      ) : null}
    </div>
  );
});