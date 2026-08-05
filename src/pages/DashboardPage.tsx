import {
  CalendarCheck2,
  CalendarDays,
  Coffee,
  Sparkles,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import './dashboard.css';
import './dashboard-cleanup.css';
import './dashboard-practical.css';

const TodayOperationsWidget = lazy(() => import('../components/TodayOperationsWidget')
  .then((module) => ({ default: module.TodayOperationsWidget })));

interface ScheduleRow {
  date: string;
  shift: string | null;
}

const KYIV_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAILY_WISHES = [
  'Нехай сьогодні все складається спокійно, чітко й без зайвого поспіху.',
  'Бажаємо легкої комунікації, вдячних гостей і гарного командного ритму.',
  'Нехай у кожній справі сьогодні буде порядок, а в команді — підтримка.',
  'Бажаємо впевненого дня, вдалих рішень і приємного завершення зміни.',
  'Нехай сьогодні буде більше добрих моментів, ніж непередбачених задач.',
  'Бажаємо сил на важливе, спокою в деталях і приємних людей поруч.',
  'Нехай день пройде рівно, продуктивно й залишить після себе гарний настрій.',
  'Бажаємо уважності, легкості в роботі та відчуття, що все під контролем.',
  'Нехай сьогодні команда працює як одне ціле, а гості йдуть задоволеними.',
  'Бажаємо доброго темпу, ясної голови й часу перевести подих між справами.',
  'Нехай кожна маленька перемога сьогодні додає впевненості й настрою.',
  'Бажаємо теплого дня, взаємної поваги та спокійної робочої атмосфери.',
];

function kyivDateKey(now = new Date()): string {
  return new Date(now.getTime() + KYIV_OFFSET_MS).toISOString().slice(0, 10);
}

function millisecondsUntilKyivMidnight(now = new Date()): number {
  const shifted = new Date(now.getTime() + KYIV_OFFSET_MS);
  const nextShiftedMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1,
  );
  return Math.max(1000, nextShiftedMidnight - shifted.getTime() + 100);
}

function dailyWishFor(dayKey: string): string {
  const hash = [...dayKey].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 0);
  return DAILY_WISHES[hash % DAILY_WISHES.length] ?? 'Бажаємо гарного дня.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

function formatToday(dayKey: string): string {
  const value = new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dayKey}T12:00:00`));
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isWorkShift(shift: string | null): boolean {
  return Boolean(shift && !['Х', 'О'].includes(shift));
}

function greetingFor(shift: string | null, firstName: string): string {
  if (shift === 'Х') return `Гарного вихідного, ${firstName}`;
  if (shift === 'О') return `Гарного відпочинку, ${firstName}`;
  if (isWorkShift(shift)) return `Гарної зміни, ${firstName}`;
  return `Гарного дня, ${firstName}`;
}

function statusFor(shift: string | null): { label: string; off: boolean } {
  if (shift === 'Х') return { label: 'Сьогодні вихідний', off: true };
  if (shift === 'О') return { label: 'Сьогодні відпустка', off: true };
  if (isWorkShift(shift)) return { label: `Сьогоднішня зміна: ${shift}`, off: false };
  return { label: 'На сьогодні зміна не призначена', off: true };
}

export function DashboardPage() {
  const { user } = useAuth();
  const [dayKey, setDayKey] = useState(() => kyivDateKey());
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [todayShift, setTodayShift] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationsReady, setOperationsReady] = useState(false);

  useEffect(() => {
    let handle = 0;
    const scheduleNext = () => {
      handle = window.setTimeout(() => {
        setDayKey(kyivDateKey());
        scheduleNext();
      }, millisecondsUntilKyivMidnight());
    };
    scheduleNext();
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setOperationsReady(true), { timeout: 700 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => setOperationsReady(true), 240);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const userId = user.id;

    async function load() {
      setLoading(true);
      const result = await supabase
        .from('schedule')
        .select('date,shift')
        .eq('user_id', userId)
        .gte('date', dayKey)
        .order('date', { ascending: true })
        .limit(45);
      if (cancelled) return;

      if (!result.error) {
        const rows = (result.data || []) as ScheduleRow[];
        setTodayShift(rows.find((row) => row.date === dayKey)?.shift || null);
        setSchedule(rows.filter((row) => isWorkShift(row.shift)).slice(0, 3));
      } else {
        setTodayShift(null);
        setSchedule([]);
      }
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [dayKey, user]);

  const firstName = user?.displayName.trim().split(/\s+/)[0] || 'колего';
  const dailyWish = useMemo(() => dailyWishFor(dayKey), [dayKey]);
  const dayStatus = statusFor(todayShift);

  return (
    <div className="today-page-v3">
      <section className="today-hero-v3">
        <div className="today-hero-copy-v3">
          <span className="today-date-v3"><Sparkles size={15} /> {formatToday(dayKey)}</span>
          <h2>{loading ? `Вітаємо, ${firstName}` : greetingFor(todayShift, firstName)}</h2>
          <p className="today-daily-wish-v4">{dailyWish}</p>
          <div className={`today-day-status-v4 ${dayStatus.off ? 'is-off' : ''}`}>
            {dayStatus.off ? <Coffee size={19} /> : <CalendarCheck2 size={19} />}
            <div><span>Статус дня</span><strong>{loading ? 'Перевіряємо графік…' : dayStatus.label}</strong></div>
          </div>
        </div>
        <div className="today-emblem-v3" aria-hidden="true"><span>თ</span><small>team</small></div>
      </section>

      {operationsReady ? (
        <Suspense fallback={<div className="operations-deferred-placeholder route-skeleton-card" aria-label="Завантаження робочої зміни" />}>
          <TodayOperationsWidget />
        </Suspense>
      ) : <div className="operations-deferred-placeholder route-skeleton-card" aria-hidden="true" />}

      <section className="today-content-grid-v3">
        <article className="today-panel-v3">
          <div className="today-panel-heading-v3">
            <div><span className="eyebrow">Найближче</span><h3>Мої наступні зміни</h3></div>
            <CalendarDays size={20} />
          </div>
          <div className="today-schedule-v3">
            {loading ? <div className="today-empty-v3"><span>Завантажуємо графік…</span></div> : null}
            {!loading && schedule.length === 0 ? (
              <div className="today-empty-v3"><CalendarDays size={27} /><strong>Робочих змін поки немає</strong><span>Коли зміни будуть призначені, вони з’являться тут.</span></div>
            ) : null}
            {!loading ? schedule.map((row) => (
              <div className="today-schedule-row-v3" key={row.date}><span>{formatDate(row.date)}</span><strong>{row.shift}</strong></div>
            )) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
