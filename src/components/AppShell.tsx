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
  Trophy,
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
} from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { AnimatePresence, m, useReducedMotion, type PanInfo } from 'motion/react';
import { playDialogEnter, spring, useFirstTime } from '../lib/motion';
import { useAuth } from '../auth/AuthProvider';
import { accessiblePages, pages, type PageKey } from '../lib/acl';
import { prefetchPage, preloadPage } from '../lib/pageLoaders';
import tiflisLogo from '../assets/brand/tiflis-wordmark-gold.png';

const icons: Record<PageKey, LucideIcon> = {
  today: Home,
  schedule: CalendarDays,
  cash: Banknote,
  records: Trophy,
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
  'records',
  'staff',
  'menu',
  'reserve',
  'duties',
  'handover',
  'admin',
];

type MobileSlot = 'schedule' | 'role' | 'home' | 'menu';

// Modules whose first screen is worth warming with data, most used first.
const DATA_WARM_ORDER: PageKey[] = ['schedule', 'cash', 'menu', 'records', 'reserve', 'staff'];
let warmUserId = '';

function warmPage(page: PageKey) {
  // A press on a tab starts its data request ~100–300 ms before the tap lands.
  if (warmUserId && DATA_WARM_ORDER.includes(page)) {
    void prefetchPage(page, warmUserId).catch(() => undefined);
    return;
  }
  void preloadPage(page).catch(() => undefined);
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
      {({ isActive }) => (
        <>
          {isActive && !home ? <NavPill /> : null}
          {home ? (
            <div className="mobile-nav-home-icon" aria-hidden="true">
              <Icon size={23} strokeWidth={2} />
            </div>
          ) : (
            <Icon size={20} strokeWidth={1.9} />
          )}
          <span>{pages[pageKey].shortTitle}</span>
        </>
      )}
    </NavLink>
  );
}

/** The gold wash under the active tab. It glides from tab to tab (shared layout). */
function NavPill() {
  return <m.span layoutId="tm-nav-pill" className="tm-nav-pill" aria-hidden="true" transition={spring.glide} />;
}

/** First screen of the session: the wordmark draws in once, then stays still. */
function BrandMark({ className, width, height }: { className: string; width: number; height: number }) {
  const intro = useFirstTime(`brand-${className}`);
  return (
    <m.img
      className={className}
      src={tiflisLogo}
      alt="Tiflis restaurant"
      width={width}
      height={height}
      initial={intro ? { clipPath: 'inset(0 100% 0 0)', opacity: 0.4, filter: 'blur(4px)' } : false}
      animate={{ clipPath: 'inset(0 0% 0 0)', opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, ease: [0.77, 0, 0.175, 1], delay: 0.1 }}
    />
  );
}

export const AppShell = memo(function AppShell() {
  const reduceMotion = useReducedMotion();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreSheetRef = useRef<HTMLElement>(null);

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
  const activeKeyRef = useRef<PageKey>(activeKey);
  activeKeyRef.current = activeKey;
  const previousIndex = navigation.indexOf(previousActiveRef.current);
  const activeIndex = navigation.indexOf(activeKey);
  const transitionDirection = previousIndex >= 0 && activeIndex >= 0 && activeIndex < previousIndex
    ? 'backward'
    : 'forward';

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

  useEffect(() => {
    previousActiveRef.current = activeKey;
  }, [activeKey]);

  // Warm every module the user can open, once Home has had the network to
  // itself: code chunks first (cheap, same origin), then the first data of the
  // busiest modules, one request at a time. Skipped on «save data».
  const userId = user?.id || '';
  useEffect(() => {
    warmUserId = userId;
    if (!userId) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    let cancelled = false;
    const run = async () => {
      for (const key of navigation) {
        if (cancelled) return;
        await preloadPage(key).catch(() => undefined);
      }
      for (const key of DATA_WARM_ORDER) {
        if (cancelled) return;
        if (!navigation.includes(key) || key === activeKeyRef.current) continue;
        await prefetchPage(key, userId).catch(() => undefined);
      }
    };
    const idle = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
    const timer = window.setTimeout(() => {
      if (idle.requestIdleCallback) idle.requestIdleCallback(() => { void run(); }, { timeout: 2000 });
      else void run();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [navigation, userId]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';

    playDialogEnter(null, moreSheetRef.current);
    const focusFrame = window.requestAnimationFrame(() => {
      const firstControl = moreSheetRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstControl || moreSheetRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !moreSheetRef.current) return;

      const controls = [...moreSheetRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((control) => !control.hasAttribute('hidden'));
      if (controls.length === 0) {
        event.preventDefault();
        moreSheetRef.current.focus();
        return;
      }

      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [moreOpen]);

  if (!user) return null;

  const roleLabel = roleNames[user.role] || user.role;
  const routeOffset = reduceMotion ? 0 : transitionDirection === 'backward' ? -18 : 18;
  // Swipe the «Ще» sheet down to close. The shared modal CSS pins `transform`,
  // so the sheet follows the finger through the independent `translate` property.
  const followSwipe = (_event: PointerEvent, info: PanInfo) => {
    const sheet = moreSheetRef.current;
    if (sheet) sheet.style.translate = `0 ${Math.max(0, info.offset.y)}px`;
  };
  const closeOnSwipe = (_event: PointerEvent, info: PanInfo) => {
    const sheet = moreSheetRef.current;
    if (info.offset.y > 90 || info.velocity.y > 500) {
      setMoreOpen(false);
      return;
    }
    if (!sheet) return;
    sheet.animate([{ translate: sheet.style.translate || '0 0' }, { translate: '0 0' }], { duration: 260, easing: 'cubic-bezier(.23,1,.32,1)' });
    sheet.style.translate = '';
  };

  return (
    <div className="app-shell" data-page={activeKey}>
      <aside className="sidebar">
        <div className="brand">
          <BrandMark className="brand-logo" width={92} height={59} />
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
            <BrandMark className="topbar-logo" width={68} height={43} />
            <m.h1
              key={activeKey}
              initial={reduceMotion ? false : { opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              {pages[activeKey].title}
            </m.h1>
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
          <m.div
            key={location.pathname}
            className="route-transition"
            data-direction={transitionDirection}
            initial={reduceMotion ? false : { opacity: 0, x: routeOffset, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } }}
            transition={spring.settle}
          >
            <Outlet />
          </m.div>
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
            ref={moreTriggerRef}
            type="button"
            className={`mobile-nav-item mobile-nav-more mobile-slot-more${moreContainsActive || moreOpen ? ' is-active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-controls="mobile-more-sheet"
          >
            {moreContainsActive || moreOpen ? <NavPill /> : null}
            <MoreHorizontal size={21} strokeWidth={1.9} />
            <span>Ще</span>
          </button>
        ) : null}
      </nav>

      <AnimatePresence>
      {moreOpen ? (
        <m.div
          key="more"
          className="mobile-more-backdrop is-open"
          onMouseDown={() => setMoreOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16 } }}
          transition={{ duration: 0.2 }}
        >
          <m.section
            ref={moreSheetRef}
            id="mobile-more-sheet"
            className="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
          >
            <m.div
              className="mobile-more-grab"
              onPan={reduceMotion ? undefined : followSwipe}
              onPanEnd={reduceMotion ? undefined : closeOnSwipe}
            >
              <div className="mobile-more-grip" aria-hidden="true" />
            </m.div>
            <div className="mobile-more-heading">
              <h2 id="mobile-more-title">Ще</h2>
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
          </m.section>
        </m.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
});
