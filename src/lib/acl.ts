import type { StaffRole, StaffUser } from '../types';

export type PageKey = 'today' | 'schedule' | 'cash' | 'records' | 'menu' | 'reserve' | 'staff' | 'duties' | 'handover' | 'admin';
export type ActionKey =
  | 'editSchedule'
  | 'editOwnShift'
  | 'toggleStop'
  | 'editMenu'
  | 'manageReserve'
  | 'manageUsers'
  | 'seeAllCash';

export interface PageAccess {
  path: string;
  title: string;
  shortTitle: string;
  roles: '*' | StaffRole[];
}

export const pages: Record<PageKey, PageAccess> = {
  today: { path: '/today', title: 'Сьогодні', shortTitle: 'Головна', roles: '*' },
  schedule: {
    path: '/schedule',
    title: 'Графік',
    shortTitle: 'Графік',
    roles: ['sysadmin', 'admin', 'chef', 'cook', 'waiter', 'bar', 'hostess'],
  },
  cash: {
    path: '/cash',
    title: 'Каса',
    shortTitle: 'Каса',
    roles: ['sysadmin', 'admin', 'waiter', 'bar'],
  },
  records: {
    path: '/records',
    title: 'Рекорди',
    shortTitle: 'Рекорди',
    roles: ['sysadmin', 'admin', 'waiter'],
  },
  menu: {
    path: '/menu',
    title: 'Меню ресторану',
    shortTitle: 'Меню',
    roles: ['sysadmin', 'admin', 'chef', 'cook', 'waiter', 'bar', 'hostess'],
  },
  reserve: {
    path: '/reserve',
    title: 'Резерви',
    shortTitle: 'Резерви',
    roles: ['sysadmin', 'admin', 'waiter', 'hostess'],
  },
  staff: {
    path: '/staff',
    title: 'Персонал',
    shortTitle: 'Команда',
    roles: ['sysadmin', 'admin', 'chef', 'cook', 'waiter', 'bar', 'hostess'],
  },
  duties: {
    path: '/duties',
    title: 'Обов’язки',
    shortTitle: 'Обов’язки',
    roles: ['sysadmin', 'admin', 'chef', 'cook', 'waiter', 'bar', 'hostess', 'runner'],
  },
  handover: {
    path: '/handover',
    title: 'Здача зміни',
    shortTitle: 'Здача зміни',
    roles: ['sysadmin', 'admin', 'chef', 'cook', 'waiter', 'bar', 'hostess', 'runner'],
  },
  admin: {
    path: '/admin',
    title: 'Управління',
    shortTitle: 'Ще',
    roles: ['sysadmin', 'admin'],
  },
};

const actions: Record<ActionKey, StaffRole[]> = {
  editSchedule: ['sysadmin', 'admin'],
  editOwnShift: ['waiter', 'bar', 'cook', 'chef', 'hostess'],
  toggleStop: ['sysadmin', 'admin', 'chef', 'cook'],
  editMenu: ['sysadmin', 'admin', 'chef'],
  manageReserve: ['sysadmin', 'admin', 'hostess'],
  manageUsers: ['sysadmin', 'admin'],
  seeAllCash: ['sysadmin', 'admin'],
};

export function userRoles(user: StaffUser): StaffRole[] {
  return [user.role, user.role2].filter((role): role is StaffRole => Boolean(role));
}

export function canAccessPage(user: StaffUser, key: PageKey): boolean {
  if (user.role === 'sysadmin') return true;
  const allowed = pages[key].roles;
  return allowed === '*' || userRoles(user).some((role) => allowed.includes(role));
}

export function canPerform(user: StaffUser, action: ActionKey): boolean {
  if (user.role === 'sysadmin') return true;
  return userRoles(user).some((role) => actions[action].includes(role));
}

export function accessiblePages(user: StaffUser): PageKey[] {
  return (Object.keys(pages) as PageKey[])
    .filter((key) => key !== 'handover' && canAccessPage(user, key));
}
