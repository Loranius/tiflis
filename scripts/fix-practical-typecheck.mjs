import { readFile, writeFile } from 'node:fs/promises';

const cashPath = 'src/pages/CashPage.tsx';
const dashboardPath = 'src/pages/DashboardPage.tsx';

const cash = await readFile(cashPath, 'utf8');
const nextCash = cash.replace('  CalendarDays,\n', '');
if (nextCash === cash) throw new Error('CashPage import pattern not found');
await writeFile(cashPath, nextCash);

const dashboard = await readFile(dashboardPath, 'utf8');
const nextDashboard = dashboard.replace(
  "  return DAILY_WISHES[hash % DAILY_WISHES.length] || DAILY_WISHES[0];",
  "  return DAILY_WISHES[hash % DAILY_WISHES.length] ?? 'Бажаємо гарного дня.';",
);
if (nextDashboard === dashboard) throw new Error('Dashboard wish pattern not found');
await writeFile(dashboardPath, nextDashboard);
