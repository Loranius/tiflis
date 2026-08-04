import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { canAccessPage, type PageKey } from './lib/acl';
import { CashPage } from './pages/CashPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MenuPage } from './pages/MenuPage';
import { ModulePage } from './pages/ModulePage';
import { SchedulePage } from './pages/SchedulePage';

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="loading-mark">თ</div>
      <div className="loading-spinner" />
      <span>Відновлюємо захищену сесію…</span>
    </main>
  );
}

function ProtectedShell() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function ProtectedPage({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessPage(user, page)) return <Navigate to="/today" replace />;
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedShell />}>
          <Route path="/today" element={<DashboardPage />} />
          <Route path="/schedule" element={<ProtectedPage page="schedule"><SchedulePage /></ProtectedPage>} />
          <Route path="/cash" element={<ProtectedPage page="cash"><CashPage /></ProtectedPage>} />
          <Route path="/menu" element={<ProtectedPage page="menu"><MenuPage /></ProtectedPage>} />
          <Route path="/reserve" element={<ProtectedPage page="reserve"><ModulePage title="Резерви" description="Бронювання столів за датою, залом і статусом із журналом змін." source="tiflis: 18-reserve.js + tiflisv2: reserve.js" nextStep="Перенести календар броней і схему залів" /></ProtectedPage>} />
          <Route path="/staff" element={<ProtectedPage page="staff"><ModulePage title="Персонал" description="Профілі працівників, ролі, Telegram-прив’язка та статус активності." source="tiflis: 09-staff.js + 12-admin.js" nextStep="Перенести профілі на staff_profiles і прибрати legacy passwords" /></ProtectedPage>} />
          <Route path="/admin" element={<ProtectedPage page="admin"><ModulePage title="Управління" description="ACL, працівники, налаштування порталу, аудит і серверні інтеграції." source="tiflis: 12-admin.js + централізований ACL v2" nextStep="Створити серверні admin actions через tiflis-secure-api" /></ProtectedPage>} />
        </Route>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </HashRouter>
  );
}
