import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { canAccessPage, type PageKey } from './lib/acl';
import {
  loadAdminPage,
  loadCashPage,
  loadDashboardPage,
  loadDutiesPage,
  loadHandoverPage,
  loadLoginPage,
  loadMenuPage,
  loadRecordsPage,
  loadReservePage,
  loadSchedulePage,
  loadStaffPage,
} from './lib/pageLoaders';

/**
 * React.lazy, minus the wait for code that is already here. React 19 holds a
 * suspended screen back for ~300 ms even when its chunk resolves at once, so
 * when the module has arrived (warmed in AppShell) the page renders directly.
 */
function instantLazy<M, K extends keyof M>(
  loader: (() => Promise<M>) & { loaded: () => M | undefined },
  name: K,
): ComponentType {
  const Lazy = lazy(() => loader().then((module) => ({ default: module[name] as ComponentType })));
  return function InstantPage() {
    const Ready = loader.loaded()?.[name] as ComponentType | undefined;
    return Ready ? <Ready /> : <Lazy />;
  };
}

const LoginPage = instantLazy(loadLoginPage, 'LoginPage');
const DashboardPage = instantLazy(loadDashboardPage, 'DashboardPage');
const SchedulePage = instantLazy(loadSchedulePage, 'SchedulePage');
const CashPage = instantLazy(loadCashPage, 'CashPage');
const RecordsPage = instantLazy(loadRecordsPage, 'RecordsPage');
const MenuPage = instantLazy(loadMenuPage, 'MenuPage');
const ReservePage = instantLazy(loadReservePage, 'ReservePage');
const StaffPage = instantLazy(loadStaffPage, 'StaffPage');
const DutiesPage = instantLazy(loadDutiesPage, 'DutiesPage');
const HandoverPage = instantLazy(loadHandoverPage, 'HandoverPage');
const AdminPage = instantLazy(loadAdminPage, 'AdminPage');

function RouteSkeleton() {
  return (
    <div className="route-skeleton" aria-busy="true" aria-label="Завантаження модуля">
      <div className="route-skeleton-hero" />
      <div className="route-skeleton-grid">
        <div className="route-skeleton-card" />
        <div className="route-skeleton-card" />
        <div className="route-skeleton-card" />
      </div>
      <div className="route-skeleton-card route-skeleton-wide" />
    </div>
  );
}

function LoginSkeleton() {
  return (
    <main className="login-boot-skeleton" aria-busy="true">
      <div className="login-boot-card route-skeleton-card" />
    </main>
  );
}

function ShellSkeleton() {
  return (
    <div className="app-shell app-shell-skeleton" aria-busy="true" aria-label="Відновлення сесії">
      <aside className="sidebar">
        <div className="shell-skeleton-brand">
          <span className="shell-skeleton-logo" />
          <span className="shell-skeleton-copy">
            <i className="shell-skeleton-line" />
            <i className="shell-skeleton-line is-short" />
          </span>
        </div>
        <div className="shell-skeleton-nav">
          {Array.from({ length: 6 }, (_, index) => <i className="shell-skeleton-nav-item" key={index} />)}
        </div>
      </aside>
      <main className="workspace">
        <header className="shell-skeleton-topbar">
          <span className="shell-skeleton-copy">
            <i className="shell-skeleton-line is-short" />
            <i className="shell-skeleton-line" />
          </span>
        </header>
        <section className="page-content"><RouteSkeleton /></section>
      </main>
      <nav className="mobile-nav shell-mobile-nav-skeleton" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <i className="shell-mobile-nav-item" key={index} />)}
      </nav>
    </div>
  );
}

function ProtectedShell() {
  const { user, loading } = useAuth();
  if (loading) return <ShellSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function ProtectedPage({ page, children }: { page: PageKey; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessPage(user, page)) return <Navigate to="/today" replace />;
  return <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Suspense fallback={<LoginSkeleton />}><LoginPage /></Suspense>} />
        <Route element={<ProtectedShell />}>
          <Route path="/today" element={<ProtectedPage page="today"><DashboardPage /></ProtectedPage>} />
          <Route path="/schedule" element={<ProtectedPage page="schedule"><SchedulePage /></ProtectedPage>} />
          <Route path="/cash" element={<ProtectedPage page="cash"><CashPage /></ProtectedPage>} />
          <Route path="/records" element={<ProtectedPage page="records"><RecordsPage /></ProtectedPage>} />
          <Route path="/menu" element={<ProtectedPage page="menu"><MenuPage /></ProtectedPage>} />
          <Route path="/reserve" element={<ProtectedPage page="reserve"><ReservePage /></ProtectedPage>} />
          <Route path="/staff" element={<ProtectedPage page="staff"><StaffPage /></ProtectedPage>} />
          <Route path="/duties" element={<ProtectedPage page="duties"><DutiesPage /></ProtectedPage>} />
          <Route path="/handover" element={<ProtectedPage page="handover"><HandoverPage /></ProtectedPage>} />
          <Route path="/admin" element={<ProtectedPage page="admin"><AdminPage /></ProtectedPage>} />
        </Route>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </HashRouter>
  );
}
