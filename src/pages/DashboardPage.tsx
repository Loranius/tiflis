import {
  ArrowUpRight,
  Banknote,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  Soup,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { canAccessPage, pages, type PageKey } from '../lib/acl';
import { supabase } from '../lib/supabase';
import './dashboard.css';
import './dashboard-cleanup.css';

const TodayOperationsWidget = lazy(() => import('../components/TodayOperationsWidget')
  .then((module) => ({ default: module.TodayOperationsWidget })));

interface ScheduleRow {
  date: string;
  shift: string | null;
}

interface QuickAction {
  page: PageKey;
  title: string;
  description: string;
  icon: LucideIcon;
}

const QUICK_ACTIONS: QuickAction[] = [
  { page: 'schedule', title: 'Графік', description: 'Перевірити зміни команди', icon: CalendarDays },
  { page: 'menu', title: 'Меню', description: 'Склад і подача позицій', icon: Soup },
  { page: 'reserve', title: 'Резерви', description: 'Столи та таймлайн сервісу', icon: ClipboardList },
  { page: 'cash', title: 'Каса', description: 'Виручка й особистий результат', icon: Banknote },
  { page: 'staff', title: 'Команда', description: 'Профілі та ролі працівників', icon: ShieldCheck },
];

const ROLE_NAMES: Record<string, string> = {
  sysadmin: 'Системний адміністратор',
  admin: 'Адміністратор',
  chef: 'Шеф-кухар',
  cook: 'Кухар',
  waiter: 'Офіціант',
  bar: 'Бар',
  hostess: 'Хостес',
  runner: 'Ранер',
  staff: 'Працівник',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

function formatToday(): string {
  const value = new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DashboardPage() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationsReady, setOperationsReady] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setOperationsReady(true), { timeout: 900 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => setOperationsReady(true), 320);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const userId = user.id;
    const today = new Date().toISOString().slice(0, 10);

    async function load() {
      const result = await supabase
        .from('schedule')
        .select('date,shift')
        .eq('user_id', userId)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(3);
      if (cancelled) return;
      if (!result.error) setSchedule((result.data || []) as ScheduleRow[]);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [user]);

  const nextShift = useMemo(
    () => schedule.find((row) => row.shift && !['Х', 'О', ''].includes(row.shift)),
    [schedule],
  );
  const quickActions = useMemo(
    () => user ? QUICK_ACTIONS.filter((action) => canAccessPage(user, action.page)).slice(0, 4) : [],
    [user],
  );

  const firstName = user?.displayName.trim().split(/\s+/)[0] || 'колего';
  const roleLabel = user ? ROLE_NAMES[user.role] || user.role : 'Працівник';
  const nextShiftLabel = loading
    ? 'Завантажуємо графік…'
    : nextShift
      ? `${formatDate(nextShift.date)} · ${nextShift.shift}`
      : 'Найближчих змін немає';

  return (
    <div className="today-page-v3">
      <section className="today-hero-v3">
        <div className="today-hero-copy-v3">
          <span className="today-date-v3"><Sparkles size={15} /> {formatToday()}</span>
          <h2>Гарної зміни, {firstName}</h2>
          <p>Тут залишено тільки те, що потрібно сьогодні: три найближчі дні графіка та ваші робочі обов’язки.</p>
          <div className="today-shift-pill-v3">
            <CalendarCheck2 size={19} />
            <div className="today-shift-pill-copy-v3"><span>Наступна зміна</span><strong>{nextShiftLabel}</strong></div>
          </div>
        </div>
        <div className="today-emblem-v3" aria-hidden="true"><span>თ</span><small>team</small></div>
      </section>

      {quickActions.length > 0 ? (
        <section className="today-quick-grid-v3" aria-label="Швидкі дії">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link className="today-quick-v3" to={pages[action.page].path} key={action.page}>
                <Icon size={22} />
                <span className="today-quick-copy-v3"><strong>{action.title}</strong><span>{action.description}</span></span>
                <ArrowUpRight size={17} />
              </Link>
            );
          })}
        </section>
      ) : null}

      <section className="today-metric-row-v3">
        <article className="today-metric-v3">
          <span className="today-metric-icon-v3"><CalendarCheck2 size={20} /></span>
          <span className="today-metric-copy-v3"><span>Наступна зміна</span><strong>{nextShiftLabel}</strong></span>
        </article>
        <article className="today-metric-v3">
          <span className="today-metric-icon-v3"><ShieldCheck size={20} /></span>
          <span className="today-metric-copy-v3"><span>Роль у порталі</span><strong>{roleLabel}</strong></span>
        </article>
      </section>

      <section className="today-content-grid-v3">
        <article className="today-panel-v3">
          <div className="today-panel-heading-v3">
            <div><span className="eyebrow">Три найближчі дні</span><h3>Мій графік</h3></div>
            {user && canAccessPage(user, 'schedule') ? <Link className="today-panel-link-v3" to={pages.schedule.path}>Відкрити <ArrowUpRight size={14} /></Link> : null}
          </div>
          <div className="today-schedule-v3">
            {loading ? <div className="today-empty-v3"><span>Завантажуємо найближчі зміни…</span></div> : null}
            {!loading && schedule.length === 0 ? (
              <div className="today-empty-v3"><CalendarDays size={27} /><strong>Графік поки порожній</strong><span>Коли зміни будуть призначені, вони з’являться тут.</span></div>
            ) : null}
            {!loading ? schedule.map((row) => (
              <div className="today-schedule-row-v3" key={row.date}><span>{formatDate(row.date)}</span><strong>{row.shift || 'Вихідний'}</strong></div>
            )) : null}
          </div>
        </article>
      </section>

      {operationsReady ? (
        <Suspense fallback={<div className="operations-deferred-placeholder route-skeleton-card" aria-label="Завантаження робочої зміни" />}>
          <TodayOperationsWidget />
        </Suspense>
      ) : <div className="operations-deferred-placeholder route-skeleton-card" aria-hidden="true" />}
    </div>
  );
}
