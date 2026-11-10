import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { CashTopList, rankMovement, type CashTopPeriod, type CashTopRow } from '../components/CashTopList';
import { secureApi } from '../lib/secureApi';
import { CountUp, SegThumb, TabLine } from '../lib/motion';
import { getKyivDateKey } from '../lib/time';
import './cash-v3.css';

type CashTab = 'overview' | 'top';
type OverviewPeriod = 'first' | 'second' | 'month';
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
  leaderboard: CashTopRow[];
  leaderboardPeriod?: CashTopPeriod;
}

interface DayEditorState {
  date: string;
  cash: string;
  tips: string;
  extra: string;
  note: string;
}

interface PayrollPeriodSummary {
  cash: number;
  tips: number;
  extra: number;
  cashDays: number;
  rateDays: number;
  wage: number;
  averageCash: number;
  bestCash: number;
  bestDate: string | null;
}

const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];
const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];
const RATE_PER_DAY = 200;
const CASH_PERCENT = 0.04;

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

const amountFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });

function amount(value: number): string {
  return amountFormat.format(Math.round(value));
}

function money(value: number): string {
  return `${amount(value)} ₴`;
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${value}T12:00:00`));
}

function formatListDay(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' })
    .format(new Date(`${value}T12:00:00`));
}

function inDayRange(value: string, month: string, fromDay: number, toDay: number): boolean {
  return value >= dateForDay(month, fromDay) && value <= dateForDay(month, toDay);
}

function defaultPeriod(): OverviewPeriod {
  const day = Number(getKyivDateKey().slice(8, 10));
  return day >= 1 && day <= 14 ? 'first' : 'second';
}

function shiftsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} зміна`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} зміни`;
  return `${count} змін`;
}

function summarizePayrollPeriod(
  entries: CashEntry[],
  extras: ExtraWage[],
  month: string,
  cashFromDay: number,
  cashToDay: number,
  rateFromDay: number,
  rateToDay: number,
  extraFromDay: number,
  extraToDay: number,
): PayrollPeriodSummary {
  const cashEntries = entries.filter((entry) => inDayRange(entry.date, month, cashFromDay, cashToDay));
  const rateEntries = entries.filter((entry) => inDayRange(entry.date, month, rateFromDay, rateToDay));
  const extraRows = extras.filter((entry) => inDayRange(entry.date, month, extraFromDay, extraToDay));
  const positiveCashEntries = cashEntries.filter((entry) => asNumber(entry.cash) > 0);
  const cash = cashEntries.reduce((sum, entry) => sum + asNumber(entry.cash), 0);
  const tips = cashEntries.reduce((sum, entry) => sum + asNumber(entry.tips), 0);
  const extra = extraRows.reduce((sum, entry) => sum + asNumber(entry.amount), 0);
  const rateDays = rateEntries.filter((entry) => asNumber(entry.cash) > 0).length;
  const wage = cash * CASH_PERCENT + rateDays * RATE_PER_DAY + extra;
  const bestEntry = positiveCashEntries.reduce<CashEntry | null>((best, entry) => {
    if (!best || asNumber(entry.cash) > asNumber(best.cash)) return entry;
    return best;
  }, null);

  return {
    cash,
    tips,
    extra,
    cashDays: positiveCashEntries.length,
    rateDays,
    wage,
    averageCash: positiveCashEntries.length ? cash / positiveCashEntries.length : 0,
    bestCash: asNumber(bestEntry?.cash),
    bestDate: bestEntry?.date || null,
  };
}

function summarizeCash(entries: CashEntry[], extras: ExtraWage[], month: string, daysInMonth: number) {
  const first = summarizePayrollPeriod(entries, extras, month, 1, 14, 1, 15, 1, 15);
  const second = summarizePayrollPeriod(entries, extras, month, 15, daysInMonth, 16, daysInMonth, 16, daysInMonth);
  const cashDays = first.cashDays + second.cashDays;
  const cash = first.cash + second.cash;
  const monthTotal: PayrollPeriodSummary = {
    cash,
    tips: first.tips + second.tips,
    extra: first.extra + second.extra,
    cashDays,
    rateDays: first.rateDays + second.rateDays,
    wage: first.wage + second.wage,
    averageCash: cashDays ? cash / cashDays : 0,
    bestCash: Math.max(first.bestCash, second.bestCash),
    bestDate: first.bestCash >= second.bestCash ? first.bestDate : second.bestDate,
  };
  return { first, second, month: monthTotal };
}

export function CashPage() {
  const { user } = useAuth();
  const todayKey = getKyivDateKey();
  const currentMonth = todayKey.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [viewUserId, setViewUserId] = useState(user?.id || '');
  // «/cash?tab=top» (linked from Рекорди) opens the live cash race directly.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<CashTab>(() => (searchParams.get('tab') === 'top' ? 'top' : 'overview'));
  const [period, setPeriod] = useState<CashTopPeriod>(() => defaultPeriod());
  const [data, setData] = useState<CashBootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editor, setEditor] = useState<DayEditorState | null>(null);
  const requestId = useRef(0);

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
        leaderboard_period: period,
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
  }, [period, month, viewUserId]);

  useEffect(() => { void load(); }, [load]);

  const monthDate = useMemo(() => parseMonth(month), [month]);
  const monthIndex = monthDate.getMonth();
  const daysInMonth = useMemo(
    () => new Date(monthDate.getFullYear(), monthIndex + 1, 0).getDate(),
    [monthDate, monthIndex],
  );
  const entries = useMemo(() => data?.entries || [], [data]);
  const extras = useMemo(() => data?.extraWages || [], [data]);
  const entryByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);
  const extraByDate = useMemo(() => new Map(extras.map((entry) => [entry.date, entry])), [extras]);
  const summary = useMemo(
    () => summarizeCash(entries, extras, month, daysInMonth),
    [daysInMonth, entries, extras, month],
  );

  const overviewPeriod: OverviewPeriod = period === 'year' ? 'month' : period;
  const current = summary[overviewPeriod];
  const range = overviewPeriod === 'first'
    ? { from: 1, to: 14 }
    : overviewPeriod === 'second'
      ? { from: 15, to: daysInMonth }
      : { from: 1, to: daysInMonth };
  const monthGen = MONTHS_GENITIVE[monthIndex] || '';
  const rangeLabel = overviewPeriod === 'month'
    ? `${MONTHS[monthIndex]} ${monthDate.getFullYear()}`
    : `${range.from}–${range.to} ${monthGen}`;
  const payoutNote = overviewPeriod === 'first'
    ? 'Каса за 1–14, ставка й доплати за 1–15'
    : overviewPeriod === 'second'
      ? `Каса за 15–${daysInMonth}, ставка й доплати за 16–${daysInMonth}`
      : 'Сума двох окремих виплат місяця';

  const selectedStaff = data?.users.find((staff) => staff.id === data.viewUserId) || null;
  const viewingSelf = Boolean(data && data.viewUserId === data.me.legacyUserId);
  const canEdit = Boolean(data && (data.me.canEditAll || viewingSelf));
  const isCurrentMonth = month === currentMonth;
  const rows = data?.leaderboard || [];
  const focusRow = rows.find((row) => row.userId === data?.viewUserId) || null;
  const focusMovement = focusRow ? rankMovement(focusRow) : 0;

  const days = useMemo(() => {
    const list: { date: string; day: number; cash: number; future: boolean }[] = [];
    for (let day = range.from; day <= range.to; day += 1) {
      const date = dateForDay(month, day);
      list.push({ date, day, cash: asNumber(entryByDate.get(date)?.cash), future: date > todayKey });
    }
    return list;
  }, [entryByDate, month, range.from, range.to, todayKey]);

  const records = useMemo(() => {
    const dates = new Set<string>();
    entries.forEach((entry) => {
      if (inDayRange(entry.date, month, range.from, range.to) && (asNumber(entry.cash) > 0 || asNumber(entry.tips) > 0)) dates.add(entry.date);
    });
    extras.forEach((extra) => {
      if (inDayRange(extra.date, month, range.from, range.to) && asNumber(extra.amount) !== 0) dates.add(extra.date);
    });
    return [...dates].sort().reverse().map((date) => {
      const entry = entryByDate.get(date);
      const extra = extraByDate.get(date);
      const cash = asNumber(entry?.cash);
      return {
        date,
        cash,
        tips: asNumber(entry?.tips),
        extra: asNumber(extra?.amount),
        note: extra?.description || '',
        dayWage: cash * CASH_PERCENT + (cash > 0 ? RATE_PER_DAY : 0) + asNumber(extra?.amount),
      };
    });
  }, [entries, entryByDate, extraByDate, extras, month, range.from, range.to]);

  function openDay(date: string) {
    setActionError(null);
    const entry = entryByDate.get(date);
    const extra = extraByDate.get(date);
    setEditor({
      date,
      cash: entry && asNumber(entry.cash) ? String(asNumber(entry.cash)) : '',
      tips: entry && asNumber(entry.tips) ? String(asNumber(entry.tips)) : '',
      extra: extra && asNumber(extra.amount) ? String(asNumber(extra.amount)) : '',
      note: extra?.description || '',
    });
  }

  const quickDate = isCurrentMonth ? todayKey : dateForDay(month, 1);
  const quickEntry = entryByDate.get(quickDate);
  const quickLabel = isCurrentMonth
    ? (asNumber(quickEntry?.cash) > 0 ? `Змінити касу за сьогодні · ${money(asNumber(quickEntry?.cash))}` : 'Внести касу за сьогодні')
    : 'Додати запис за цей місяць';

  async function saveDay(next: DayEditorState): Promise<boolean> {
    if (!data) return false;
    setSaving(true);
    setActionError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'cash_save_day',
        user_id: data.viewUserId,
        date: next.date,
        cash: next.cash,
        tips: next.tips,
        extra_amount: next.extra,
        extra_note: next.note,
      });
      await load();
      return true;
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Запис не збережено. Перевір зʼєднання і спробуй ще раз.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function deleteDay(date: string): Promise<boolean> {
    if (!data) return false;
    setSaving(true);
    setActionError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'cash_delete_day',
        user_id: data.viewUserId,
        date,
      });
      await load();
      return true;
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Запис не видалено. Перевір зʼєднання і спробуй ще раз.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function changeTab(next: CashTab) {
    if (next === 'overview' && period === 'year') setPeriod('month');
    setTab(next);
  }

  const maxCash = Math.max(1, ...days.map((day) => day.cash));
  const averageShare = current.averageCash > 0 ? current.averageCash / maxCash : 0;
  const denseAxis = days.length > 16;

  return (
    <div className="cv3" aria-busy={loading}>
      <div className="cv3-bar">
        <div className="cv3-tabs" role="tablist" aria-label="Розділи каси">
          <button type="button" role="tab" aria-selected={tab === 'overview'} className={`tm-tab${tab === 'overview' ? ' is-on' : ''}`} onClick={() => changeTab('overview')}>Огляд{tab === 'overview' ? <TabLine group="cash" /> : null}</button>
          <button type="button" role="tab" aria-selected={tab === 'top'} className={`tm-tab${tab === 'top' ? ' is-on' : ''}`} onClick={() => changeTab('top')}>Топ каси{tab === 'top' ? <TabLine group="cash" /> : null}</button>
        </div>
        <div className="cv3-month" role="group" aria-label="Місяць">
          <button type="button" className="cv3-icon-btn" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="Попередній місяць">
            <ChevronLeft size={20} />
          </button>
          <strong>{MONTHS[monthIndex]}{monthDate.getFullYear() !== Number(currentMonth.slice(0, 4)) ? ` ${monthDate.getFullYear()}` : ''}</strong>
          <button type="button" className="cv3-icon-btn" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="Наступний місяць">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {data?.me.canViewAll || !isCurrentMonth ? (
        <div className="cv3-subbar">
          {data?.me.canViewAll ? (
            <label className="cv3-select">
              <span className="cv3-visually-hidden">Працівник</span>
              <select value={viewUserId} onChange={(event) => setViewUserId(event.target.value)}>
                {data.users.map((staff) => <option value={staff.id} key={staff.id}>{staff.name}</option>)}
              </select>
            </label>
          ) : <span />}
          {!isCurrentMonth ? (
            <button type="button" className="cv3-link" onClick={() => setMonth(currentMonth)}>До поточного місяця</button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="cv3-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>Спробувати ще раз</button>
        </div>
      ) : null}

      {!data && loading ? (
        <div className="cv3-skeleton" aria-label="Завантажуємо касу">
          <span className="is-seg" /><span className="is-hero" /><span className="is-row" /><span className="is-chart" />
        </div>
      ) : null}

      {data && tab === 'overview' ? (
        <div className={`cv3-overview${loading ? ' is-refreshing' : ''}`}>
          <div className="cv3-seg" role="radiogroup" aria-label="Період">
            {([
              ['first', '1–14'],
              ['second', `15–${daysInMonth}`],
              ['month', 'Місяць'],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={overviewPeriod === value}
                key={value}
                className={`tm-seg${overviewPeriod === value ? ' is-on' : ''}`}
                onClick={() => setPeriod(value)}
              >
                {overviewPeriod === value ? <SegThumb group="cash-overview" /> : null}
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="cv3-main">
            <section className="cv3-payout" aria-labelledby="cv3-payout-title">
              <div className="cv3-payout-head">
                <h2 id="cv3-payout-title">{overviewPeriod === 'month' ? 'Зарплата за місяць' : 'До виплати'}</h2>
                <span>{rangeLabel}</span>
              </div>
              {!viewingSelf && selectedStaff ? <p className="cv3-viewing">{selectedStaff.name}</p> : null}
              <p className="cv3-payout-sum"><CountUp value={current.wage} format={amount} /><span>₴</span></p>
              <dl className="cv3-breakdown">
                <div><dt>4% каси</dt><dd>{money(current.cash * CASH_PERCENT)}</dd></div>
                <div><dt>{shiftsLabel(current.rateDays)} × 200</dt><dd>{money(current.rateDays * RATE_PER_DAY)}</dd></div>
                <div><dt>Доплати</dt><dd>{money(current.extra)}</dd></div>
              </dl>
              <p className="cv3-note">{payoutNote}</p>
            </section>

            <div className="cv3-stats">
              <div className="cv3-stat">
                <span>Каса</span>
                <strong>{money(current.cash)}</strong>
                <small>{current.cashDays ? `${shiftsLabel(current.cashDays)} · сер. ${money(current.averageCash)}` : 'Ще немає записів'}</small>
              </div>
              <div className="cv3-stat">
                <span>Чайові</span>
                <strong>{money(current.tips)}</strong>
                <small>Окремо від виплати</small>
              </div>
              <div className="cv3-stat">
                <span>Місце в топі</span>
                <strong>{focusRow ? `${focusRow.rank} з ${rows.length}` : '—'}</strong>
                <small className={focusMovement > 0 ? 'is-up' : focusMovement < 0 ? 'is-down' : ''}>
                  {focusMovement > 0 ? <ArrowUp size={12} aria-hidden="true" /> : null}
                  {focusMovement < 0 ? <ArrowDown size={12} aria-hidden="true" /> : null}
                  {!focusRow ? 'Ще немає каси' : focusMovement !== 0 ? `${Math.abs(focusMovement)} за день` : 'Без змін'}
                </small>
              </div>
            </div>

            {canEdit ? (
              <button type="button" className="cv3-primary" onClick={() => openDay(quickDate)}>
                {asNumber(quickEntry?.cash) > 0 ? <Pencil size={18} /> : <Plus size={19} />}
                {quickLabel}
              </button>
            ) : null}

            <section className="cv3-card cv3-chart-card" aria-labelledby="cv3-chart-title">
              <div className="cv3-card-head">
                <h3 id="cv3-chart-title">Каса по днях</h3>
                {current.bestDate ? <span>Найкращий день: {money(current.bestCash)}</span> : null}
              </div>
              <div className="cv3-chart" style={{ '--avg': averageShare } as CSSProperties}>
                {current.averageCash > 0 ? <span className="cv3-avg" aria-hidden="true"><em>сер. {amount(current.averageCash)}</em></span> : null}
                {current.cashDays === 0 ? <p className="cv3-chart-empty">Каси за цей період ще немає</p> : null}
                {days.map((day) => {
                  const isBest = day.cash > 0 && day.date === current.bestDate;
                  const isToday = day.date === todayKey;
                  const height = day.cash > 0 ? Math.max(6, (day.cash / maxCash) * 100) : 0;
                  const showLabel = !denseAxis || day.day === 1 || day.day % 5 === 0 || isToday;
                  return (
                    <button
                      type="button"
                      key={day.date}
                      className={`cv3-day${isBest ? ' is-best' : ''}${isToday ? ' is-today' : ''}${day.cash > 0 ? ' has-cash' : ''}`}
                      disabled={!canEdit || day.future}
                      onClick={() => openDay(day.date)}
                      aria-label={`${formatDay(day.date)}: ${day.cash > 0 ? money(day.cash) : 'без каси'}`}
                    >
                      <span className="cv3-bar-track"><span className="cv3-bar-fill" style={{ height: `${height}%` }} /></span>
                      <span className="cv3-day-num">{showLabel ? day.day : ''}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="cv3-card cv3-records" aria-labelledby="cv3-records-title">
              <div className="cv3-card-head">
                <h3 id="cv3-records-title">Записи</h3>
                <span>{rangeLabel}</span>
              </div>
              {records.length === 0 ? (
                <p className="cv3-empty">За цей період записів ще немає. Внеси касу після зміни, і вона з’явиться тут.</p>
              ) : (
                <ul>
                  {records.map((record) => {
                    const details = [
                      record.tips > 0 ? `чайові ${money(record.tips)}` : '',
                      record.extra !== 0 ? `доплата ${money(record.extra)}${record.note ? `, ${record.note}` : ''}` : '',
                    ].filter(Boolean).join(' · ');
                    return (
                      <li key={record.date}>
                        <button type="button" onClick={() => openDay(record.date)} disabled={!canEdit}>
                          <span className="cv3-rec-main">
                            <strong>{formatListDay(record.date)}</strong>
                            {details ? <small>{details}</small> : null}
                          </span>
                          <span className="cv3-rec-sum">
                            <strong>{record.cash > 0 ? money(record.cash) : '—'}</strong>
                            <small>+{money(record.dayWage)} до виплати</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {data && tab === 'top' ? (
        <CashTopList
          rows={rows}
          period={period}
          daysInMonth={daysInMonth}
          monthLabel={`${MONTHS[monthIndex]} ${monthDate.getFullYear()}`}
          year={monthDate.getFullYear()}
          focusUserId={data.viewUserId}
          refreshing={loading}
          onPeriodChange={setPeriod}
        />
      ) : null}

      {editor ? (
        <DayEditor
          key={editor.date}
          initial={editor}
          month={month}
          daysInMonth={daysInMonth}
          maxDate={todayKey}
          exists={Boolean(entryByDate.get(editor.date) || extraByDate.get(editor.date))}
          saving={saving}
          error={actionError}
          onDateChange={(date) => openDay(date)}
          onClose={() => { if (!saving) setEditor(null); }}
          onSave={async (next) => { if (await saveDay(next)) setEditor(null); }}
          onDelete={async (date) => { if (await deleteDay(date)) setEditor(null); }}
        />
      ) : null}
    </div>
  );
}

interface DayEditorProps {
  initial: DayEditorState;
  month: string;
  daysInMonth: number;
  maxDate: string;
  exists: boolean;
  saving: boolean;
  error: string | null;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onSave: (next: DayEditorState) => void;
  onDelete: (date: string) => void;
}

function DayEditor({
  initial,
  month,
  daysInMonth,
  maxDate,
  exists,
  saving,
  error,
  onDateChange,
  onClose,
  onSave,
  onDelete,
}: DayEditorProps) {
  const [form, setForm] = useState(initial);
  const [extraOpen, setExtraOpen] = useState(Boolean(asNumber(initial.extra) || initial.note));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const lastDay = dateForDay(month, daysInMonth);
  const maxForInput = maxDate < lastDay ? (maxDate >= dateForDay(month, 1) ? maxDate : lastDay) : lastDay;
  const cash = asNumber(form.cash);
  const dayWage = cash * CASH_PERCENT + (cash > 0 ? RATE_PER_DAY : 0) + asNumber(form.extra);

  // ModalRuntime owns focus, scroll locking and phone placement for every dialog;
  // marking the cash field lets it open the keyboard straight on the amount.
  useLayoutEffect(() => {
    cashRef.current?.setAttribute('autofocus', '');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const controls = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="cv3-sheet-backdrop" onMouseDown={onClose}>
      <div
        ref={sheetRef}
        className="cv3-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="cv3-sheet-head">
          <h2 id={titleId}>{formatDay(form.date)}</h2>
          <button type="button" className="cv3-icon-btn" onClick={onClose} aria-label="Закрити" disabled={saving}><X size={20} /></button>
        </div>

        <form
          className="cv3-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
        >
          <label className="cv3-field">
            <span>Дата</span>
            <input
              type="date"
              value={form.date}
              min={dateForDay(month, 1)}
              max={maxForInput}
              onChange={(event) => { if (event.target.value) onDateChange(event.target.value); }}
            />
          </label>

          <label className="cv3-field cv3-field-cash">
            <span>Каса за зміну</span>
            <span className="cv3-money-input">
              <input
                ref={cashRef}
                inputMode="decimal"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                autoComplete="off"
                value={form.cash}
                onChange={(event) => setForm({ ...form, cash: event.target.value })}
              />
              <b>₴</b>
            </span>
          </label>

          <label className="cv3-field">
            <span>Чайові</span>
            <span className="cv3-money-input is-small">
              <input
                inputMode="decimal"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.tips}
                onChange={(event) => setForm({ ...form, tips: event.target.value })}
              />
              <b>₴</b>
            </span>
          </label>

          {extraOpen ? (
            <div className="cv3-extra">
              <label className="cv3-field">
                <span>Доплата</span>
                <span className="cv3-money-input is-small">
                  <input
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.extra}
                    onChange={(event) => setForm({ ...form, extra: event.target.value })}
                  />
                  <b>₴</b>
                </span>
              </label>
              <label className="cv3-field">
                <span>За що доплата</span>
                <input
                  type="text"
                  maxLength={300}
                  placeholder="Банкет, підміна, додаткові години"
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </label>
            </div>
          ) : (
            <button type="button" className="cv3-link cv3-add-extra" onClick={() => setExtraOpen(true)}>
              <Plus size={16} /> Додати доплату
            </button>
          )}

          <p className="cv3-estimate">
            До виплати за цей день <strong>{money(dayWage)}</strong>
            <small>4% каси{cash > 0 ? ' + ставка 200 ₴' : ''}{asNumber(form.extra) ? ' + доплата' : ''}</small>
          </p>

          {error ? <p className="cv3-form-error" role="alert">{error}</p> : null}

          <div className="cv3-sheet-actions">
            {exists ? (
              confirmDelete ? (
                <button type="button" className="cv3-danger is-confirm" disabled={saving} onClick={() => onDelete(form.date)}>
                  <Trash2 size={17} /> Так, видалити
                </button>
              ) : (
                <button type="button" className="cv3-danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={17} /> Видалити
                </button>
              )
            ) : null}
            <button type="submit" className="cv3-primary" disabled={saving}>
              {saving ? <RefreshCw size={18} className="cv3-spin" /> : <Check size={18} />}
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
