import {
  Check,
  ChevronLeft,
  ChevronRight,
  Paintbrush,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canPerform } from '../lib/acl';
import { secureApi } from '../lib/secureApi';
import { getKyivDateKey } from '../lib/time';
import './schedule-v3.css';

type ShiftCode = '' | 'Р' | 'Х' | 'О' | 'СН' | 'Б' | 'С' | 'Р/Б' | 'СН/Б' | 'Д';
type Scope = 'team' | 'mine';
type Half = 'first' | 'second';
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
}

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const MONTHS_GENITIVE = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const DOW = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністрація', waiter: 'Офіціанти', bar: 'Бар', chef: 'Шеф-кухарі', cook: 'Кухня',
  hostess: 'Хостес', runner: 'Ранери', sommelier: 'Сомельє', staff: 'Команда',
};
const ROLE_ORDER = ['waiter', 'bar', 'hostess', 'runner', 'cook', 'chef', 'sommelier', 'admin'];
const FIRST_HALF_END = 15;
const WIDE_QUERY = '(min-width: 1024px)';

function normalizeRole(value: string | null | undefined): string {
  if (value === 'barman' || value === 'bartender') return 'bar';
  return value || 'staff';
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonth(value: string): Date {
  const [yearText = '', monthText = ''] = value.split('-');
  return new Date(Number(yearText), Number(monthText) - 1, 1);
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

function isWorkingShift(code: ShiftCode | null | undefined): boolean {
  return Boolean(code && !['Х', 'О'].includes(code));
}

/** The half of the month that contains `todayKey` when it falls in `month`, otherwise the first half. */
function halfFor(month: string, todayKey: string): Half {
  if (!todayKey.startsWith(`${month}-`)) return 'first';
  return Number(todayKey.slice(8, 10)) <= FIRST_HALF_END ? 'first' : 'second';
}

function shortName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[1]?.[0] || ''}.`;
}

function formatDay(date: string): string {
  return new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${date}T12:00:00`));
}

function formatShortDay(date: string): string {
  return new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' })
    .format(new Date(`${date}T12:00:00`));
}

function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

export function SchedulePage() {
  const { user } = useAuth();
  const todayKey = getKyivDateKey();
  const currentMonth = todayKey.slice(0, 7);
  const wide = useWideScreen();
  const [month, setMonth] = useState(currentMonth);
  const [half, setHalf] = useState<Half>(() => halfFor(currentMonth, todayKey));
  const [data, setData] = useState<ScheduleBootstrapResponse | null>(null);
  const [activeRole, setActiveRole] = useState('waiter');
  const [scope, setScope] = useState<Scope>('team');
  const [entries, setEntries] = useState<Record<string, ShiftCode>>({});
  const [saving, setSaving] = useState<Set<string>>(() => new Set());
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [brush, setBrush] = useState<ShiftCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const savedTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const changeMonth = (next: string) => {
    setMonth(next);
    setHalf(halfFor(next, todayKey));
  };

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
  const monthIndex = monthDate.getMonth();
  const daysInMonth = new Date(monthDate.getFullYear(), monthIndex + 1, 0).getDate();
  const range = wide
    ? { from: 1, to: daysInMonth }
    : half === 'first'
      ? { from: 1, to: FIRST_HALF_END }
      : { from: FIRST_HALF_END + 1, to: daysInMonth };
  const days = useMemo(
    () => Array.from({ length: range.to - range.from + 1 }, (_, index) => {
      const day = range.from + index;
      const date = dateForDay(month, day);
      const weekday = new Date(`${date}T12:00:00`).getDay();
      return { day, date, weekday, weekend: weekday === 0 || weekday === 6 };
    }),
    [month, range.from, range.to],
  );

  const roles = useMemo(() => {
    if (!data) return [] as [string, number][];
    const counts = new Map<string, number>();
    data.users.forEach((staff) => staffRoles(staff).forEach((role) => counts.set(role, (counts.get(role) || 0) + 1)));
    return [...counts.entries()].sort(([a], [b]) => {
      const ai = ROLE_ORDER.indexOf(a), bi = ROLE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return roleLabel(a).localeCompare(roleLabel(b), 'uk');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [data]);

  const departmentStaff = useMemo(() => {
    if (!data) return [];
    const staff = data.users.filter((person) => staffRoles(person).includes(activeRole));
    const order = data.orders[activeRole] || [];
    if (!order.length) return staff;
    const index = new Map(order.map((id, position) => [id, position]));
    return [...staff].sort((a, b) => {
      const ai = index.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = index.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ai === bi ? a.name.localeCompare(b.name, 'uk') : ai - bi;
    });
  }, [activeRole, data]);

  const me = data?.users.find((person) => person.id === data.me.legacyUserId) || null;

  const shiftDefinitions = useMemo(() => {
    if (!data) return [] as ShiftDefinition[];
    const role = scope === 'mine' && me ? (staffRoles(me).includes('waiter') ? 'waiter' : 'other') : activeRole;
    return role === 'waiter' ? data.shiftTypes.waiter : data.shiftTypes.default;
  }, [activeRole, data, me, scope]);

  const toneOf = useCallback((code: ShiftCode): ShiftTone => {
    if (!data) return 'neutral';
    const all = [...data.shiftTypes.waiter, ...data.shiftTypes.default];
    return all.find((item) => item.code === code)?.tone || 'neutral';
  }, [data]);

  const onShiftToday = useMemo(
    () => departmentStaff.filter((staff) => isWorkingShift(entries[cellKey(staff.id, todayKey)])).length,
    [departmentStaff, entries, todayKey],
  );

  const myNextShift = useMemo(() => {
    if (!data || !me) return null;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = dateForDay(month, day);
      if (date < todayKey) continue;
      const code = entries[cellKey(me.id, date)];
      if (isWorkingShift(code)) return { date, code: code as ShiftCode };
    }
    return null;
  }, [data, daysInMonth, entries, me, month, todayKey]);

  const canEditAll = Boolean(data?.me.canEditAll || (user ? canPerform(user, 'editSchedule') : false));
  const canEditOwn = user ? canPerform(user, 'editOwnShift') : false;
  const canEditStaff = (staff: ScheduleStaff) => Boolean(data && (canEditAll || (canEditOwn && staff.id === data.me.legacyUserId)));

  // Bring today's column into view when the table opens on the current half.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const today = container?.querySelector<HTMLElement>('th.is-today');
    if (!container || !today) return;
    const nameColumn = container.querySelector<HTMLElement>('th.sv3-name')?.offsetWidth || 0;
    const visibleFrom = container.scrollLeft + nameColumn;
    const visibleTo = container.scrollLeft + container.clientWidth;
    if (today.offsetLeft >= visibleFrom && today.offsetLeft + today.offsetWidth <= visibleTo) return;
    container.scrollLeft = Math.max(0, today.offsetLeft - nameColumn - today.offsetWidth * 2);
  }, [days, loading, activeRole, scope]);

  async function applyShift(staff: ScheduleStaff, date: string, code: ShiftCode) {
    const key = cellKey(staff.id, date);
    const previous = entries[key] || '';
    if (previous === code) return;
    setEntries((current) => ({ ...current, [key]: code }));
    setSaving((current) => new Set(current).add(key));
    setError(null);
    try {
      await secureApi<ScheduleSaveResponse>({ action: 'schedule_upsert', user_id: staff.id, date, shift: code });
      setSavedKey(key);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSavedKey(null), 1400);
    } catch (reason) {
      setEntries((current) => ({ ...current, [key]: previous }));
      setError(reason instanceof Error ? reason.message : 'Зміну не збережено. Перевір зʼєднання і спробуй ще раз.');
    } finally {
      setSaving((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }

  function onCell(staff: ScheduleStaff, date: string) {
    if (!canEditStaff(staff)) return;
    if (brush !== null && canEditAll) {
      void applyShift(staff, date, brush);
      return;
    }
    setPicker({ staff, date, value: entries[cellKey(staff.id, date)] || '' });
  }

  const rangeLabel = `${range.from}–${range.to} ${MONTHS_GENITIVE[monthIndex] || ''}`;
  const isCurrentMonth = month === currentMonth;
  const tableStaff = scope === 'team' ? departmentStaff : [];

  return (
    <div className="sv3">
      <div className="sv3-bar">
        <div className="sv3-tabs" role="tablist" aria-label="Режим графіка">
          <button type="button" role="tab" aria-selected={scope === 'team'} className={scope === 'team' ? 'is-on' : ''} onClick={() => setScope('team')}>Команда</button>
          <button type="button" role="tab" aria-selected={scope === 'mine'} className={scope === 'mine' ? 'is-on' : ''} onClick={() => { setScope('mine'); setBrush(null); }} disabled={!me}>Мій графік</button>
        </div>
        <div className="sv3-month" role="group" aria-label="Місяць">
          <button type="button" className="sv3-icon-btn" onClick={() => changeMonth(moveMonth(month, -1))} aria-label="Попередній місяць"><ChevronLeft size={20} /></button>
          <strong>{MONTHS[monthIndex]}{monthDate.getFullYear() !== Number(currentMonth.slice(0, 4)) ? ` ${monthDate.getFullYear()}` : ''}</strong>
          <button type="button" className="sv3-icon-btn" onClick={() => changeMonth(moveMonth(month, 1))} aria-label="Наступний місяць"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="sv3-controls">
        {!wide ? (
          <div className="sv3-seg" role="radiogroup" aria-label="Половина місяця">
            <button type="button" role="radio" aria-checked={half === 'first'} className={half === 'first' ? 'is-on' : ''} onClick={() => setHalf('first')}>1–{FIRST_HALF_END}</button>
            <button type="button" role="radio" aria-checked={half === 'second'} className={half === 'second' ? 'is-on' : ''} onClick={() => setHalf('second')}>{FIRST_HALF_END + 1}–{daysInMonth}</button>
          </div>
        ) : null}
        {!isCurrentMonth ? (
          <button type="button" className="sv3-link" onClick={() => changeMonth(currentMonth)}>До поточного місяця</button>
        ) : null}
        {scope === 'team' && canEditAll ? (
          <button
            type="button"
            className={`sv3-brush-toggle${brush !== null ? ' is-on' : ''}`}
            aria-pressed={brush !== null}
            onClick={() => setBrush((current) => (current === null ? 'Р' : null))}
          >
            <Paintbrush size={16} /> {brush !== null ? 'Пензель увімкнено' : 'Пензель'}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="sv3-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Закрити помилку"><X size={16} /></button>
        </div>
      ) : null}

      {!data && loading ? (
        <div className="sv3-skeleton" aria-label="Завантажуємо графік"><span /><span /><span /></div>
      ) : null}

      {data && scope === 'team' ? (
        <>
          <p className="sv3-summary">
            {isCurrentMonth ? <>Сьогодні на зміні: <b>{onShiftToday}</b> · {roleLabel(activeRole).toLowerCase()}</> : <>{roleLabel(activeRole)} · {departmentStaff.length}</>}
            {myNextShift && isCurrentMonth ? (
              myNextShift.date === todayKey
                ? <> · ти сьогодні: <b>{myNextShift.code}</b></>
                : <> · твоя наступна зміна: <b>{formatShortDay(myNextShift.date)}, {myNextShift.code}</b></>
            ) : null}
          </p>

          <div className="sv3-chips" role="tablist" aria-label="Відділи">
            {roles.map(([role, count]) => (
              <button type="button" role="tab" aria-selected={activeRole === role} className={activeRole === role ? 'is-on' : ''} key={role} onClick={() => setActiveRole(role)}>
                {roleLabel(role)} <span>{count}</span>
              </button>
            ))}
          </div>

          {tableStaff.length === 0 && !loading ? (
            <p className="sv3-empty">У відділі немає активних працівників.</p>
          ) : (
            <div className={`sv3-table-wrap${loading ? ' is-refreshing' : ''}`} ref={scrollRef} tabIndex={0} aria-label={`Графік, ${rangeLabel}`}>
              <table className="sv3-table">
                <thead>
                  <tr>
                    <th className="sv3-name" scope="col"><span className="sv3-visually-hidden">Працівник</span></th>
                    {days.map((day) => (
                      <th key={day.date} scope="col" className={`${day.date === todayKey ? 'is-today' : ''}${day.weekend ? ' is-weekend' : ''}`}>
                        <small>{DOW[day.weekday]}</small>
                        <b>{day.day}</b>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableStaff.map((staff) => {
                    const own = staff.id === data.me.legacyUserId;
                    const editable = canEditStaff(staff);
                    return (
                      <tr key={staff.id} className={own ? 'is-own' : ''}>
                        <th scope="row" className="sv3-name" title={staff.name}>
                          {own ? <><span className="sv3-visually-hidden">Ти: </span>{shortName(staff.name)}</> : shortName(staff.name)}
                        </th>
                        {days.map((day) => {
                          const key = cellKey(staff.id, day.date);
                          const value = entries[key] || '';
                          return (
                            <td key={day.date} className={`${day.date === todayKey ? 'is-today' : ''}${day.weekend ? ' is-weekend' : ''}`}>
                              <button
                                type="button"
                                className={`sv3-cell tone-${toneOf(value)}${savedKey === key ? ' is-saved' : ''}${value.length > 2 ? ' is-long' : ''}`}
                                disabled={!editable || saving.has(key)}
                                onClick={() => onCell(staff, day.date)}
                                aria-label={`${staff.name}, ${day.day} ${MONTHS_GENITIVE[monthIndex]}: ${value || 'не призначено'}`}
                              >
                                {saving.has(key) ? <RefreshCw size={12} className="sv3-spin" /> : savedKey === key ? <Check size={13} /> : value || ''}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="sv3-name">На зміні</th>
                    {days.map((day) => (
                      <td key={day.date} className={day.date === todayKey ? 'is-today' : ''}>
                        {tableStaff.filter((staff) => isWorkingShift(entries[cellKey(staff.id, day.date)])).length}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      ) : null}

      {data && scope === 'mine' && me ? (
        <section className="sv3-mine" aria-label={`Мій графік, ${rangeLabel}`}>
          <p className="sv3-summary">
            {(() => {
              const working = days.filter((day) => isWorkingShift(entries[cellKey(me.id, day.date)])).length;
              return <>Робочих змін за {rangeLabel}: <b>{working}</b></>;
            })()}
          </p>
          <ul>
            {days.map((day) => {
              const key = cellKey(me.id, day.date);
              const value = entries[key] || '';
              const definition = shiftDefinitions.find((item) => item.code === value);
              return (
                <li key={day.date} className={day.date === todayKey ? 'is-today' : ''}>
                  <button type="button" onClick={() => onCell(me, day.date)} disabled={!canEditStaff(me) || saving.has(key)}>
                    <span className="sv3-mine-day"><b>{day.day}</b><small>{DOW[day.weekday]}</small></span>
                    <span className="sv3-mine-label">{day.date === todayKey ? 'Сьогодні · ' : ''}{value ? definition?.label || value : 'Не призначено'}</span>
                    <span className={`sv3-code tone-${toneOf(value)}`}>{saving.has(key) ? <RefreshCw size={12} className="sv3-spin" /> : value || '—'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data ? (
        <div className="sv3-legend" aria-label="Коди змін">
          {shiftDefinitions.filter((item) => item.code).map((item) => (
            <span key={item.code}><b className={`sv3-code tone-${item.tone}`}>{item.code}</b>{item.label}</span>
          ))}
        </div>
      ) : null}

      {brush !== null && scope === 'team' ? (
        <div className="sv3-brush" role="toolbar" aria-label="Пензель: вибери код і тапай клітинки">
          <div className="sv3-brush-codes">
            {shiftDefinitions.map((item) => (
              <button
                type="button"
                key={item.code || 'empty'}
                className={`sv3-code tone-${item.tone}${brush === item.code ? ' is-sel' : ''}`}
                aria-pressed={brush === item.code}
                aria-label={item.label}
                onClick={() => setBrush(item.code)}
              >
                {item.code || '—'}
              </button>
            ))}
          </div>
          <button type="button" className="sv3-brush-done" onClick={() => setBrush(null)}>Готово</button>
        </div>
      ) : null}

      {picker ? (
        <ShiftPicker
          picker={picker}
          definitions={shiftDefinitions}
          onPick={(code) => {
            const current = picker;
            setPicker(null);
            void applyShift(current.staff, current.date, code);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

function ShiftPicker({
  picker,
  definitions,
  onPick,
  onClose,
}: {
  picker: PickerState;
  definitions: ShiftDefinition[];
  onPick: (code: ShiftCode) => void;
  onClose: () => void;
}) {
  return (
    <div className="sv3-picker-backdrop" onMouseDown={onClose}>
      <div className="sv3-picker" role="dialog" aria-modal="true" aria-labelledby="sv3-picker-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sv3-picker-head">
          <div>
            <h2 id="sv3-picker-title">{picker.staff.name}</h2>
            <p>{formatDay(picker.date)}</p>
          </div>
          <button type="button" className="sv3-icon-btn" onClick={onClose} aria-label="Закрити"><X size={20} /></button>
        </div>
        <div className="sv3-picker-grid">
          {definitions.map((item) => (
            <button
              type="button"
              key={item.code || 'empty'}
              className={picker.value === item.code ? 'is-on' : ''}
              aria-pressed={picker.value === item.code}
              onClick={() => onPick(item.code)}
            >
              <span className={`sv3-code tone-${item.tone}`}>{item.code || '—'}</span>
              <span>{item.label}</span>
              {picker.value === item.code ? <Check size={16} /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
