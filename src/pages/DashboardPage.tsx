import { lazy, Suspense } from 'react';
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

export function DashboardPage() {
  return (
    <div className="today-page-v5">
      <Suspense fallback={<DashboardCardSkeleton label="Завантаження робочого дня" />}>
        <TodayOperationsWidget />
      </Suspense>

      <Suspense fallback={<DashboardCardSkeleton label="Завантаження каси за сьогодні" />}>
        <TodayCashCard />
      </Suspense>

      <Suspense fallback={<DashboardCardSkeleton label="Завантаження найближчих резервів" />}>
        <TodayReservationsCard />
      </Suspense>
    </div>
  );
}
