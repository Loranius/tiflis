import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { accessiblePages, type PageKey } from '../lib/acl';
import { preloadPages } from '../lib/pageLoaders';
import { secureApi } from '../lib/secureApi';
import { getKyivDateKey } from '../lib/time';

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function currentMonth(): string {
  return getKyivDateKey().slice(0, 7);
}

export function PortalWarmup() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const connection = (navigator as NavigatorWithConnection).connection;
    const effectiveType = connection?.effectiveType || '';
    if (connection?.saveData || effectiveType.includes('2g')) return;

    const accessible = new Set<PageKey>(accessiblePages(user));
    const fastConnection = !effectiveType || effectiveType.includes('4g');
    const primaryPages = (['schedule', 'cash', 'menu'] as PageKey[])
      .filter((page) => accessible.has(page));
    const secondaryPages = (['reserve', 'staff', 'duties', 'handover'] as PageKey[])
      .filter((page) => accessible.has(page));

    let cancelled = false;
    let secondaryTimer: number | null = null;
    const idleWindow = window as IdleWindow;
    const requestIdle = idleWindow.requestIdleCallback;
    const cancelIdle = idleWindow.cancelIdleCallback;

    const warmPrimary = () => {
      if (cancelled) return;
      void preloadPages(primaryPages);

      if (!fastConnection) return;

      const month = currentMonth();
      const requests: Promise<unknown>[] = [];

      if (accessible.has('schedule')) {
        requests.push(secureApi(
          { action: 'schedule_bootstrap', month },
          'tiflis-secure-api',
          { cacheTtlMs: 20_000 },
        ));
      }

      if (accessible.has('cash')) {
        requests.push(secureApi(
          {
            action: 'cash_bootstrap',
            month,
            user_id: user.id,
            leaderboard_period: 'first',
          },
          'tiflis-secure-api',
          { cacheTtlMs: 20_000 },
        ));
      }

      if (accessible.has('menu')) {
        requests.push(secureApi(
          { action: 'menu_bootstrap' },
          'tiflis-menu-api',
          { cacheTtlMs: 30_000 },
        ));
      }

      void Promise.allSettled(requests);

      secondaryTimer = window.setTimeout(() => {
        if (!cancelled) void preloadPages(secondaryPages);
      }, 1400);
    };

    const usedIdleCallback = Boolean(requestIdle);
    const idleHandle = requestIdle
      ? requestIdle(warmPrimary, { timeout: 650 })
      : window.setTimeout(warmPrimary, 220);

    return () => {
      cancelled = true;
      if (secondaryTimer !== null) window.clearTimeout(secondaryTimer);
      if (usedIdleCallback && cancelIdle) {
        cancelIdle(idleHandle);
      } else {
        window.clearTimeout(idleHandle);
      }
    };
  }, [user]);

  return null;
}
