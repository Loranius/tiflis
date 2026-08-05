import { lazy, Suspense } from 'react';

const TodayOperationsWidget = lazy(() => import('../components/TodayOperationsWidget')
  .then((module) => ({ default: module.TodayOperationsWidget })));
const TodayCashCard = lazy(() => import('../components/TodayCashCard')
  .then((module) => ({ default: module.TodayCashCard })));

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
    </div>
  );
}
