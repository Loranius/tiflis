import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canPerform } from '../lib/acl';
import { secureApi } from '../lib/secureApi';
import './schedule.css';

type ShiftCode = '' | 'Р' | 'Х' | 'О' | 'СН' | 'Б' | 'С' | 'Р/Б' | 'СН/Б' | 'Д';
type Scope = 'team' | 'mine';
type ShiftTone = 'work' | 'off' | 'leave' | 'breakfast' | 'bar' | 'mixed' | 'neutral';

interface ShiftDefinition {
  code: ShiftCode;
  label: string;
  tone: ShiftTone;
}

interface ScheduleStaff {
  id: string;
  name: string;
  role: string;
  role2: string | null;
  avatar: string | null;
}

interface ScheduleEntry {
  user_id: string;
  date: string;
  shift: ShiftCode | null;
}

interface ScheduleBootstrapResponse {
  ok: true;
  month: string;
  me: { legacyUserId: string; canEditAll: boolean };
  users: ScheduleStaff[];
  entries: ScheduleEntry[];
  orders: Record<string, string[]>;
  shiftTypes: { waiter: ShiftDefinition[]; default: ShiftDefinition[] };
}

interface ScheduleSaveResponse {
  ok: true;
  saved: { user_id: string; date: string; shift: ShiftCode };
}

interface PickerState {
  staff: ScheduleStaff;
  date: string;
  value: ShiftCode;
  anchor: { left: number; top: number };
}

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const DOW = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністрація', waiter: 'Офіціанти', bar: 'Бар', chef: 'Шеф-кухарі', cook: 'Кухня',
  hostess: 'Хостес', runner: 'Ранери', sommelier: 'Сомельє', staff: 'Команда',
};
const PERSON_ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністратор', sysadmin: 'Системний адміністратор', waiter: 'Офіціант',
  bar: 'Бармен', chef: 'Шеф-кухар', cook: 'Кухар', hostess: 'Хостес',
  runner: 'Ранер', sommelier: 'Сомельє', trainee: 'Стажер', staff: 'Працівник',
};

function normalizeRole(value: string | null | undefined): string {
  if (value === 'barman' || value === 'bartender') return 'bar';
  return value || 'staff';
}

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonth(value: string): Date {
  const [yearText = '', monthText = ''] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return new Date(year, month - 1, 1);
}

function moveMonth(value: string, offset: number): string {
  const date = parseMonth(value);
  date.setMonth(date.getMonth() + offset);
  return monthKey(date);
}

function dateForDay(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

function cellKey(userId: string, date: string): string {
  return `${userId}|${date}`;
}

function staffRoles(staff: ScheduleStaff): string[] {
  return [normalizeRole(staff.role), normalizeRole(staff.role2)].filter(
    (role, index, all) => Boolean(role) && all.indexOf(role) === index,
  );
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function staffRoleTitle(staff: ScheduleStaff): string {
  const roles = staffRoles(staff);
  if (roles.includes('waiter') && roles.includes('bar')) return 'Бармен-офіціант';
  if (roles.includes('waiter') && roles.includes('sommelier')) return 'Сомельє-офіціант';
  if (roles.includes('waiter') && roles.includes('hostess')) return 'Хостес-офіціант';
  if (roles.includes('waiter') && roles.includes('runner')) return 'Ранер-офіціант';
  return roles.map((role) => PERSON_ROLE_LABELS[role] || role).join(' · ') || 'Працівник';
}

function isWorkingShift(code: ShiftCode | null | undefined): boolean {
  return Boolean(code && !['Х', 'О'].includes(code));
}

function shiftTone(code: ShiftCode, definitions: ShiftDefinition[]): ShiftTone {
  return definitions.find((item) => item.code === code)?.tone || 'neutral';
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export function SchedulePage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<ScheduleBootstrapResponse | null>(null);
  const [activeRole, setActiveRole] = useState('waiter');
  const [scope, setScope] = useState<Scope>('team');
  const [entries, setEntries] = useState<Record<string, ShiftCode>>({});
  const [saving, setSaving] = useState<Set<string>>(() => new Set());
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    void secureApi<ScheduleBootstrapResponse>({ action: 'schedule_bootstrap', month })
      .then((response) => {
        if (requestId.current !== id) return;
        const nextEntries: Record<string, ShiftCode> = {};
        response.entries.forEach((entry) => { nextEntries[cellKey(entry.user_id, entry.date)] = entry.shift || ''; });
        setData(response);
        setEntries(nextEntries);
        const roles = Array.from(new Set(response.users.flatMap(staffRoles)));
        const preferred = user
          ? [normalizeRole(user.role), normalizeRole(user.role2)].find((role) => roles.includes(role))
          : null;
        setActiveRole((current) => roles.includes(current) ? current : preferred || roles[0] || 'waiter');
      })
      .catch((reason: unknown) => {
        if (requestId.current !== id) return;
        setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити графік.');
      })
      .finally(() => { if (requestId.current === id) setLoading(false); });
  }, [month, user]);

  useEffect(() => () => {
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
  }, []);

  const monthDate = useMemo(() => parseMonth(month), [month]);
  const days = useMemo(
    () => Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1),
    [monthDate],
  );
  const currentDate = todayIso();

  const roles = useMemo(() => {
    if (!data) return [] as [string, number][];
    const counts = new Map<string, number>();
    data.users.forEach((staff) => staffRoles(staff).forEach((role) => counts.set(role, (counts.get(role) || 0) + 1)));
    const order = ['waiter', 'bar', 'hostess', 'runner', 'cook', 'chef', 'sommelier', 'admin'];
    return [...counts.entries()].sort(([a], [b]) => {
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return roleLabel(a).localeCompare(roleLabel(b), 'uk');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [data]);

  const visibleStaff = useMemo(() => {
    if (!data) return [];
    let staff = data.users.filter((person) => staffRoles(person).includes(activeRole));
    const order = data.orders[activeRole] || [];
    if (order.length) {
      const index = new Map(order.map((id, position) => [id, position]));
      staff = [...staff].sort((a, b) => {
        const ai = index.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bi = index.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return ai === bi ? a.name.localeCompare(b.name, 'uk') : ai - bi;
      });
    }
    return scope === 'mine' ? staff.filter((person) => person.id === data.me.legacyUserId) : staff;
  }, [activeRole, data, scope]);

  const shiftDefinitions = useMemo(() => {
    if (!data) return [];
    return activeRole === 'waiter' ? data.shiftTypes.waiter : data.shiftTypes.default;
  }, [activeRole, data]);

  const metrics = useMemo(() => {
    if (!data) return { today: 0, planned: 0, mine: 0 };
    let today = 0, planned = 0, mine = 0;
    visibleStaff.forEach((staff) => days.forEach((day) => {
      const date = dateForDay(month, day);
      const code = entries[cellKey(staff.id, date)] || '';
      if (isWorkingShift(code)) planned += 1;
      if (date === currentDate && isWorkingShift(code)) today += 1;
      if (staff.id === data.me.legacyUserId && isWorkingShift(code)) mine += 1;
    }));
    return { today, planned, mine };
  }, [currentDate, data, days, entries, month, visibleStaff]);

  const canEditAll = data?.me.canEditAll || (user ? canPerform(user, 'editSchedule') : false);
  const canEditOwn = user ? canPerform(user, 'editOwnShift') : false;
  const canEditStaff = (staff: ScheduleStaff) => Boolean(data && (canEditAll || (canEditOwn && staff.id === data.me.legacyUserId)));

  function openPicker(staff: ScheduleStaff, date: string, target: HTMLButtonElement) {
    if (!canEditStaff(staff)) return;
    const rect = target.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    const preferredTop = rect.bottom + 8;
    const top = Math.max(12, Math.min(window.innerHeight - 330, preferredTop));
    setPicker({ staff, date, value: entries[cellKey(staff.id, date)] || '', anchor: { left, top } });
  }

  async function applyShift(code: ShiftCode) {
    if (!picker) return;
    const key = cellKey(picker.staff.id, picker.date);
    const previous = entries[key] || '';
    if (previous === code) { setPicker(null); return; }
    setEntries((current) => ({ ...current, [key]: code }));
    setSaving((current) => new Set(current).add(key));
    setPicker(null);
    setError(null);
    try {
      await secureApi<ScheduleSaveResponse>({ action: 'schedule_upsert', user_id: picker.staff.id, date: picker.date, shift: code });
      setSavedKey(key);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSavedKey(null), 1500);
    } catch (reason) {
      setEntries((current) => ({ ...current, [key]: previous }));
      setError(reason instanceof Error ? reason.message : 'Зміну не збережено.');
    } finally {
      setSaving((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }

  return (
    <div className="schedule-page-v2">
      <section className="schedule-hero-v2">
        <div className="schedule-hero-copy">
          <span className="eyebrow">Живий модуль</span>
          <h2>Графік команди</h2>
          <p>Місячний розклад із швидким редагуванням, персональним режимом і миттєвим збереженням через захищений серверний API.</p>
        </div>
        <div className="schedule-hero-mark" aria-hidden="true"><CalendarDays size={34} /></div>
      </section>

      <section className="schedule-toolbar-v2" aria-label="Навігація графіком">
        <div className="schedule-month-nav">
          <button className="schedule-icon-button" type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="Попередній місяць"><ChevronLeft size={20} /></button>
          <div className="schedule-month-title"><span>{MONTHS[monthDate.getMonth()]}</span><strong>{monthDate.getFullYear()}</strong></div>
          <button className="schedule-icon-button" type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="Наступний місяць"><ChevronRight size={20} /></button>
          <button className="schedule-today-button" type="button" onClick={() => setMonth(monthKey(new Date()))}>Сьогодні</button>
        </div>
        <div className="schedule-scope-switch" role="group" aria-label="Режим перегляду">
          <button type="button" className={scope === 'team' ? 'is-active' : ''} onClick={() => setScope('team')}><UsersRound size={16} /> Команда</button>
          <button type="button" className={scope === 'mine' ? 'is-active' : ''} onClick={() => setScope('mine')}><Sparkles size={16} /> Мій рядок</button>
        </div>
      </section>

      <section className="schedule-metrics-v2" aria-label="Показники графіка">
        <article><UsersRound size={19} /><span>На зміні сьогодні</span><strong>{loading ? '…' : metrics.today}</strong></article>
        <article><Clock3 size={19} /><span>Робочих призначень</span><strong>{loading ? '…' : metrics.planned}</strong></article>
        <article><ShieldCheck size={19} /><span>Мої зміни за місяць</span><strong>{loading ? '…' : metrics.mine}</strong></article>
      </section>

      <section className="schedule-board-v2">
        <div className="schedule-role-tabs" role="tablist" aria-label="Підрозділи">
          {roles.map(([role, count]) => (
            <button type="button" role="tab" aria-selected={activeRole === role} className={activeRole === role ? 'is-active' : ''} key={role}
              onClick={() => {
                setActiveRole(role);
                if (scope === 'mine' && data && !data.users.some((staff) => staff.id === data.me.legacyUserId && staffRoles(staff).includes(role))) setScope('team');
              }}>
              {roleLabel(role)} <span>{count}</span>
            </button>
          ))}
        </div>

        {error ? <div className="schedule-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Закрити помилку"><X size={16} /></button></div> : null}
        {loading ? <div className="schedule-loading-v2"><RefreshCw size={24} className="is-spinning" /><span>Збираємо графік…</span></div> : null}
        {!loading && visibleStaff.length === 0 ? (
          <div className="schedule-empty-v2"><UsersRound size={28} /><strong>{scope === 'mine' ? 'У вас немає рядка в цьому підрозділі' : 'У підрозділі немає активних працівників'}</strong><span>Оберіть іншу вкладку або поверніться до режиму команди.</span></div>
        ) : null}

        {!loading && visibleStaff.length > 0 ? (
          <div className="schedule-table-scroll" tabIndex={0} aria-label="Місячна таблиця графіка">
            <table className="schedule-table-v2">
              <thead><tr><th className="schedule-name-column">Працівник</th>{days.map((day) => {
                const date = dateForDay(month, day), dayDate = new Date(`${date}T12:00:00`), weekend = [0, 6].includes(dayDate.getDay());
                return <th key={date} className={`${date === currentDate ? 'is-today' : ''} ${weekend ? 'is-weekend' : ''}`}><span>{day}</span><small>{DOW[dayDate.getDay()]}</small></th>;
              })}</tr></thead>
              <tbody>{visibleStaff.map((staff) => {
                const ownRow = data?.me.legacyUserId === staff.id;
                return <tr key={staff.id} className={ownRow ? 'is-own-row' : ''}>
                  <td className="schedule-name-column"><div className="schedule-person"><span className="schedule-person-avatar">{initials(staff.name)}</span><span className="schedule-person-copy"><strong>{staff.name}</strong><small>{staffRoleTitle(staff)}</small></span>{ownRow ? <span className="schedule-own-badge">Ви</span> : null}</div></td>
                  {days.map((day) => {
                    const date = dateForDay(month, day), key = cellKey(staff.id, date), value = entries[key] || '';
                    const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay()), editable = canEditStaff(staff);
                    return <td key={date} className={`${date === currentDate ? 'is-today' : ''} ${weekend ? 'is-weekend' : ''}`}>
                      <button type="button" className={`schedule-shift-cell tone-${shiftTone(value, shiftDefinitions)} ${editable ? 'is-editable' : ''} ${saving.has(key) ? 'is-saving' : ''} ${savedKey === key ? 'is-saved' : ''}`}
                        onClick={(event) => openPicker(staff, date, event.currentTarget)} disabled={!editable || saving.has(key)}
                        aria-label={`${staff.name}, ${day} ${MONTHS[monthDate.getMonth()]}, ${value || 'не призначено'}${editable ? ', редагувати' : ''}`}>
                        {saving.has(key) ? <RefreshCw size={13} className="is-spinning" /> : savedKey === key ? <Check size={14} /> : value || '·'}
                      </button>
                    </td>;
                  })}
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : null}

        <div className="schedule-legend-v2">{shiftDefinitions.filter((item) => item.code).map((item) => <span key={item.code} className={`tone-${item.tone}`}><b>{item.code}</b> {item.label}</span>)}</div>
      </section>

      {picker ? (
        <div className="schedule-picker-backdrop" role="presentation" onMouseDown={() => setPicker(null)}>
          <section className="schedule-picker-sheet" style={{ left: picker.anchor.left, top: picker.anchor.top }} role="dialog" aria-modal="true" aria-labelledby="schedule-picker-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="schedule-picker-heading"><div><span className="eyebrow">Зміна</span><h3 id="schedule-picker-title">{picker.staff.name}</h3><p>{new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${picker.date}T12:00:00`))}</p></div><button type="button" onClick={() => setPicker(null)} aria-label="Закрити"><X size={19} /></button></div>
            <div className="schedule-picker-grid">{shiftDefinitions.map((item) => (
              <button type="button" key={item.code || 'empty'} className={`tone-${item.tone} ${picker.value === item.code ? 'is-active' : ''}`} onClick={() => void applyShift(item.code)}>
                <strong>{item.code || '—'}</strong><span>{item.label}</span>{picker.value === item.code ? <Check size={17} /> : null}
              </button>
            ))}</div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
