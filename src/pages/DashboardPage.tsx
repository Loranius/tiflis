import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import './dashboard-order.css';

const TodayOperationsWidget = lazy(() => import('../components/TodayOperationsWidget')
  .then((module) => ({ default: module.TodayOperationsWidget })));
const TodayCashCard = lazy(() => import('../components/TodayCashCard')
  .then((module) => ({ default: module.TodayCashCard })));
const TodayReservationsCard = lazy(() => import('../components/TodayReservationsCard')
  .then((module) => ({ default: module.TodayReservationsCard })));

function DashboardCardSkeleton({ label }: { label: string }) {
  return (
    <div
      className="today-dashboard-loading-v5 route-skeleton-card"
      aria-label={label}
    />
  );
}

function greetingFor(date: Date): string {
  const hour = Number(new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    hour12: false,
  }).format(date));

  if (hour >= 5 && hour < 12) return 'Доброго ранку';
  if (hour >= 12 && hour < 18) return 'Добрий день';
  return 'Добрий вечір';
}

function WelcomeWidget() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const firstName = user?.displayName.trim().split(/\s+/)[0] || 'колего';
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now), [now]);
  const timeLabel = useMemo(() => new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now), [now]);

  return (
    <section className="today-welcome-v1" aria-label="Вітання">
      <div className="today-welcome-mark-v1" aria-hidden="true">თ</div>
      <div className="today-welcome-copy-v1">
        <strong>{greetingFor(now)}, {firstName}</strong>
        <span>{dateLabel} · {timeLabel}</span>
      </div>
      <span className="today-welcome-brand-v1">TIFLIS</span>
    </section>
  );
}

export function DashboardPage() {
  return (
    <div className="today-page-v5">
      <WelcomeWidget />

      <Suspense fallback={<DashboardCardSkeleton label="Завантаження каси за сьогодні" />}>
        <TodayCashCard />
      </Suspense>

      <Suspense fallback={<DashboardCardSkeleton label="Завантаження робочого дня" />}>
        <TodayOperationsWidget />
      </Suspense>

      <Suspense fallback={<DashboardCardSkeleton label="Завантаження найближчих резервів" />}>
        <TodayReservationsCard />
      </Suspense>
    </div>
  );
}
