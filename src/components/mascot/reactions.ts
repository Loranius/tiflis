import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { secureApi } from '../../lib/secureApi';
import { getKyivDateKey } from '../../lib/time';
import {
  breakfastLine,
  cashLine,
  dishLine,
  greetingLine,
  isBreakfastShift,
  judgeCash,
  pickDish,
  roastLine,
  shiftLine,
  shiftVerdict,
  summarizeShifts,
  tomorrowKey,
  type Line,
} from './lines';

import { CASH_SAVED_EVENT, type CashSavedDetail } from './events';

interface ScheduleResponse {
  ok: true;
  me: { legacyUserId: string };
  entries: { user_id: string; date: string; shift: string | null }[];
}
interface MenuResponse {
  ok: true;
  items: { name: string; description: string | null }[];
}

const UNPROMPTED_EVERY_MS = 4 * 60_000;
const IDLE_BEFORE_MS = 20_000;
const GREETING_KEY = 'tiflis.mascot.greeted';

/** Already said today for `key` (no record is made). */
function saidToday(key: string): boolean {
  try {
    return localStorage.getItem(`tiflis.mascot.day.${key}`) === getKyivDateKey();
  } catch {
    return false;
  }
}

/** True once per Kyiv day for `key` (and records it); true again if storage is blocked. */
function onceToday(key: string): boolean {
  const today = getKyivDateKey();
  try {
    const storageKey = `tiflis.mascot.day.${key}`;
    if (localStorage.getItem(storageKey) === today) return false;
    localStorage.setItem(storageKey, today);
  } catch {
    /* blocked storage: say it; it is only a line */
  }
  return true;
}

function onceThisSession(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    /* blocked storage: greet */
  }
  return true;
}

function daysInMonth(monthKey: string): number {
  const [year = 0, month = 1] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

async function loadSchedule(month: string): Promise<ScheduleResponse | null> {
  try {
    return await secureApi<ScheduleResponse>({ action: 'schedule_bootstrap', month });
  } catch {
    return null;
  }
}

/**
 * Хінкалик's reactions: cash saves, tomorrow's breakfast shift, this month's
 * shift count (on the schedule page), and now and then a dish or a roast.
 * Everything reads only the viewer's own data; failures are silent.
 */
export function useMascotReactions(say: (line: Line) => void, active: boolean, isBusy: () => boolean): void {
  const { pathname } = useLocation();
  const sayRef = useRef(say);
  sayRef.current = say;
  const activeRef = useRef(active);
  activeRef.current = active;
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;
  const lastInput = useRef(Date.now());
  const lastUnprompted = useRef(Date.now());
  const menu = useRef<MenuResponse['items'] | null>(null);

  // Greeting, once per session.
  useEffect(() => {
    if (!active || !onceThisSession(GREETING_KEY)) return;
    const timer = window.setTimeout(() => sayRef.current(greetingLine(Math.random)), 3000);
    return () => window.clearTimeout(timer);
  }, [active]);

  // Cash saved by the viewer.
  useEffect(() => {
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<CashSavedDetail>).detail;
      if (!activeRef.current || !detail || !(detail.amount > 0)) return;
      sayRef.current(cashLine(judgeCash(detail.amount), detail.amount, Math.random));
    };
    window.addEventListener(CASH_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(CASH_SAVED_EVENT, onSaved);
  }, []);

  // Breakfast tomorrow, once a day.
  useEffect(() => {
    if (!active || saidToday('breakfast')) return; // no schedule request once it is said
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const tomorrow = tomorrowKey(getKyivDateKey());
      const schedule = await loadSchedule(tomorrow.slice(0, 7));
      if (cancelled || !schedule) return;
      const shift = schedule.entries.find((entry) => entry.user_id === schedule.me.legacyUserId && entry.date === tomorrow)?.shift;
      if (isBreakfastShift(shift) && onceToday('breakfast')) sayRef.current(breakfastLine((shift || '').trim(), Math.random));
    }, 8000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [active]);

  // Shift count, once a day, on the schedule page.
  useEffect(() => {
    if (!active || pathname !== '/schedule' || saidToday('shifts')) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const month = getKyivDateKey().slice(0, 7);
      const schedule = await loadSchedule(month);
      if (cancelled || !schedule) return;
      const mine = schedule.entries.filter((entry) => entry.user_id === schedule.me.legacyUserId && entry.date.startsWith(month));
      const summary = summarizeShifts(mine.map((entry) => entry.shift), daysInMonth(month));
      if (!summary || !onceToday('shifts')) return; // a half-published month is not judged
      sayRef.current(shiftLine(shiftVerdict(summary.work), summary.work, summary.off, Math.random));
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [active, pathname]);

  // Unprompted: a dish or a roast, at most every 4 minutes, only when idle.
  useEffect(() => {
    if (!active) return;
    const touch = () => { lastInput.current = Date.now(); };
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch);
    window.addEventListener('scroll', touch, { passive: true });
    const timer = window.setInterval(async () => {
      const now = Date.now();
      if (document.hidden || busyRef.current() || now - lastUnprompted.current < UNPROMPTED_EVERY_MS || now - lastInput.current < IDLE_BEFORE_MS) return;
      lastUnprompted.current = now;
      if (Math.random() < 0.5) {
        if (!menu.current) {
          try {
            menu.current = (await secureApi<MenuResponse>({ action: 'menu_bootstrap' }, 'tiflis-menu-api')).items || [];
          } catch {
            menu.current = [];
          }
        }
        const dish = pickDish(menu.current, Math.random);
        if (dish) {
          sayRef.current(dishLine(dish.name, dish.description, Math.random));
          return;
        }
      }
      sayRef.current(roastLine(Math.random));
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      window.removeEventListener('scroll', touch);
    };
  }, [active]);
}
