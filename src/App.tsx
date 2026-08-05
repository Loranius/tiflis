import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { canAccessPage, type PageKey } from './lib/acl';
import {
  loadAdminPage,
  loadCashPage,
  loadDashboardPage,
  loadLoginPage,
  loadMenuPage,
  loadReservePage,
  loadSchedulePage,
  loadStaffPage,
} from './lib/pageLoaders';

const LoginPage = lazy(() => loadLoginPage().then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => loadDashboardPage().then((module) => ({ default: module.DashboardPage })));
const SchedulePage = lazy(() => loadSchedulePage().then((module) => ({ default: module.SchedulePage })));
const CashPage = lazy(() => loadCashPage().then((module) => ({ default: module.CashPage })));
const MenuPage = lazy(() => loadMenuPage().then((module) => ({ default: module.MenuPage })));
const ReservePage = lazy(() => loadReservePage().then((module) => ({ default: module.ReservePage })));
const StaffPage = lazy(() => loadStaffPage().then((module) => ({ default: module.StaffPage })));
const AdminPage = lazy(() => loadAdminPage().then((module) => ({ default: module.AdminPage })));

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
          <Route path="/menu" element={<ProtectedPage page="menu"><MenuPage /></ProtectedPage>} />
          <Route path="/reserve" element={<ProtectedPage page="reserve"><ReservePage /></ProtectedPage>} />
          <Route path="/staff" element={<ProtectedPage page="staff"><StaffPage /></ProtectedPage>} />
          <Route path="/admin" element={<ProtectedPage page="admin"><AdminPage /></ProtectedPage>} />
        </Route>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </HashRouter>
  );
}
