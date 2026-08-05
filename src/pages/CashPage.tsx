import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Crown,
  Edit3,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { CashLeaderboard } from '../components/CashLeaderboard';
import { secureApi } from '../lib/secureApi';
import './cash.css';
import './cash-practical.css';

type CashTab = 'overview' | 'leaderboard' | 'team';
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
  rank: number;
  mine: boolean;
}

interface RatingComment {
  id: number;
  user_id: string;
  author: string;
  delta: number | null;
  comment: string | null;
  created_at: string | null;
}

interface StaffRating {
  userId: string;
  name: string;
  role: string;
  score: number;
  comments: RatingComment[];
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
  ratings: StaffRating[];
}

interface DayEditorState {
  date: string;
  cash: string;
  tips: string;
  extra: string;
  note: string;
}

interface RatingEditorState {
  userId: string;
  name: string;
  score: number;
  comment: string;
}

const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністрація', sysadmin: 'Сисадмін', waiter: 'Офіціант',
  bar: 'Бар', barman: 'Бар', hostess: 'Хостес', runner: 'Ранер',
  chef: 'Шеф', cook: 'Кухня',
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

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${value}T12:00:00`));
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function scoreTone(score: number): string {
  if (score >= 35) return 'positive';
  if (score <= -20) return 'negative';
  return 'neutral';
}

function inDayRange(value: string, month: string, fromDay: number, toDay: number): boolean {
  return value >= dateForDay(month, fromDay) && value <= dateForDay(month, toDay);
}

function summarizePayroll(entries: CashEntry[], extras: ExtraWage[], month: string, daysInMonth: number) {
  const scopedEntries = entries.filter((entry) => inDayRange(entry.date, month, 1, daysInMonth));
  const scopedExtras = extras.filter((entry) => inDayRange(entry.date, month, 1, daysInMonth));
  const cash = scopedEntries.reduce((sum, entry) => sum + asNumber(entry.cash), 0);
  const tips = scopedEntries.reduce((sum, entry) => sum + asNumber(entry.tips), 0);
  const extra = scopedExtras.reduce((sum, entry) => sum + asNumber(entry.amount), 0);
  const workDays = scopedEntries.filter((entry) => asNumber(entry.cash) > 0).length;
  return { cash, tips, extra, workDays, wage: cash * 0.04 + workDays * 200 + extra };
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
  const [editor, setEditor] = useState<DayEditorState>(() => {
    const now = new Date();
    return {
      date: `${monthKey(now)}-${String(now.getDate()).padStart(2, '0')}`,
      cash: '', tips: '', extra: '', note: '',
    };
  });
  const [ratingEditor, setRatingEditor] = useState<RatingEditorState | null>(null);

  useEffect(() => {
    if (user && !viewUserId) setViewUserId(user.id);
  }, [user, viewUserId]);

  const load = useCallback(async () => {
    if (!viewUserId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<CashBootstrapResponse>({
        action: 'cash_bootstrap', month, user_id: viewUserId, leaderboard_period: leaderboardPeriod,
      });
      setData(response);
      if (response.viewUserId !== viewUserId) setViewUserId(response.viewUserId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити касу.');
    } finally {
      setLoading(false);
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
  const fullMonth = useMemo(
    () => summarizePayroll(entries, extras, month, daysInMonth),
    [daysInMonth, entries, extras, month],
  );
  const selectedStaff = data?.users.find((staff) => staff.id === data.viewUserId) || null;
  const canEdit = Boolean(data && (data.me.canEditAll || data.viewUserId === data.me.legacyUserId));
  const currentMonth = monthKey(new Date());
  const defaultDate = month === currentMonth ? dateForDay(month, new Date().getDate()) : dateForDay(month, 1);
  const selectedEntry = entryByDate.get(editor.date);
  const selectedExtra = extraByDate.get(editor.date);
  const selectedDayEstimate = asNumber(editor.cash) * 0.04
    + (asNumber(editor.cash) > 0 ? 200 : 0)
    + asNumber(editor.extra);

  function openDay(date: string) {
    const entry = entryByDate.get(date);
    const extra = extraByDate.get(date);
    const next = {
      date,
      cash: entry ? String(asNumber(entry.cash) || '') : '',
      tips: entry ? String(asNumber(entry.tips) || '') : '',
      extra: extra ? String(asNumber(extra.amount) || '') : '',
      note: extra?.description || '',
    };
    setEditor(next);
    setOptionalOpen(Boolean(asNumber(entry?.tips) || asNumber(extra?.amount) || extra?.description));
  }

  useEffect(() => {
    if (!editor.date.startsWith(`${month}-`)) openDay(defaultDate);
  }, [defaultDate, month]);

  useEffect(() => {
    if (!loading && data) openDay(editor.date.startsWith(`${month}-`) ? editor.date : defaultDate);
  }, [data?.viewUserId, loading]);

  function selectDay(date: string) {
    openDay(date);
    if (window.innerWidth <= 840) {
      window.requestAnimationFrame(() => {
        document.querySelector('.cash-practical-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  async function saveDay() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'cash_save_day', user_id: data.viewUserId, date: editor.date,
        cash: editor.cash, tips: editor.tips, extra_amount: editor.extra, extra_note: editor.note,
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
        action: 'cash_delete_day', user_id: data.viewUserId, date: editor.date,
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

  async function saveRating() {
    if (!ratingEditor) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'rating_update', user_id: ratingEditor.userId,
        score: ratingEditor.score, comment: ratingEditor.comment,
      });
      setRatingEditor(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Рейтинг не оновлено.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cash-page-v2">
      <section className="cash-hero-v2">
        <div>
          <span className="eyebrow">Фінанси зміни</span>
          <h2>Каса</h2>
          <p>Оберіть день у календарі, внесіть суму каси й збережіть. Решта полів відкривається лише за потреби.</p>
        </div>
        <div className="cash-hero-mark"><WalletCards size={35} /></div>
      </section>

      <section className="cash-toolbar-v2">
        <div className="cash-month-nav">
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="Попередній місяць"><ChevronLeft size={20} /></button>
          <div><span>{MONTHS[monthDate.getMonth()]}</span><strong>{monthDate.getFullYear()}</strong></div>
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="Наступний місяць"><ChevronRight size={20} /></button>
          <button type="button" className="cash-today-button" onClick={() => setMonth(currentMonth)}>Сьогодні</button>
        </div>
        <div className="cash-toolbar-actions">
          {data?.me.canViewAll ? (
            <label className="cash-user-select">
              <span>Працівник</span>
              <select value={viewUserId} onChange={(event) => setViewUserId(event.target.value)}>
                {data.users.map((staff) => <option value={staff.id} key={staff.id}>{staff.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {error ? <div className="cash-alert-v2" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
      {loading ? <div className="cash-loading-v2"><RefreshCw className="is-spinning" size={24} /><span>Завантажуємо касу…</span></div> : null}

      {!loading && data ? (
        <section className="cash-practical-workspace">
          <article className="cash-practical-calendar">
            <header>
              <div><span className="eyebrow">Календар каси</span><h3>{selectedStaff?.name || 'Моя каса'}</h3></div>
              <span>Натисніть день</span>
            </header>
            <div className="cash-practical-grid">
              {DOW.map((day) => <span className="cash-practical-dow" key={day}>{day}</span>)}
              {Array.from({ length: firstOffset }, (_, index) => <span className="cash-practical-empty" key={`empty-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                const date = dateForDay(month, day);
                const entry = entryByDate.get(date);
                const cash = asNumber(entry?.cash);
                return (
                  <button
                    type="button"
                    key={date}
                    className={`cash-practical-day ${cash > 0 ? 'has-cash' : ''} ${editor.date === date ? 'is-selected' : ''}`}
                    onClick={() => selectDay(date)}
                  >
                    <span>{day}</span>
                    {cash > 0 ? <strong>{calendarMoney(cash)}</strong> : <small>—</small>}
                  </button>
                );
              })}
            </div>
          </article>

          {canEdit ? (
            <article className="cash-practical-editor">
              <header>
                <div className="cash-selected-date"><span>Обраний день</span><strong>{formatDay(editor.date)}</strong></div>
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

              <details className="cash-optional-details" open={optionalOpen} onToggle={(event) => setOptionalOpen(event.currentTarget.open)}>
                <summary>Чайові та додаткова доплата</summary>
                <div className="cash-optional-fields">
                  <label><span>Чайові, ₴</span><input inputMode="decimal" type="number" min="0" value={editor.tips} onChange={(event) => setEditor({ ...editor, tips: event.target.value })} placeholder="0" /></label>
                  <label><span>Додаткова ставка / доплата, ₴</span><input inputMode="decimal" type="number" min="0" value={editor.extra} onChange={(event) => setEditor({ ...editor, extra: event.target.value })} placeholder="0" /></label>
                  <label><span>Причина доплати</span><input type="text" maxLength={300} value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} placeholder="Банкет, підміна, додаткові години…" /></label>
                </div>
              </details>

              <div className="cash-practical-summary"><span>Орієнтовна виплата за день</span><strong>{money(selectedDayEstimate)}</strong></div>
              <div className="cash-practical-actions">
                {selectedEntry || selectedExtra ? <button type="button" className="is-danger" onClick={() => void deleteDay()} disabled={saving}><Trash2 size={17} /></button> : <span />}
                <button type="button" className="is-primary" onClick={() => void saveDay()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />} Зберегти касу</button>
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      <nav className="cash-tabs-v2" aria-label="Розділи каси">
        {([['overview', 'Підсумок'], ['leaderboard', 'Топ каси'], ['team', 'Команда']] as const)
          .map(([key, label]) => <button type="button" key={key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>)}
      </nav>

      {!loading && data && tab === 'overview' ? (
        <section className="cash-compact-metrics">
          <article><Banknote size={20} /><span>Каса за місяць</span><strong>{money(fullMonth.cash)}</strong><small>{fullMonth.workDays} днів із внесеною касою</small></article>
          <article><TrendingUp size={20} /><span>Розрахункова виплата</span><strong>{money(fullMonth.wage)}</strong><small>4% + 200 ₴/день + доплати</small></article>
          <article><Coins size={20} /><span>Чайові</span><strong>{money(fullMonth.tips)}</strong><small>окремо від каси</small></article>
          <article><Sparkles size={20} /><span>Доплати</span><strong>{money(fullMonth.extra)}</strong><small>додаткові нарахування</small></article>
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

      {!loading && data && tab === 'team' ? (
        <section className="cash-team-rating-v2">
          <div className="cash-section-heading-v2"><div><span className="eyebrow">Сервіс і командна робота</span><h3>Рейтинг персоналу</h3></div><Star size={24} /></div>
          <div className="cash-rating-grid-v2">
            {data.ratings.map((rating) => (
              <article key={rating.userId} className={`tone-${scoreTone(rating.score)}`}>
                <div className="cash-rating-person-v2"><span>{initials(rating.name)}</span><div><strong>{rating.name}</strong><small>{roleLabel(rating.role)}</small></div><b>{rating.score > 0 ? '+' : ''}{rating.score}</b></div>
                <div className="cash-score-track-v2"><i style={{ left: '50%', width: `${Math.abs(rating.score) / 2}%`, transform: rating.score < 0 ? 'translateX(-100%)' : undefined }} /></div>
                <div className="cash-rating-comments-v2">{rating.comments.length === 0 ? <span>Останніх коментарів немає</span> : rating.comments.slice(0, 2).map((comment) => <p key={comment.id}><strong>{comment.delta && comment.delta > 0 ? '+' : ''}{comment.delta || 0}</strong><span>{comment.comment || 'Зміна оцінки'} · {comment.author}</span></p>)}</div>
                {data.me.canEditRatings ? <button type="button" onClick={() => setRatingEditor({ userId: rating.userId, name: rating.name, score: rating.score, comment: '' })}><Edit3 size={15} /> Оновити оцінку</button> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {ratingEditor ? (
        <div className="cash-sheet-backdrop-v2" onMouseDown={() => !saving && setRatingEditor(null)}>
          <section className="cash-sheet-v2 cash-rating-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="cash-sheet-heading-v2"><div><span className="eyebrow">Оцінка персоналу</span><h3>{ratingEditor.name}</h3><p>Шкала від −100 до +100</p></div><button type="button" onClick={() => setRatingEditor(null)} disabled={saving}><X size={19} /></button></div>
            <div className="cash-rating-control-v2"><output className={`tone-${scoreTone(ratingEditor.score)}`}>{ratingEditor.score > 0 ? '+' : ''}{ratingEditor.score}</output><input type="range" min="-100" max="100" value={ratingEditor.score} onChange={(event) => setRatingEditor({ ...ratingEditor, score: Number(event.target.value) })} /><div>{[-10, -5, -1, 1, 5, 10].map((delta) => <button type="button" key={delta} onClick={() => setRatingEditor({ ...ratingEditor, score: Math.max(-100, Math.min(100, ratingEditor.score + delta)) })}>{delta > 0 ? '+' : ''}{delta}</button>)}</div><label><span>Короткий коментар</span><textarea maxLength={500} value={ratingEditor.comment} onChange={(event) => setRatingEditor({ ...ratingEditor, comment: event.target.value })} placeholder="За що змінюється оцінка" /></label></div>
            <div className="cash-sheet-actions-v2"><span /><button type="button" className="is-primary" onClick={() => void saveRating()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Crown size={17} />} Оновити</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
