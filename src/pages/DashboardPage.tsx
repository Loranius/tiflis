import { Cake, Check, ChevronRight, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { m, useReducedMotion, useScroll, useTransform } from 'motion/react';
import charcoalWordmark from '../assets/brand/tiflis-wordmark-charcoal.png';
import { useAuth } from '../auth/AuthProvider';
import { useKyivDay } from '../hooks/useKyivDay';
import {
  loadDutyPlan,
  setPlannedDutyStatus,
  type DutyAssignment,
  type DutyPlanResponse,
} from '../lib/dutyPlannerClient';
import { peekSecureApi, secureApi } from '../lib/secureApi';
import { addDaysToDateKey, isKyivWeekday } from '../lib/time';
import { GoldBurst, spring, useFirstTime } from '../lib/motion';
import './home-v3.css';

const MLink = m.create(Link);

/* ---------- motion ----------
   Home is opened many times a shift. The first visit of a session plays the
   full entrance (greeting words, a cascade of cards); later visits only get
   the shared screen transition. The gold mast drifts slower than the page
   when scrolling (parallax), which is skipped under «reduce motion». */
function riseProps(play: boolean, order: number) {
  if (!play) return {};
  return {
    initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
    transition: { ...spring.settle, delay: 0.12 + order * 0.05 },
  };
}

function Greeting({ text, play }: { text: string; play: boolean }) {
  if (!play) return <h2 className="hv3-greeting">{text}</h2>;
  return (
    <h2 className="hv3-greeting" aria-label={text}>
      {text.split(' ').map((word, index) => (
        <m.span
          key={`${word}-${index}`}
          aria-hidden="true"
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
          initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ ...spring.settle, delay: 0.25 + index * 0.07 }}
        >
          {index ? ` ${word}` : word}
        </m.span>
      ))}
    </h2>
  );
}

/** Today is someone's birthday: the cake wobbles, light sweeps the card, and
    gold confetti bursts once per day. */
function BirthdayToday({ children, order, play, dayKey }: { children: ReactNode; order: number; play: boolean; dayKey: string }) {
  const burst = useFirstTime(`bday-${dayKey}`, 'day');
  return (
    <MLink to="/staff" className="hv3-bday is-today tm-sheen" {...riseProps(play, order)}>
      <m.span
        className="hv3-bday-icon"
        aria-hidden="true"
        style={{ position: 'relative', overflow: 'visible' }}
        initial={burst ? { rotate: 0, scale: 0.8 } : false}
        animate={{ rotate: [0, -14, 11, -7, 4, 0], scale: 1 }}
        transition={{ duration: 0.9, delay: 0.45, ease: 'easeInOut' }}
      >
        <Cake size={20} />
        {burst ? <GoldBurst /> : null}
      </m.span>
      {children}
    </MLink>
  );
}

/* ---------- data shapes (existing APIs, unchanged) ---------- */

interface ScheduleStaff {
  id: string;
  name: string;
  role: string;
  role2: string | null;
  avatar: string | null;
}

interface ScheduleBootstrapResponse {
  ok: true;
  me: { legacyUserId: string };
  users: ScheduleStaff[];
  entries: { user_id: string; date: string; shift: string | null }[];
}

interface BirthdayPerson {
  id: number;
  full_name: string;
  birthday_month: number | null;
  birthday_day: number | null;
  user_id?: string | null;
}

interface TodayReservation {
  id: number;
  time: string;
  durationMinutes: number;
  guests: number;
  guestName: string;
  note: string | null;
  menuNote: string | null;
  status: 'booked' | 'occupied';
  tableLabel: string;
  mergedTables: string[];
}

interface TodayReservationsResponse {
  ok: true;
  canView: boolean;
  publication: boolean;
  reservations: TodayReservation[];
}

interface TodayCashResponse {
  ok: true;
  date: string;
  canUseCash: boolean;
  entry: { cash: number | string | null; tips: number | string | null } | null;
}

type Phase = 'off' | 'before' | 'during' | 'after';

/* ---------- rules ---------- */

const SHIFT_END = 22 * 60;
const NEXT_DAY_CUTOFF_HOUR = 13;
const WEEKDAY_IN = ['у неділю', 'у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у пʼятницю', 'у суботу'];
const MONTHS_GENITIVE = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

function isWorkingShift(code: string | null | undefined): boolean {
  return Boolean(code && !['Х', 'О'].includes(code));
}

/** Shift hours confirmed by the owner: breakfasts (СН) start at 11:00, every other working code at 12:00; all end at 22:00. */
function shiftStart(code: string): number {
  return code === 'СН' || code === 'СН/Б' ? 11 * 60 : 12 * 60;
}

function kyivClock(date: Date): { minutes: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return { minutes: hour * 60 + minute, hour };
}

function hhmm(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours} год ${rest} хв`;
  if (hours) return `${hours} год`;
  return `${rest} хв`;
}

function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброго ранку';
  if (hour >= 12 && hour < 18) return 'Добрий день';
  return 'Добрий вечір';
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '—';
}

/** Days from today (Kyiv date key) to the next occurrence of month/day, on the real calendar.
    A 29 February birthday falls on 1 March in non-leap years. */
function daysUntilBirthday(month: number, day: number, todayKey: string): number {
  const year = Number(todayKey.slice(0, 4));
  const today = Date.UTC(year, Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10)));
  const occurrence = (y: number) => Date.UTC(y, month - 1, day);
  const next = occurrence(year) >= today ? occurrence(year) : occurrence(year + 1);
  return Math.round((next - today) / 86_400_000);
}

function nextMonthKey(todayKey: string): string {
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7));
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Ukrainian vocative for a first name; names it cannot decline (Latin, nicknames) stay as they are. */
function vocative(name: string): string {
  if (!/^[А-ЯЇІЄҐа-яїієґʼ'-]+$/.test(name) || name.length < 3) return name;
  const lower = name.toLowerCase();
  if (lower.endsWith('ія')) return `${name.slice(0, -1)}є`;
  if (lower.endsWith('я')) return `${name.slice(0, -1)}ю`;
  if (lower.endsWith('а')) return `${name.slice(0, -1)}о`;
  if (lower.endsWith('й')) return `${name.slice(0, -1)}ю`;
  if (lower.endsWith('о')) return `${name.slice(0, -1)}е`;
  if (/[бвгґджзклмнпрстфхцчшщ]$/.test(lower)) return `${name}е`;
  return name;
}

function whenLabel(days: number, todayKey: string): string {
  if (days === 0) return 'Сьогодні';
  if (days === 1) return 'Завтра';
  const date = new Date(`${addDaysToDateKey(todayKey, days)}T12:00:00`);
  if (days < 7) return WEEKDAY_IN[date.getDay()] || '';
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** «Завтра, 11 листопада» / «У неділю, 15 листопада»; from a week out the date alone already says it. */
function birthdayWhen(days: number, todayKey: string): string {
  const when = whenLabel(days, todayKey).replace(/^у /, 'У ');
  if (days >= 7) return when;
  const date = new Date(`${addDaysToDateKey(todayKey, days)}T12:00:00`);
  return `${when}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

function capitalize(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}

function amount(value: number | string | null | undefined): string {
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Number(value || 0))} ₴`;
}

/* ---------- page ---------- */

export function DashboardPage() {
  const { user } = useAuth();
  const todayKey = useKyivDay();
  const intro = useFirstTime('home-intro');
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const mastY = useTransform(scrollY, [0, 260], [0, 78]);
  const mastFade = useTransform(scrollY, [0, 220], [1, 0.2]);
  const mastScale = useTransform(scrollY, [0, 260], [1, 0.94]);
  const parallax = reduceMotion ? undefined : { y: mastY, opacity: mastFade, scale: mastScale, transformOrigin: '0 0' };
  const tomorrowKey = useMemo(() => addDaysToDateKey(todayKey, 1), [todayKey]);
  const [now, setNow] = useState(() => new Date());
  const clock = kyivClock(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const roles = useMemo(() => new Set([user?.role, user?.role2].filter(Boolean) as string[]), [user?.role, user?.role2]);
  const isWaiter = roles.has('waiter');
  const canCash = roles.has('waiter') || roles.has('bar') || roles.has('admin') || roles.has('sysadmin');

  // Returning to Home paints the last known day at once (see peekSecureApi);
  // load() below refreshes every piece in the background.
  const [schedule, setSchedule] = useState<ScheduleBootstrapResponse | null>(() => peekSecureApi({ action: 'schedule_bootstrap', month: todayKey.slice(0, 7) }));
  const [nextMonthSchedule, setNextMonthSchedule] = useState<ScheduleBootstrapResponse | null>(() => peekSecureApi({ action: 'schedule_bootstrap', month: nextMonthKey(todayKey) }));
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>(() => peekSecureApi<{ ok: true; people: BirthdayPerson[] }>({ action: 'birthdays_bootstrap' }, 'tiflis-staff-api')?.people || []);
  const [daily, setDaily] = useState<DutyPlanResponse | null>(() => peekSecureApi({ action: 'planner_bootstrap', plan_type: 'daily', date: todayKey }, 'tiflis-duty-planner-api'));
  const [handover, setHandover] = useState<DutyPlanResponse | null>(null);
  const [tomorrowPlan, setTomorrowPlan] = useState<DutyPlanResponse | null>(null);
  const [reservations, setReservations] = useState<TodayReservationsResponse | null>(() => peekSecureApi({ action: 'today_reservations_get' }, 'tiflis-today-reserve-api'));
  const [todayCash, setTodayCash] = useState<TodayCashResponse | null>(() => peekSecureApi({ action: 'today_cash_get' }, 'tiflis-today-cash-api'));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [savingTask, setSavingTask] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const problems: string[] = [];
    const isTuesday = isKyivWeekday(todayKey, 2);
    const pastCutoff = kyivClock(new Date()).hour >= NEXT_DAY_CUTOFF_HOUR;
    await Promise.all([
      secureApi<ScheduleBootstrapResponse>({ action: 'schedule_bootstrap', month: todayKey.slice(0, 7) })
        .then(setSchedule).catch(() => problems.push('графік')),
      // Late in the month the next shift is often in next month's schedule; a missing one is not an error.
      Number(todayKey.slice(8, 10)) >= 15
        ? secureApi<ScheduleBootstrapResponse>({ action: 'schedule_bootstrap', month: nextMonthKey(todayKey) })
          .then(setNextMonthSchedule).catch(() => setNextMonthSchedule(null))
        : Promise.resolve(setNextMonthSchedule(null)),
      secureApi<{ ok: true; people: BirthdayPerson[] }>({ action: 'birthdays_bootstrap' }, 'tiflis-staff-api')
        .then((response) => setBirthdays(response.people || [])).catch(() => problems.push('дні народження')),
      loadDutyPlan('daily', todayKey).then(setDaily).catch(() => problems.push('обовʼязки')),
      isTuesday ? loadDutyPlan('handover', todayKey).then(setHandover).catch(() => undefined) : Promise.resolve(),
      pastCutoff ? loadDutyPlan('daily', tomorrowKey).then(setTomorrowPlan).catch(() => undefined) : Promise.resolve(),
      isWaiter
        ? secureApi<TodayReservationsResponse>({ action: 'today_reservations_get' }, 'tiflis-today-reserve-api', { cacheTtlMs: 15_000 })
          .then(setReservations).catch(() => problems.push('резерви'))
        : Promise.resolve(),
      canCash
        ? secureApi<TodayCashResponse>({ action: 'today_cash_get' }, 'tiflis-today-cash-api')
          .then(setTodayCash).catch(() => problems.push('каса'))
        : Promise.resolve(),
    ]);
    setFailed(problems);
    setLoading(false);
  }, [canCash, isWaiter, todayKey, tomorrowKey]);

  useEffect(() => { void load(); }, [load]);

  /* derived: my shift and phase */
  const meId = schedule?.me.legacyUserId || user?.id || '';
  const codeByUserToday = useMemo(() => {
    const map = new Map<string, string>();
    schedule?.entries.forEach((entry) => {
      if (entry.date === todayKey && entry.shift) map.set(entry.user_id, entry.shift);
    });
    return map;
  }, [schedule, todayKey]);
  const myCode = codeByUserToday.get(meId) || '';
  const working = isWorkingShift(myCode);
  const start = working ? shiftStart(myCode) : 0;
  const phase: Phase = !working ? 'off' : clock.minutes < start ? 'before' : clock.minutes < SHIFT_END ? 'during' : 'after';

  const nextShift = useMemo(() => {
    if (!schedule) return null;
    return [...schedule.entries, ...(nextMonthSchedule?.entries || [])]
      .filter((entry) => entry.user_id === meId && entry.date > todayKey && isWorkingShift(entry.shift))
      .sort((left, right) => left.date.localeCompare(right.date))[0] || null;
  }, [meId, nextMonthSchedule, schedule, todayKey]);

  const team = useMemo(() => {
    if (!schedule) return [];
    return schedule.users
      .filter((person) => isWorkingShift(codeByUserToday.get(person.id)))
      .sort((left, right) => (left.id === meId ? -1 : right.id === meId ? 1 : left.name.localeCompare(right.name, 'uk')));
  }, [codeByUserToday, meId, schedule]);
  const colleagues = team.filter((person) => person.id !== meId).length;

  /* birthdays: nearest upcoming, the viewer's own only on the day itself */
  const birthday = useMemo(() => {
    const dated = birthdays
      .filter((person) => person.birthday_month && person.birthday_day)
      .map((person) => ({ person, days: daysUntilBirthday(person.birthday_month!, person.birthday_day!, todayKey) }));
    const mine = dated.find((item) => item.person.user_id && item.person.user_id === meId && item.days === 0) || null;
    const others = dated.filter((item) => !(item.person.user_id && item.person.user_id === meId));
    const nearest = Math.min(...others.map((item) => item.days));
    const people = others.filter((item) => item.days === nearest).map((item) => item.person.full_name);
    return { mine: Boolean(mine), days: Number.isFinite(nearest) ? nearest : null, people };
  }, [birthdays, meId, todayKey]);

  /* duties */
  const myDaily = daily?.publication ? daily.assignments.filter((item) => item.assignee_id === daily.me.id) : [];
  const myHandover = handover?.publication ? handover.assignments.filter((item) => item.assignee_id === handover.me.id) : [];
  const myTasks = [...myDaily, ...myHandover];
  const titleOf = (task: DutyAssignment) => {
    const plan = myDaily.includes(task) ? daily : handover;
    return plan?.definitions.find((item) => item.key === task.duty_key)?.title || task.duty_key;
  };
  const doneCount = myTasks.filter((task) => task.status === 'done').length;
  const zones = daily?.publication
    ? daily.zoneAssignments
      .filter((item) => item.assignee_id === daily.me.id)
      .map((item) => daily.zones.find((zone) => zone.key === item.zone_key)?.title || item.zone_key)
    : [];
  // Bookings the admin attached to my zones (Кабінки 1–5, банкети в залах).
  const myZoneKeys = new Set(daily?.publication
    ? daily.zoneAssignments.filter((item) => item.assignee_id === daily.me.id).map((item) => item.zone_key)
    : []);
  const zoneBookings = daily?.publication
    ? (daily.zoneBookings || []).filter((booking) => myZoneKeys.has(booking.zone_key))
    : [];
  const tomorrowTasks = tomorrowPlan?.publication ? tomorrowPlan.assignments.filter((item) => item.assignee_id === tomorrowPlan.me.id) : [];
  const tomorrowZones = tomorrowPlan?.publication
    ? tomorrowPlan.zoneAssignments.filter((item) => item.assignee_id === tomorrowPlan.me.id)
      .map((item) => tomorrowPlan.zones.find((zone) => zone.key === item.zone_key)?.title || item.zone_key)
    : [];

  async function toggleTask(task: DutyAssignment) {
    const next = task.status === 'done' ? 'pending' : 'done';
    setSavingTask(task.id);
    try {
      const response = await setPlannedDutyStatus(task.id, next);
      const status = response.assignment.status;
      const patch = (plan: DutyPlanResponse | null) => plan && ({
        ...plan,
        assignments: plan.assignments.map((item) => (item.id === task.id ? { ...item, status } : item)),
      });
      setDaily(patch);
      setHandover(patch);
    } catch {
      setFailed((current) => [...new Set([...current, 'статус обовʼязку'])]);
    } finally {
      setSavingTask(null);
    }
  }

  /* reservations */
  const reservationList = reservations?.canView && reservations.publication ? [...reservations.reservations].sort((a, b) => a.time.localeCompare(b.time)) : [];
  const guests = reservationList.reduce((sum, item) => sum + item.guests, 0);

  const rawFirstName = user?.displayName.trim().split(/\s+/)[0];
  const firstName = rawFirstName ? vocative(rawFirstName) : 'колего';
  const dateLabel = capitalize(new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', weekday: 'long', day: 'numeric', month: 'long' }).format(now));
  const zoneText = zones.length ? zones.join(' · ') : null;

  return (
    <div className="hv3">
      <header className="hv3-mast">
        <m.div className="hv3-mast-inner" style={parallax}>
          <div className="hv3-mast-row">
            <m.img
              src={charcoalWordmark}
              alt="Tiflis restaurant"
              width={150}
              height={95}
              initial={intro ? { clipPath: 'inset(0 100% 0 0)', filter: 'blur(4px)' } : false}
              animate={{ clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)' }}
              transition={{ duration: 0.95, ease: [0.77, 0, 0.175, 1], delay: 0.05 }}
            />
            <m.p className="hv3-mast-date" {...riseProps(intro, 1)}>{dateLabel}<b>{hhmm(clock.minutes)}</b></m.p>
          </div>
          <Greeting play={intro} text={birthday.mine ? `З днем народження, ${firstName}!` : `${greetingFor(clock.hour)}, ${firstName}`} />
        </m.div>
      </header>

      <m.section className="hv3-shift" {...riseProps(intro, 2)}>
        <ShiftSummary
          phase={phase}
          code={myCode}
          start={start}
          nowMinutes={clock.minutes}
          zoneText={zoneText}
          nextShift={nextShift}
          todayKey={todayKey}
          loading={loading && !schedule}
          marks={reservationList.map((item) => timeToMinutes(item.time))}
          cashPending={canCash && !todayCash?.entry}
        />
        {team.length ? (
          <Link to="/schedule" className="hv3-team">
            <span className="hv3-faces" aria-hidden="true">
              {team.slice(0, 5).map((person) => (
                <span key={person.id} className={`hv3-face${person.id === meId ? ' is-me' : ''}`}>
                  <span>{initials(person.name)}</span>
                  {person.avatar ? <img src={person.avatar} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
                </span>
              ))}
              {team.length > 5 ? <span className="hv3-face is-more">+{team.length - 5}</span> : null}
            </span>
            <span className="hv3-team-text">
              {working ? `Сьогодні з тобою ${colleagues} ${peopleWord(colleagues)}` : `Сьогодні працюють ${team.length} ${peopleWord(team.length)}`}
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ) : null}
      </m.section>

      {birthday.days === 0 && birthday.people.length ? (
        <BirthdayToday order={3} play={intro} dayKey={todayKey}>
          <span>
            <strong>{birthdayWhen(birthday.days, todayKey)} — день народження</strong>
            <small>{birthday.people.join(', ')}</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </BirthdayToday>
      ) : birthday.days !== null && birthday.people.length ? (
        <MLink to="/staff" className="hv3-bday" {...riseProps(intro, 3)}>
          <span className="hv3-bday-icon" aria-hidden="true"><Cake size={20} /></span>
          <span>
            <strong>{birthdayWhen(birthday.days, todayKey)} — день народження</strong>
            <small>{birthday.people.join(', ')}</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </MLink>
      ) : null}

      {working || myTasks.length || reservationList.length ? (
        <m.div className="hv3-pulse" role="list" {...riseProps(intro, 4)}>
          {isWaiter ? <Pulse label={reservationWord(reservationList.length)} value={String(reservationList.length)} /> : null}
          {isWaiter ? <Pulse label={guestWord(guests)} value={String(guests)} /> : null}
          <Pulse label="обовʼязки" value={myTasks.length ? `${doneCount}/${myTasks.length}` : '—'} />
          <Pulse label="на зміні" value={String(team.length)} />
        </m.div>
      ) : null}

      {failed.length ? (
        <div className="hv3-alert" role="alert">
          <span>Не вдалося завантажити: {failed.join(', ')}.</span>
          <button type="button" onClick={() => void load()}>Спробувати ще раз</button>
        </div>
      ) : null}

      {phase === 'after' && canCash ? (
        <CloseShift todayKey={todayKey} cash={todayCash} onSaved={setTodayCash} />
      ) : null}

      {working ? (
        <m.section className="hv3-feed" aria-label="Мій день" {...riseProps(intro, 5)}>
          <FeedItem time={hhmm(start)} past={clock.minutes >= start} title={phase === 'before' ? 'Початок зміни · підготовка' : 'Початок зміни'}>
            {myTasks.length ? (
              <div className="hv3-tasks">
                {myTasks.map((task) => (
                  <button key={task.id} type="button" className={`hv3-task${task.status === 'done' ? ' is-done' : ''}`} onClick={() => void toggleTask(task)} disabled={savingTask === task.id} role="checkbox" aria-checked={task.status === 'done'}>
                    <span className="hv3-box" aria-hidden="true">{savingTask === task.id ? <RefreshCw size={12} className="hv3-spin" /> : task.status === 'done' ? <Check size={13} /> : null}</span>
                    <span>{titleOf(task)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <small>{daily?.publication ? 'Особистих обовʼязків немає' : 'Розподіл обовʼязків ще не опубліковано'}</small>
            )}
          </FeedItem>

          {[
            ...reservationList.map((item) => {
              const at = timeToMinutes(item.time);
              const tables = [item.tableLabel, ...item.mergedTables].filter(Boolean);
              return {
                at,
                key: `r-${item.id}`,
                node: (
                  <FeedItem key={`r-${item.id}`} time={item.time.slice(0, 5)} past={clock.minutes >= at + item.durationMinutes} title={`${tables.length > 1 ? 'Столи' : 'Стіл'} ${tables.join(' + ')} · ${item.guests} ${guestWord(item.guests)}`}>
                    {item.note || item.menuNote ? <small>{[item.note, item.menuNote].filter(Boolean).join(' · ')}</small> : null}
                    {item.status === 'occupied' ? <span className="hv3-tag">гості вже за столом</span> : null}
                  </FeedItem>
                ),
              };
            }),
            ...zoneBookings.map((booking) => {
              const at = timeToMinutes(booking.booked_time);
              const place = booking.slot > 0 ? `Кабінка ${booking.slot}` : daily?.zones.find((zone) => zone.key === booking.zone_key)?.title || 'Банкет';
              const key = `b-${booking.zone_key}-${booking.slot}`;
              return {
                at,
                key,
                node: (
                  <FeedItem key={key} time={booking.booked_time.slice(0, 5)} past={clock.minutes >= at + 120} title={`${place} · ${booking.guests} ${guestWord(booking.guests)}`}>
                    <small>{[booking.guest_name, booking.has_menu ? 'з меню' : 'без меню', typeof booking.advance === 'number' ? `аванс ${booking.advance.toLocaleString('uk-UA')} ₴` : null].filter(Boolean).join(' · ')}</small>
                  </FeedItem>
                ),
              };
            }),
            ...(phase === 'during' ? [{ at: clock.minutes + 0.5, key: 'now', node: <NowMarker key="now" minutes={clock.minutes} /> }] : []),
          ].sort((left, right) => left.at - right.at).map((item) => item.node)}

          <FeedItem time={hhmm(SHIFT_END)} past={phase === 'after'} title="Кінець зміни" last>
            <small>{canCash ? (phase !== 'after' ? 'Після 22:00 — внесення каси' : todayCash?.entry ? 'Касу внесено' : 'Внеси касу за сьогодні') : 'Гарного вечора'}</small>
          </FeedItem>
        </m.section>
      ) : null}

      {tomorrowPlan?.publication && (tomorrowTasks.length || tomorrowZones.length) ? (
        <MLink to="/duties" className="hv3-tomorrow" {...riseProps(intro, 6)}>
          <span>
            <strong>Завтра{tomorrowZones.length ? ` · ${tomorrowZones.join(' · ')}` : ''}</strong>
            <small>{tomorrowTasks.length ? `${tomorrowTasks.length} ${taskWord(tomorrowTasks.length)} вже розподілено` : 'Зону вже призначено'}</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </MLink>
      ) : null}
    </div>
  );
}

/* ---------- pieces ---------- */

function ShiftSummary({
  phase, code, start, nowMinutes, zoneText, nextShift, todayKey, loading, marks, cashPending,
}: {
  phase: Phase;
  code: string;
  start: number;
  nowMinutes: number;
  zoneText: string | null;
  nextShift: { date: string; shift: string | null } | null;
  todayKey: string;
  loading: boolean;
  marks: number[];
  cashPending: boolean;
}) {
  if (loading) return <div className="hv3-shift-card is-loading" aria-label="Завантажуємо зміну" />;

  if (phase === 'off') {
    const days = nextShift ? Math.round((Date.parse(`${nextShift.date}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`)) / 86_400_000) : null;
    return (
      <div className="hv3-shift-card">
        <div className="hv3-shift-row"><strong>Сьогодні вихідний</strong></div>
        <p className="hv3-shift-sub">
          {nextShift && days !== null
            ? `Наступна зміна ${whenLabel(days, todayKey).toLowerCase()} о ${hhmm(shiftStart(nextShift.shift || ''))}`
            : 'Наступну зміну ще не поставили в графік'}
        </p>
      </div>
    );
  }

  const span = SHIFT_END - start;
  const progress = Math.min(1, Math.max(0, (nowMinutes - start) / span));
  const headline = phase === 'before' ? `Зміна о ${hhmm(start)}` : phase === 'during' ? `Зміна до ${hhmm(SHIFT_END)}` : 'Зміну завершено';
  const aside = phase === 'before' ? `через ${duration(start - nowMinutes)}` : phase === 'during' ? `ще ${duration(SHIFT_END - nowMinutes)}` : cashPending ? 'чекає на касу' : '';

  return (
    <div className="hv3-shift-card">
      <div className="hv3-shift-row"><strong>{headline}</strong>{aside ? <span>{aside}</span> : null}</div>
      <div className="hv3-track" aria-hidden="true">
        <m.span
          className="hv3-track-fill"
          style={{ width: `${progress * 100}%`, transformOrigin: '0 50%' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
        />
        {marks.filter((mark) => mark >= start && mark <= SHIFT_END).map((mark, index) => (
          <span key={`${mark}-${index}`} className="hv3-track-mark" style={{ left: `${((mark - start) / span) * 100}%` }} />
        ))}
        {phase === 'during' ? (
          <m.span
            className="hv3-track-now"
            style={{ left: `${progress * 100}%` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring.pop, delay: 0.85 }}
          />
        ) : null}
      </div>
      <div className="hv3-track-ticks"><span><b className={`hv3-code${code.startsWith('СН') ? ' is-breakfast' : ''}`}>{code}</b> {hhmm(start)}–{hhmm(SHIFT_END)}</span>{zoneText ? <span>{zoneText}</span> : null}</div>
    </div>
  );
}

function FeedItem({ time, title, past, last = false, children }: { time: string; title: string; past: boolean; last?: boolean; children?: ReactNode }) {
  return (
    <div className={`hv3-ev${past ? ' is-past' : ''}${last ? ' is-last' : ''}`}>
      <span className="hv3-ev-time">{time}</span>
      <span className="hv3-ev-rail" aria-hidden="true"><i /></span>
      <div className="hv3-ev-body"><strong>{title}</strong>{children}</div>
    </div>
  );
}

function NowMarker({ minutes }: { minutes: number }) {
  return (
    <div className="hv3-ev is-now">
      <span className="hv3-ev-time">{hhmm(minutes)}</span>
      <span className="hv3-ev-rail" aria-hidden="true"><i /></span>
      <div className="hv3-ev-body"><strong>Зараз</strong></div>
    </div>
  );
}

function Pulse({ label, value }: { label: string; value: string }) {
  return (
    <div className="hv3-pulse-item" role="listitem">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function CloseShift({ todayKey, cash, onSaved }: { todayKey: string; cash: TodayCashResponse | null; onSaved: (next: TodayCashResponse) => void }) {
  const entered = Number(cash?.entry?.cash || 0) > 0;
  const [cashValue, setCashValue] = useState('');
  const [tips, setTips] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cash?.canUseCash) return null;

  if (entered) {
    return (
      <Link to="/cash" className="hv3-close is-done">
        <span>
          <strong>Касу за сьогодні внесено</strong>
          <small>{amount(cash.entry?.cash)}{Number(cash.entry?.tips || 0) > 0 ? ` · чайові ${amount(cash.entry?.tips)}` : ''}</small>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!cashValue) return;
    setSaving(true);
    setError(null);
    try {
      const response = await secureApi<TodayCashResponse>({ action: 'today_cash_save', date: todayKey, cash: cashValue, tips }, 'tiflis-today-cash-api');
      onSaved(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Касу не збережено. Спробуй ще раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="hv3-close" onSubmit={(event) => void save(event)}>
      <strong>Закрий зміну: внеси касу</strong>
      <div className="hv3-close-fields">
        <label><span>Каса</span><span className="hv3-money"><input inputMode="decimal" type="number" min="0" placeholder="0" value={cashValue} onChange={(event) => setCashValue(event.target.value)} /><b>₴</b></span></label>
        <label><span>Чайові</span><span className="hv3-money"><input inputMode="decimal" type="number" min="0" placeholder="0" value={tips} onChange={(event) => setTips(event.target.value)} /><b>₴</b></span></label>
      </div>
      {error ? <p className="hv3-close-error" role="alert">{error}</p> : null}
      <button type="submit" disabled={saving || !cashValue}>{saving ? <RefreshCw size={17} className="hv3-spin" /> : <Check size={17} />} Зберегти касу</button>
    </form>
  );
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const peopleWord = (count: number) => plural(count, 'людина', 'людини', 'людей');
const guestWord = (count: number) => plural(count, 'гість', 'гості', 'гостей');
const reservationWord = (count: number) => plural(count, 'резерв', 'резерви', 'резервів');
const taskWord = (count: number) => plural(count, 'обовʼязок', 'обовʼязки', 'обовʼязків');
