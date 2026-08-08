import {
  Banknote,
  BarChart3,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { CashLeaderboard } from '../components/CashLeaderboard';
import { secureApi } from '../lib/secureApi';
import './cash.css';
import './cash-practical.css';
import './cash-identity.css';

type CashTab = 'overview' | 'leaderboard';
type LeaderboardPeriod = 'first' | 'second' | 'month' | 'year';
type NumericValue = number | string | null;

interface CashStaff {
  id: string;
  name: string;
  role: string;
  role2: string | null;
  avatar: string | null;
}

interface CashEntry {
  id: number;
  user_id: string;
  date: string;
  cash: NumericValue;
  tips: NumericValue;
  first_cash: NumericValue;
}

interface ExtraWage {
  id: number;
  user_id: string;
  date: string;
  amount: NumericValue;
  description: string | null;
}

interface LeaderboardRow {
  userId: string;
  name: string;
  rank: number;
  total: number | null;
  relative: number;
  mine: boolean;
  avatar: string | null;
  role: string;
  role2: string | null;
}

interface CashBootstrapResponse {
  ok: true;
  month: string;
  viewUserId: string;
  me: {
    legacyUserId: string;
    canViewAll: boolean;
    canEditAll: boolean;
    canEditRatings: boolean;
  };
  users: CashStaff[];
  entries: CashEntry[];
  extraWages: ExtraWage[];
  leaderboard: LeaderboardRow[];
  leaderboardPeriod?: LeaderboardPeriod;
}

interface DayEditorState {
  date: string;
  cash: string;
  tips: string;
  extra: string;
  note: string;
}

const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністрація',
  sysadmin: 'Системний адміністратор',
  waiter: 'Офіціант',
  bar: 'Бармен',
  barman: 'Бармен',
  bartender: 'Бармен',
  hostess: 'Хостес',
  runner: 'Ранер',
  chef: 'Шеф-кухар',
  cook: 'Кухня',
  sommelier: 'Сомельє',
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonth(value: string): Date {
  const [yearText = '', monthText = ''] = value.split('-');
  return new Date(Number(yearText), Number(monthText) - 1, 1);
}

function moveMonth(value: string, delta: number): string {
  const date = parseMonth(value);
  date.setMonth(date.getMonth() + delta);
  return monthKey(date);
}

function dateForDay(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

function asNumber(value: NumericValue | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value);
}

function calendarMoney(value: number): string {
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(value)} ₴`;
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${value}T12:00:00`));
}

function formatCompactDay(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '—';
}

function staffRole(staff: CashStaff | null): string {
  if (!staff) return 'Працівник ресторану';
  return [staff.role, staff.role2]
    .filter((role): role is string => Boolean(role))
    .map((role) => ROLE_LABELS[role] || role)
    .filter((role, index, all) => all.indexOf(role) === index)
    .join(' · ') || 'Працівник ресторану';
}

function inDayRange(value: string, month: string, fromDay: number, toDay: number): boolean {
  return value >= dateForDay(month, fromDay) && value <= dateForDay(month, toDay);
}

function summarizeCash(entries: CashEntry[], extras: ExtraWage[], month: string, daysInMonth: number) {
  const scopedEntries = entries.filter((entry) => inDayRange(entry.date, month, 1, daysInMonth));
  const scopedExtras = extras.filter((entry) => inDayRange(entry.date, month, 1, daysInMonth));
  const positiveEntries = scopedEntries.filter((entry) => asNumber(entry.cash) > 0);
  const cash = scopedEntries.reduce((sum, entry) => sum + asNumber(entry.cash), 0);
  const tips = scopedEntries.reduce((sum, entry) => sum + asNumber(entry.tips), 0);
  const extra = scopedExtras.reduce((sum, entry) => sum + asNumber(entry.amount), 0);
  const workDays = positiveEntries.length;
  const wage = cash * 0.04 + workDays * 200 + extra;
  const bestEntry = positiveEntries.reduce<CashEntry | null>((best, entry) => {
    if (!best || asNumber(entry.cash) > asNumber(best.cash)) return entry;
    return best;
  }, null);

  return {
    cash,
    tips,
    extra,
    workDays,
    wage,
    averageCash: workDays ? cash / workDays : 0,
    averageTips: scopedEntries.length ? tips / scopedEntries.length : 0,
    averageWage: workDays ? wage / workDays : 0,
    bestCash: asNumber(bestEntry?.cash),
    bestDate: bestEntry?.date || null,
  };
}

export function CashPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [viewUserId, setViewUserId] = useState(user?.id || '');
  const [tab, setTab] = useState<CashTab>('overview');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('first');
  const [data, setData] = useState<CashBootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [editor, setEditor] = useState<DayEditorState>(() => {
    const now = new Date();
    return {
      date: `${monthKey(now)}-${String(now.getDate()).padStart(2, '0')}`,
      cash: '',
      tips: '',
      extra: '',
      note: '',
    };
  });

  useEffect(() => {
    if (user && !viewUserId) setViewUserId(user.id);
  }, [user, viewUserId]);

  const load = useCallback(async () => {
    if (!viewUserId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<CashBootstrapResponse>({
        action: 'cash_bootstrap',
        month,
        user_id: viewUserId,
        leaderboard_period: leaderboardPeriod,
      });
      if (requestId.current !== id) return;
      setData(response);
      if (response.viewUserId !== viewUserId) setViewUserId(response.viewUserId);
    } catch (reason) {
      if (requestId.current !== id) return;
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити касу.');
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [leaderboardPeriod, month, viewUserId]);

  useEffect(() => { void load(); }, [load]);

  const monthDate = useMemo(() => parseMonth(month), [month]);
  const daysInMonth = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate(),
    [monthDate],
  );
  const firstOffset = useMemo(() => {
    const sundayFirst = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
    return (sundayFirst + 6) % 7;
  }, [monthDate]);
  const entries = data?.entries || [];
  const extras = data?.extraWages || [];
  const entryByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);
  const extraByDate = useMemo(() => new Map(extras.map((entry) => [entry.date, entry])), [extras]);
  const summary = useMemo(
    () => summarizeCash(entries, extras, month, daysInMonth),
    [daysInMonth, entries, extras, month],
  );
  const selectedStaff = data?.users.find((staff) => staff.id === data.viewUserId) || null;
  const canEdit = Boolean(data && (data.me.canEditAll || data.viewUserId === data.me.legacyUserId));
  const currentMonth = monthKey(new Date());
  const defaultDate = month === currentMonth
    ? dateForDay(month, new Date().getDate())
    : dateForDay(month, 1);
  const selectedEntry = entryByDate.get(editor.date);
  const selectedExtra = extraByDate.get(editor.date);
  const selectedDayEstimate = asNumber(editor.cash) * 0.04
    + (asNumber(editor.cash) > 0 ? 200 : 0)
    + asNumber(editor.extra);

  function openDay(date: string) {
    const entry = entryByDate.get(date);
    const extra = extraByDate.get(date);
    setEditor({
      date,
      cash: entry ? String(asNumber(entry.cash) || '') : '',
      tips: entry ? String(asNumber(entry.tips) || '') : '',
      extra: extra ? String(asNumber(extra.amount) || '') : '',
      note: extra?.description || '',
    });
    setOptionalOpen(Boolean(asNumber(entry?.tips) || asNumber(extra?.amount) || extra?.description));
  }

  useEffect(() => {
    if (!editor.date.startsWith(`${month}-`)) openDay(defaultDate);
  }, [defaultDate, month]);

  useEffect(() => {
    if (!loading && data) openDay(editor.date.startsWith(`${month}-`) ? editor.date : defaultDate);
  }, [data?.viewUserId, loading]);

  async function saveDay() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'cash_save_day',
        user_id: data.viewUserId,
        date: editor.date,
        cash: editor.cash,
        tips: editor.tips,
        extra_amount: editor.extra,
        extra_note: editor.note,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Запис не збережено.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDay() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'cash_delete_day',
        user_id: data.viewUserId,
        date: editor.date,
      });
      setEditor({ ...editor, cash: '', tips: '', extra: '', note: '' });
      setOptionalOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Запис не видалено.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cash-page-v2">
      <section className="cash-hero-v2 cash-hero-clean-v4">
        <div>
          <span className="eyebrow">Фінанси зміни</span>
          <h2>Каса</h2>
          <p>Календар, денний запис і статистика без зайвого шуму.</p>
        </div>
        <div className="cash-hero-mark"><WalletCards size={35} /></div>
      </section>

      {error ? (
        <div className="cash-alert-v2" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}><X size={16} /></button>
        </div>
      ) : null}
      {loading ? (
        <div className="cash-loading-v2">
          <RefreshCw className="is-spinning" size={24} />
          <span>Завантажуємо касу…</span>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="cash-calendar-primary-v4">
            <header>
              <div className="cash-staff-identity-v5">
                <span className="cash-staff-avatar-v5" aria-hidden="true">
                  <span>{initials(selectedStaff?.name || 'Моя каса')}</span>
                  {selectedStaff?.avatar ? (
                    <img
                      src={selectedStaff.avatar}
                      alt=""
                      onError={(event) => { event.currentTarget.hidden = true; }}
                    />
                  ) : null}
                </span>
                <div>
                  <span className="eyebrow">Календар каси</span>
                  <h3>{selectedStaff?.name || 'Моя каса'}</h3>
                  <small>{staffRole(selectedStaff)}</small>
                </div>
              </div>
              <span>Зелена комірка — касу внесено</span>
            </header>
            <div className="cash-practical-grid">
              {DOW.map((day) => <span className="cash-practical-dow" key={day}>{day}</span>)}
              {Array.from({ length: firstOffset }, (_, index) => (
                <span className="cash-practical-empty" key={`empty-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                const date = dateForDay(month, day);
                const cash = asNumber(entryByDate.get(date)?.cash);
                return (
                  <button
                    type="button"
                    key={date}
                    className={`cash-practical-day ${cash > 0 ? 'has-cash' : ''} ${editor.date === date ? 'is-selected' : ''}`}
                    onClick={() => openDay(date)}
                  >
                    <span>{day}</span>
                    {cash > 0 ? <strong>{calendarMoney(cash)}</strong> : <small>—</small>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="cash-toolbar-v2 cash-toolbar-after-calendar-v4">
            <div className="cash-month-nav">
              <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="Попередній місяць"><ChevronLeft size={20} /></button>
              <div><span>{MONTHS[monthDate.getMonth()]}</span><strong>{monthDate.getFullYear()}</strong></div>
              <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="Наступний місяць"><ChevronRight size={20} /></button>
              <button type="button" className="cash-today-button" onClick={() => setMonth(currentMonth)}>Сьогодні</button>
            </div>
            {data.me.canViewAll ? (
              <label className="cash-user-select">
                <span>Працівник</span>
                <select value={viewUserId} onChange={(event) => setViewUserId(event.target.value)}>
                  {data.users.map((staff) => <option value={staff.id} key={staff.id}>{staff.name}</option>)}
                </select>
              </label>
            ) : null}
          </section>

          {canEdit ? (
            <section className="cash-day-entry-v4">
              <header>
                <div><span className="eyebrow">Денний запис</span><h3>{formatDay(editor.date)}</h3></div>
                <input
                  className="cash-practical-date-input"
                  aria-label="Дата запису каси"
                  type="date"
                  value={editor.date}
                  min={`${month}-01`}
                  max={`${month}-${String(daysInMonth).padStart(2, '0')}`}
                  onChange={(event) => openDay(event.target.value)}
                />
              </header>

              <div className="cash-day-entry-grid-v4">
                <div>
                  <label className="cash-primary-input">
                    <span>Сума каси</span>
                    <span className="cash-primary-input-field">
                      <input
                        inputMode="decimal"
                        type="number"
                        min="0"
                        value={editor.cash}
                        onChange={(event) => setEditor({ ...editor, cash: event.target.value })}
                        placeholder="0"
                        autoComplete="off"
                      />
                      <b>₴</b>
                    </span>
                  </label>
                  <p className="cash-primary-help">Основна сума, від якої розраховується 4%.</p>
                </div>

                <div className="cash-day-entry-side-v4">
                  <div className="cash-practical-summary">
                    <span>Зарплата за день</span>
                    <strong>{money(selectedDayEstimate)}</strong>
                  </div>
                  <div className="cash-practical-actions">
                    {selectedEntry || selectedExtra ? (
                      <button type="button" className="is-danger" onClick={() => void deleteDay()} disabled={saving}><Trash2 size={17} /></button>
                    ) : <span />}
                    <button type="button" className="is-primary" onClick={() => void saveDay()} disabled={saving}>
                      {saving ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />}
                      Зберегти касу
                    </button>
                  </div>
                </div>
              </div>

              <details className="cash-optional-details" open={optionalOpen} onToggle={(event) => setOptionalOpen(event.currentTarget.open)}>
                <summary>Чайові та додаткова доплата</summary>
                <div className="cash-optional-fields cash-optional-fields-v4">
                  <label>
                    <span>Чайові, ₴</span>
                    <input inputMode="decimal" type="number" min="0" value={editor.tips} onChange={(event) => setEditor({ ...editor, tips: event.target.value })} placeholder="0" />
                  </label>
                  <label>
                    <span>Додаткова ставка / доплата, ₴</span>
                    <input inputMode="decimal" type="number" min="0" value={editor.extra} onChange={(event) => setEditor({ ...editor, extra: event.target.value })} placeholder="0" />
                  </label>
                  <label className="is-wide">
                    <span>Причина доплати</span>
                    <input type="text" maxLength={300} value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} placeholder="Банкет, підміна, додаткові години…" />
                  </label>
                </div>
              </details>
            </section>
          ) : null}
        </>
      ) : null}

      <nav className="cash-tabs-v2 cash-tabs-two-v4" aria-label="Розділи каси">
        <button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>Огляд</button>
        <button type="button" className={tab === 'leaderboard' ? 'is-active' : ''} onClick={() => setTab('leaderboard')}>Топ каси</button>
      </nav>

      {!loading && data && tab === 'overview' ? (
        <section className="cash-expanded-overview-v4">
          <article><Banknote size={20} /><span>Каса за місяць</span><strong>{money(summary.cash)}</strong><small>{summary.workDays} днів із внесеною касою</small></article>
          <article><TrendingUp size={20} /><span>Зарплата</span><strong>{money(summary.wage)}</strong><small>4% + 200 ₴/день + доплати</small></article>
          <article><Coins size={20} /><span>Чайові</span><strong>{money(summary.tips)}</strong><small>середні: {money(summary.averageTips)}</small></article>
          <article><Sparkles size={20} /><span>Доплати</span><strong>{money(summary.extra)}</strong><small>додаткові нарахування</small></article>
          <article><CalendarCheck2 size={20} /><span>Днів із касою</span><strong>{summary.workDays}</strong><small>записи з сумою більше нуля</small></article>
          <article><BarChart3 size={20} /><span>Середня каса</span><strong>{money(summary.averageCash)}</strong><small>за робочий день</small></article>
          <article><TrendingUp size={20} /><span>Найкращий день</span><strong>{money(summary.bestCash)}</strong><small>{summary.bestDate ? formatCompactDay(summary.bestDate) : 'Записів ще немає'}</small></article>
          <article><WalletCards size={20} /><span>Середня зарплата</span><strong>{money(summary.averageWage)}</strong><small>за день із касою</small></article>
        </section>
      ) : null}

      {!loading && data && tab === 'leaderboard' ? (
        <CashLeaderboard
          rows={data.leaderboard}
          period={leaderboardPeriod}
          daysInMonth={daysInMonth}
          year={monthDate.getFullYear()}
          canViewAll={data.me.canViewAll}
          onPeriodChange={setLeaderboardPeriod}
        />
      ) : null}
    </div>
  );
}
