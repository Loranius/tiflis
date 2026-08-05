import type { PageKey } from './acl';

export const loadLoginPage = () => import('../pages/LoginPage');
export const loadDashboardPage = () => import('../pages/DashboardPage');
export const loadSchedulePage = () => import('../pages/SchedulePage');
export const loadCashPage = () => import('../pages/CashPage');
export const loadMenuPage = () => import('../pages/MenuPage');
export const loadReservePage = () => import('../pages/ReservePage');
export const loadStaffPage = () => import('../pages/StaffPage');
export const loadAdminPage = () => import('../pages/AdminPage');

const pageLoaders: Record<PageKey, () => Promise<unknown>> = {
  today: loadDashboardPage,
  schedule: loadSchedulePage,
  cash: loadCashPage,
  menu: loadMenuPage,
  reserve: loadReservePage,
  staff: loadStaffPage,
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
