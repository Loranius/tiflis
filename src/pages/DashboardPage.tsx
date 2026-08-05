import { lazy, Suspense } from 'react';

const TodayOperationsWidget = lazy(() => import('../components/TodayOperationsWidget')
  .then((module) => ({ default: module.TodayOperationsWidget })));

export function DashboardPage() {
  return (
    <div className="today-page-v5">
      <Suspense
        fallback={(
          <div
            className="today-dashboard-loading-v5 route-skeleton-card"
            aria-label="Завантаження робочого дня"
          />
        )}
      >
        <TodayOperationsWidget />
      </Suspense>
    </div>
  );
}
