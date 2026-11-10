import type { PageKey } from './acl';

/** A loader that keeps its module once it has arrived, so a screen whose code
    is already loaded can render synchronously (see `instantLazy` in App). */
type Loader<T> = (() => Promise<T>) & { loaded: () => T | undefined };
function memoLoader<T>(load: () => Promise<T>): Loader<T> {
  let request: Promise<T> | null = null;
  let module: T | undefined;
  const loader = (() => {
    request ??= load().then((value) => { module = value; return value; }, (reason) => { request = null; throw reason; });
    return request;
  }) as Loader<T>;
  loader.loaded = () => module;
  return loader;
}

export const loadLoginPage = memoLoader(() => import('../pages/LoginPage'));
export const loadDashboardPage = memoLoader(() => import('../pages/DashboardPage'));
export const loadSchedulePage = memoLoader(() => import('../pages/SchedulePage'));
export const loadCashPage = memoLoader(() => import('../pages/CashPage'));
export const loadRecordsPage = memoLoader(() => import('../pages/RecordsPage'));
export const loadMenuPage = memoLoader(() => import('../pages/MenuPage'));
export const loadReservePage = memoLoader(() => import('../pages/ReservePage'));
export const loadStaffPage = memoLoader(() => import('../pages/StaffPage'));
export const loadDutiesPage = memoLoader(() => import('../pages/DutiesPage'));
export const loadHandoverPage = memoLoader(() => import('../pages/HandoverPage'));
export const loadAdminPage = memoLoader(() => import('../pages/AdminPage'));

const pageLoaders: Record<PageKey, () => Promise<unknown>> = {
  today: loadDashboardPage,
  schedule: loadSchedulePage,
  cash: loadCashPage,
  records: loadRecordsPage,
  menu: loadMenuPage,
  reserve: loadReservePage,
  staff: loadStaffPage,
  duties: loadDutiesPage,
  handover: loadHandoverPage,
  admin: loadAdminPage,
};

const warmedPages = new Map<PageKey, Promise<unknown>>();

export function preloadPage(page: PageKey): Promise<unknown> {
  const existing = warmedPages.get(page);
  if (existing) return existing;

  const request = pageLoaders[page]();
  warmedPages.set(page, request);
  void request.catch(() => warmedPages.delete(page));
  return request;
}

export function preloadPages(pages: PageKey[]): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.allSettled(pages.map((page) => preloadPage(page)));
}

type PrefetchModule = { prefetch?: (userId: string) => Promise<unknown> };

/**
 * Warms a module completely: its code chunk, then the data its screen asks for
 * first. Opening it afterwards paints at once (secureApi remembers the reply).
 */
export async function prefetchPage(page: PageKey, userId: string): Promise<void> {
  const module = (await preloadPage(page)) as PrefetchModule;
  await module.prefetch?.(userId).catch(() => undefined);
}
