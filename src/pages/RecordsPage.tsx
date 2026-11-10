import { Check, ChevronRight, Edit3, Plus, RefreshCw, Trash2, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Overlay } from '../components/Overlay';
import { useKyivDay } from '../hooks/useKyivDay';
import { secureApi } from '../lib/secureApi';
import './records-v3.css';

/* ---------- data ---------- */

type ManualCategory = 'largest_tip' | 'plates_at_once' | 'tables_at_once';
type HalfKey = 'first' | 'second';
type View = 'fame' | 'mine';
type BoardKey = 'largestMonthCash' | 'largestHalfCash' | 'largestTip' | 'platesAtOnce' | 'tablesAtOnce' | 'largestMonthShifts' | 'largestHalfShifts';
type ValueKind = 'money' | 'plates' | 'tables' | 'shifts';
type DetailKind = 'month' | 'half' | 'date';

interface Staff { id: string; name: string; avatar: string | null }
interface PeriodRecord { value: number; month: string | null; half?: HalfKey | null }
interface ManualRecord { value: number; achievedOn: string; updatedAt: string }

interface Bootstrap {
  ok: true;
  viewUserId: string;
  me: { legacyUserId: string; canViewAll: boolean; canEditAll: boolean };
  users: Staff[];
  automatic: { largestMonthCash: PeriodRecord; largestHalfCash: PeriodRecord; largestMonthShifts: PeriodRecord; largestHalfShifts: PeriodRecord };
  manual: Partial<Record<ManualCategory, ManualRecord>>;
}

interface Ranked {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  value: number;
  month?: string | null;
  half?: HalfKey | null;
  achievedOn?: string | null;
}

interface Leaderboard {
  ok: true;
  comparisonUserId: string;
  waiterCount: number;
  leaderboards: Record<BoardKey, { top: Ranked[]; comparison: Ranked | null }>;
}

interface Category {
  key: BoardKey;
  title: string;
  kind: ValueKind;
  detail: DetailKind;
  manual?: ManualCategory;
}

/** Hall order: money first, then the floor feats, then stamina. */
const CATEGORIES: Category[] = [
  { key: 'largestMonthCash', title: 'Каса за місяць', kind: 'money', detail: 'month' },
  { key: 'largestHalfCash', title: 'Каса за півмісяця', kind: 'money', detail: 'half' },
  { key: 'largestTip', title: 'Найбільші чайові', kind: 'money', detail: 'date', manual: 'largest_tip' },
  { key: 'platesAtOnce', title: 'Тарілок за раз', kind: 'plates', detail: 'date', manual: 'plates_at_once' },
  { key: 'tablesAtOnce', title: 'Столиків одночасно', kind: 'tables', detail: 'date', manual: 'tables_at_once' },
  { key: 'largestMonthShifts', title: 'Змін за місяць', kind: 'shifts', detail: 'month' },
  { key: 'largestHalfShifts', title: 'Змін за півмісяця', kind: 'shifts', detail: 'half' },
];

const MANUAL_INPUT: Record<ManualCategory, { label: string; unit: string; max: number; integer: boolean; hint: string }> = {
  largest_tip: { label: 'Сума чайових, ₴', unit: '₴', max: 1_000_000, integer: true, hint: 'Найбільші чайові за один стіл або подію.' },
  plates_at_once: { label: 'Скільки тарілок', unit: 'шт.', max: 200, integer: true, hint: 'Найбільше тарілок, винесених за один раз.' },
  tables_at_once: { label: 'Скільки столиків', unit: 'шт.', max: 200, integer: true, hint: 'Найбільше столиків у роботі одночасно.' },
};

/* ---------- formatting ---------- */

const MONTH = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' });
const DATE = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
const NUMBER = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });

function plural(count: number, one: string, few: string, many: string): string {
  const value = Math.abs(Math.trunc(count));
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function valueText(kind: ValueKind, value: number): { number: string; unit: string } {
  if (kind === 'money') return { number: NUMBER.format(value), unit: '₴' };
  if (kind === 'plates') return { number: NUMBER.format(value), unit: plural(value, 'тарілка', 'тарілки', 'тарілок') };
  if (kind === 'tables') return { number: NUMBER.format(value), unit: plural(value, 'столик', 'столики', 'столиків') };
  return { number: NUMBER.format(value), unit: plural(value, 'зміна', 'зміни', 'змін') };
}

const flat = (kind: ValueKind, value: number) => { const text = valueText(kind, value); return `${text.number} ${text.unit}`; };

function monthText(month: string | null | undefined): string {
  if (!month) return '';
  const label = MONTH.format(new Date(`${month}-01T12:00:00`));
  return label.replace(/\s*р\.$/, '');
}

function halfText(month: string | null | undefined, half: HalfKey | null | undefined): string {
  if (!month || !half) return '';
  const [year = '', monthNumber = ''] = month.split('-');
  const days = new Date(Number(year), Number(monthNumber), 0).getDate();
  // Same split as the server's record maths (tiflis-secure-api): 1–14 and 15–end. «1–14 серпня 2026».
  const endDay = half === 'first' ? 14 : days;
  const end = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(new Date(Number(year), Number(monthNumber) - 1, endDay, 12));
  return `${half === 'first' ? '1' : '15'}–${end} ${year}`;
}

function detailText(category: Category, record: { month?: string | null; half?: HalfKey | null; achievedOn?: string | null }): string {
  if (category.detail === 'date') return record.achievedOn ? DATE.format(new Date(`${record.achievedOn}T12:00:00`)).replace(/\s*р\.$/, '') : '';
  if (category.detail === 'half') return halfText(record.month, record.half);
  return monthText(record.month);
}

/** Equal values share a place (competition ranking: 1, 1, 3) — the server numbers them 1, 2, 3. */
function sharedRank(top: Ranked[], value: number): number {
  return 1 + top.filter((row) => row.value > value).length;
}

/** Server errors arrive in English; staff read Ukrainian. */
function humanError(reason: unknown, fallback: string): string {
  const message = reason instanceof Error ? reason.message : '';
  if (/Invalid record/i.test(message)) return 'Не вдалося зберегти: перевір значення і дату.';
  if (/Waiter profile not found|Records access denied/i.test(message)) return 'Рекорди ведуться лише для офіціантів.';
  if (/Insufficient permissions/i.test(message)) return 'Немає прав змінювати цей рекорд.';
  if (/^[A-Za-z]/.test(message) || !message) return fallback;
  return message;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '—';
}

/* ---------- page ---------- */

export function RecordsPage() {
  const { user } = useAuth();
  const today = useKyivDay();
  const [view, setView] = useState<View>('fame');
  const [viewUserId, setViewUserId] = useState(user?.id || '');
  const [mine, setMine] = useState<Bootstrap | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ManualCategory | null>(null);
  const requestId = useRef(0);

  useEffect(() => { if (user && !viewUserId) setViewUserId(user.id); }, [user, viewUserId]);

  // Both views come from one load: the hall needs the board, «Мої рекорди» needs both (values + places).
  const load = useCallback(async (forceRefresh = false) => {
    if (!viewUserId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [personal, leaderboard] = await Promise.all([
        secureApi<Bootstrap>({ action: 'records_bootstrap', user_id: viewUserId }, 'tiflis-secure-api', { forceRefresh }),
        secureApi<Leaderboard>({ action: 'records_leaderboard_get', user_id: viewUserId }, 'tiflis-secure-api', { forceRefresh }),
      ]);
      if (requestId.current !== id) return;
      setMine(personal);
      setBoard(leaderboard);
      if (personal.viewUserId !== viewUserId) setViewUserId(personal.viewUserId);
    } catch (reason) {
      if (requestId.current === id) setError(humanError(reason, 'Не вдалося завантажити рекорди.'));
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [viewUserId]);

  useEffect(() => { void load(); }, [load]);

  const myId = mine?.me.legacyUserId || '';
  const viewed = mine?.users.find((staff) => staff.id === mine.viewUserId) || null;
  const isOwn = Boolean(mine && mine.viewUserId === myId);
  const canEdit = Boolean(mine && (mine.me.canEditAll || isOwn));

  return (
    <div className="rc3">
      <div className="rc3-top">
        <div className="rc3-seg" role="group" aria-label="Розділ рекордів">
          <button type="button" aria-pressed={view === 'fame'} className={view === 'fame' ? 'is-on' : ''} onClick={() => setView('fame')}>Дошка слави</button>
          <button type="button" aria-pressed={view === 'mine'} className={view === 'mine' ? 'is-on' : ''} onClick={() => setView('mine')}>{mine?.me.canViewAll && !isOwn ? 'Рекорди офіціанта' : 'Мої рекорди'}</button>
        </div>
        <Link to="/cash?tab=top" className="rc3-race">Хто лідирує цього місяця — у Касі <ChevronRight size={16} aria-hidden="true" /></Link>
      </div>

      {error ? (
        <div className="rc3-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load(true)}>Спробувати ще раз</button>
        </div>
      ) : null}

      {loading ? <div className="rc3-loading" role="status" aria-label="Збираємо рекорди"><span /><span /><span /></div> : null}

      {board && !loading && view === 'fame' ? <Fame board={board} myId={myId} /> : null}

      {board && mine && !loading && view === 'mine' ? (
        <section className="rc3-mine" aria-label="Особисті рекорди">
          <div className="rc3-person">
            <Avatar name={viewed?.name || 'Офіціант'} avatar={viewed?.avatar || null} size="lg" />
            <div>
              <h2>{viewed?.name || 'Офіціант'}</h2>
              <p>Серед {board.waiterCount} {plural(board.waiterCount, 'офіціанта', 'офіціантів', 'офіціантів')}</p>
            </div>
            {mine.me.canViewAll ? (
              <label className="rc3-select">
                <span className="rc3-sr">Чиї рекорди</span>
                <select value={mine.viewUserId} onChange={(event) => setViewUserId(event.target.value)}>
                  {mine.users.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}{staff.id === myId ? ' (ти)' : ''}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          <ul className="rc3-list">
            {CATEGORIES.map((category) => (
              <li key={category.key}>
                <MineRow
                  category={category}
                  group={board.leaderboards[category.key]}
                  userId={mine.viewUserId}
                  own={isOwn}
                  waiters={board.waiterCount}
                  manual={category.manual ? mine.manual[category.manual] : undefined}
                  canEdit={canEdit}
                  onEdit={() => category.manual && setEditor(category.manual)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editor && mine ? (
        <Overlay>
          <ManualEditor
            category={editor}
            title={`${CATEGORIES.find((item) => item.manual === editor)!.title}${isOwn ? '' : ` · ${viewed?.name || ''}`}`}
            current={mine.manual[editor]}
            userId={mine.viewUserId}
            today={today}
            onClose={() => setEditor(null)}
            onSaved={async () => { setEditor(null); await load(true); }}
          />
        </Overlay>
      ) : null}
    </div>
  );
}

/* ---------- pieces ---------- */

function Avatar({ name, avatar, size }: { name: string; avatar: string | null; size: 'sm' | 'md' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`rc3-avatar is-${size}`} aria-hidden="true">
      {avatar && !broken ? <img src={avatar} alt="" loading="lazy" onError={() => setBroken(true)} /> : <b>{initials(name)}</b>}
    </span>
  );
}

/** Дошка слави: one plaque per category — the holder large, places 2–5 beneath, and the viewer's own place if lower. */
function Fame({ board, myId }: { board: Leaderboard; myId: string }) {
  return (
    <section className="rc3-fame" aria-label="Дошка слави">
      {CATEGORIES.map((category) => {
        const group = board.leaderboards[category.key];
        const best = group.top[0]?.value ?? 0;
        // Everyone on the best value holds the record together.
        const holders = group.top.filter((row) => row.value === best && best > 0);
        const holder = holders[0];
        const rest = group.top.filter((row) => !holders.includes(row));
        const mineInTop = group.top.some((row) => row.userId === myId);
        const own = group.comparison && group.comparison.userId === myId && !mineInTop ? group.comparison : null;
        return (
          <article key={category.key} className={`rc3-plaque${rest.length ? '' : ' is-solo'}`} aria-labelledby={`rc3-${category.key}`}>
            <h2 id={`rc3-${category.key}`}>{category.title}</h2>
            {holder ? (
              <>
                <div className="rc3-holder">
                  <Avatar name={holder.name} avatar={holder.avatar} size="md" />
                  <div>
                    <p className="rc3-holder-value"><b>{valueText(category.kind, holder.value).number}</b> {valueText(category.kind, holder.value).unit}</p>
                    {holders.map((row) => (
                      <div key={row.userId} className={`rc3-holder-line${row.userId === myId ? ' is-me' : ''}`}>
                        <p className="rc3-holder-name"><Trophy size={14} aria-hidden="true" /> {row.name}{row.userId === myId ? <span className="rc3-you">Ти</span> : null}</p>
                        {holders.length > 1 && detailText(category, row) ? <p className="rc3-holder-when">{detailText(category, row)}</p> : null}
                      </div>
                    ))}
                    {holders.length === 1 && detailText(category, holder) ? <p className="rc3-holder-when">{detailText(category, holder)}</p> : null}
                  </div>
                </div>
                {rest.length ? (
                  <ol className="rc3-places">
                    {rest.map((row) => (
                      <li key={row.userId} className={row.userId === myId ? 'is-me' : ''}>
                        <span className="rc3-rank">{sharedRank(group.top, row.value)}</span>
                        <span className="rc3-place-name">{row.name}{row.userId === myId ? <span className="rc3-you">Ти</span> : null}</span>
                        <span className="rc3-place-value">{flat(category.kind, row.value)}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {own ? (
                  <p className="rc3-own-place">Твоє місце <b>{own.rank}</b> · {flat(category.kind, own.value)}</p>
                ) : null}
              </>
            ) : (
              <p className="rc3-empty">{category.manual ? 'Рекорд ще ніхто не вніс. Може, ти перший?' : 'Ще немає даних.'}</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

/** One personal record: own value, place, and the distance to the restaurant record. */
function MineRow({ category, group, userId, own, waiters, manual, canEdit, onEdit }: {
  category: Category; group: { top: Ranked[]; comparison: Ranked | null }; userId: string; own: boolean; waiters: number;
  manual: ManualRecord | undefined; canEdit: boolean; onEdit: () => void;
}) {
  const record = group.comparison && group.comparison.userId === userId ? group.comparison : group.top.find((row) => row.userId === userId) || null;
  const holder = group.top[0] || null;
  // A tie with the best value is a shared restaurant record, not «2 місце».
  const isHolder = Boolean(record && holder && record.value > 0 && record.value === holder.value);
  const gap = record && holder && !isHolder ? holder.value - record.value : 0;
  const place = record ? (group.top.some((row) => row.userId === record.userId) ? sharedRank(group.top, record.value) : record.rank) : 0;

  return (
    <article className={`rc3-row${isHolder ? ' is-holder' : ''}`}>
      <div className="rc3-row-main">
        <h3>{category.title}</h3>
        {record && record.value > 0 ? (
          <>
            <p className="rc3-row-value"><b>{valueText(category.kind, record.value).number}</b> {valueText(category.kind, record.value).unit}</p>
            {detailText(category, record) ? <p className="rc3-row-when">{detailText(category, record)}</p> : null}
          </>
        ) : <p className="rc3-row-when">{category.manual ? (own ? 'Ще не внесено' : 'Не внесено') : 'Ще немає даних'}</p>}
      </div>
      <div className="rc3-row-side">
        {record && record.value > 0 ? (
          isHolder
            ? <span className="rc3-badge"><Trophy size={14} aria-hidden="true" /> Рекорд ресторану</span>
            : <span className="rc3-place"><b>{place}</b> місце з {waiters}</span>
        ) : null}
        {gap > 0 ? <span className="rc3-gap">до рекорду {flat(category.kind, gap)}</span> : null}
        {!(record && record.value > 0) && holder ? <span className="rc3-gap">рекорд — {flat(category.kind, holder.value)}</span> : null}
        {category.manual && canEdit ? (
          <button type="button" className="rc3-edit" onClick={onEdit}>
            {manual ? <Edit3 size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />} {manual ? 'Оновити' : 'Внести'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ManualEditor({ category, title, current, userId, today, onClose, onSaved }: {
  category: ManualCategory; title: string; current: ManualRecord | undefined; userId: string; today: string;
  onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const spec = MANUAL_INPUT[category];
  const [value, setValue] = useState(current ? String(current.value) : '');
  const [date, setDate] = useState(current?.achievedOn || today);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { inputRef.current?.setAttribute('autofocus', ''); }, []);
  const dirty = value !== (current ? String(current.value) : '') || date !== (current?.achievedOn || today);
  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm('Закрити? Рекорд не буде збережено.')) return;
    onClose();
  }

  async function save() {
    const number = Number(value.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(number) || number <= 0 || (spec.integer && !Number.isInteger(number))) {
      setProblem(category === 'largest_tip' ? 'Вкажи суму в гривнях, цілим числом.' : 'Вкажи цілу кількість, більшу за нуль.');
      return;
    }
    if (number > spec.max) { setProblem(`Не більше ${NUMBER.format(spec.max)} ${spec.unit}`); return; }
    if (!date || date > today) { setProblem('Вкажи дату — не пізніше сьогодні.'); return; }
    setBusy('save');
    setProblem(null);
    try {
      await secureApi({ action: 'records_save_manual', user_id: userId, category, value: number, achieved_on: date });
      await onSaved();
    } catch (reason) {
      setProblem(humanError(reason, 'Не вдалося зберегти рекорд.'));
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    setProblem(null);
    try {
      await secureApi({ action: 'records_delete_manual', user_id: userId, category });
      await onSaved();
    } catch (reason) {
      setProblem(humanError(reason, 'Не вдалося видалити рекорд.'));
      setBusy(null);
    }
  }

  return (
    <div className="rc3-backdrop" onMouseDown={requestClose}>
      <section className="rc3-sheet" role="dialog" aria-modal="true" aria-labelledby="rc3-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="rc3-sheet-head">
          <h2 id="rc3-editor-title">{title}</h2>
          <button type="button" className="rc3-close" onClick={requestClose} disabled={Boolean(busy)} aria-label="Закрити"><X size={20} /></button>
        </div>
        <p className="rc3-hint">{spec.hint}</p>
        <label className="rc3-field">
          <span>{spec.label}</span>
          <span className="rc3-money">
            <input ref={inputRef} inputMode={spec.integer ? 'numeric' : 'decimal'} value={value} onChange={(event) => { setProblem(null); setValue(event.target.value); }} />
            <b>{spec.unit}</b>
          </span>
        </label>
        <label className="rc3-field">
          <span>Коли</span>
          <input type="date" max={today} value={date} onChange={(event) => { setProblem(null); setDate(event.target.value); }} />
        </label>
        {problem ? <p className="rc3-error" role="alert">{problem}</p> : null}
        <div className="rc3-sheet-actions">
          {current ? (
            confirmDelete
              ? <button type="button" className="rc3-danger is-confirm" onClick={() => void remove()} disabled={Boolean(busy)}><Trash2 size={16} aria-hidden="true" /> Так, видалити</button>
              : <button type="button" className="rc3-danger" onClick={() => setConfirmDelete(true)} disabled={Boolean(busy)}>Видалити</button>
          ) : null}
          <button type="button" className="rc3-primary" onClick={() => void save()} disabled={Boolean(busy)}>
            {busy === 'save' ? <RefreshCw size={16} className="rc3-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Зберегти
          </button>
        </div>
      </section>
    </div>
  );
}
