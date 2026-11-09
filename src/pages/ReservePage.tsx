import {
  Check,
  Phone,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Overlay } from '../components/Overlay';
import { secureApi } from '../lib/secureApi';
import './reserve-v3.css';

/* ---------- data ---------- */

type Status = 'booked' | 'occupied' | 'completed' | 'cancelled' | 'no_show';
type View = 'list' | 'floor';

interface Hall { id: number; name: string; sort_order: number; note: string | null; active: boolean }

interface Table {
  id: number;
  hall_id: number;
  label: string;
  capacity: number;
  kind: string;
  position_x: number | string | null;
  position_y: number | string | null;
  sort_order: number;
  active: boolean;
}

interface Reservation {
  id: number;
  hall_id: number;
  table_id: number;
  reserved_date: string;
  reserved_time: string;
  duration_minutes: number;
  guests: number;
  guest_name: string;
  phone: string | null;
  menu_note: string | null;
  note: string | null;
  status: Status;
  merged_tables: string[] | null;
  created_by: string | null;
  updated_by: string | null;
}

interface Bootstrap {
  ok: true;
  selectedDate: string;
  permissions: { canManage: boolean };
  halls: Hall[];
  tables: Table[];
  reservations: Reservation[];
}

interface Draft {
  id: number | null;
  date: string;
  time: string;
  duration: number;
  guests: number;
  name: string;
  phone: string;
  occasions: string[];
  note: string;
  menuNote: string;
  hallId: number | null;
  tableId: number | null;
  merged: string[];
  status: Status;
}

const STATUS_LABEL: Record<Status, string> = {
  booked: 'Чекаємо',
  occupied: 'За столом',
  completed: 'Пішли',
  cancelled: 'Скасовано',
  no_show: 'Не прийшли',
};

/** Quick tags a hostess hears on the phone; stored at the start of the service note as «А · Б. вільний текст». */
const OCCASIONS = ['День народження', 'Річниця', 'Ділова зустріч', 'Дитячий стілець', 'Тиха зона', 'Свій торт', 'Декор'];

const TIME_SLOTS = Array.from({ length: 21 }, (_, index) => {
  const minutes = 12 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 ? '30' : '00'}`;
});
const GUEST_CHIPS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const DURATIONS = [90, 120, 180, 240];
const DOW = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/* ---------- helpers ---------- */

/** Today in Kyiv, whatever the device clock zone is. */
function kyivToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
}

function kyivMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60 + Number(parts.find((part) => part.type === 'minute')?.value || 0);
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Same as the server: a missing duration counts as two hours. */
const lengthOf = (reservation: Reservation) => Number(reservation.duration_minutes || 120);
const SEATED_GRACE = 15;

/** Minutes a live booking blocks its tables; seated guests keep the table until at least now + 15 min (as the server does). */
function blockedLength(reservation: Reservation, today: string): number {
  if (reservation.status !== 'occupied' || reservation.reserved_date !== today) return lengthOf(reservation);
  return Math.max(lengthOf(reservation), kyivMinutesNow() + SEATED_GRACE - toMinutes(reservation.reserved_time));
}

function endTime(reservation: Reservation): string {
  const end = toMinutes(reservation.reserved_time) + lengthOf(reservation);
  return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function dayTitle(value: string, today: string): string {
  if (value === today) return 'Сьогодні';
  if (value === addDays(today, 1)) return 'Завтра';
  const label = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortDay(value: string, today: string): string {
  if (value === today) return 'Сьогодні';
  if (value === addDays(today, 1)) return 'Завтра';
  const date = new Date(`${value}T12:00:00`);
  return `${DOW[date.getDay()]}, ${date.getDate()}`;
}

const hhmm = (value: string) => value.slice(0, 5);
function toMinutes(value: string): number { return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)); }
const overlaps = (startA: number, lenA: number, startB: number, lenB: number) => startA < startB + lenB && startB < startA + lenA;
const isLive = (reservation: Reservation) => reservation.status === 'booked' || reservation.status === 'occupied';

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
const guestWord = (count: number) => plural(count, 'гість', 'гості', 'гостей');
const reserveWord = (count: number) => plural(count, 'резерв', 'резерви', 'резервів');

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours},5 год` : `${hours} год`;
}

/** Occasions live on the note's first line after a marker, so free text that looks like a tag is never mistaken for one:
    «Привід: День народження · Свій торт» + newline + free text. Waiters reading the raw note elsewhere still understand it. */
const OCCASION_MARKER = 'Привід: ';

function splitNote(note: string | null): { occasions: string[]; text: string } {
  if (!note) return { occasions: [], text: '' };
  if (!note.startsWith(OCCASION_MARKER)) return { occasions: [], text: note };
  const [head, ...rest] = note.split('\n');
  const tags = (head || '').slice(OCCASION_MARKER.length).split(' · ').filter((tag) => OCCASIONS.includes(tag));
  return { occasions: tags, text: rest.join('\n') };
}

function joinNote(occasions: string[], text: string): string {
  const tags = OCCASIONS.filter((tag) => occasions.includes(tag)).join(' · ');
  return [tags ? `${OCCASION_MARKER}${tags}` : '', text.trim()].filter(Boolean).join('\n');
}

function tableLabels(reservation: Reservation, tableById: Map<number, Table>): string[] {
  return [tableById.get(reservation.table_id)?.label || '', ...(reservation.merged_tables || [])].filter(Boolean);
}

function draftFrom(reservation: Reservation): Draft {
  const { occasions, text } = splitNote(reservation.note);
  return {
    id: reservation.id,
    date: reservation.reserved_date,
    time: hhmm(reservation.reserved_time),
    duration: lengthOf(reservation),
    guests: reservation.guests,
    name: reservation.guest_name,
    phone: reservation.phone || '',
    occasions,
    note: text,
    menuNote: reservation.menu_note || '',
    hallId: reservation.hall_id,
    tableId: reservation.table_id,
    merged: reservation.merged_tables || [],
    status: reservation.status,
  };
}

function newDraft(date: string, hallId: number | null = null, tableId: number | null = null): Draft {
  return { id: null, date, time: '', duration: 120, guests: 2, name: '', phone: '', occasions: [], note: '', menuNote: '', hallId, tableId, merged: [], status: 'booked' };
}

/* ---------- page ---------- */

export function ReservePage() {
  const [today, setToday] = useState(kyivToday);
  const [date, setDate] = useState(today);
  // A tablet left open past midnight must move to the new day.
  useEffect(() => {
    const refresh = () => setToday((current) => { const next = kyivToday(); if (next !== current) setDate((selected) => (selected === current ? next : selected)); return next; });
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer); };
  }, []);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [hallFilter, setHallFilter] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tableSheet, setTableSheet] = useState<Table | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [cardError, setCardError] = useState<{ id: number; message: string } | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (target = date) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<Bootstrap>({ action: 'reserve_bootstrap', date: target }, 'tiflis-reserve-api');
      if (requestId.current === id) setData(response);
    } catch (reason) {
      if (requestId.current === id) setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити резерви.');
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const halls = useMemo(() => [...(data?.halls || [])].sort((a, b) => a.sort_order - b.sort_order), [data]);
  const tables = useMemo(() => data?.tables || [], [data]);
  const tableById = useMemo(() => new Map(tables.map((table) => [table.id, table])), [tables]);
  const hallById = useMemo(() => new Map(halls.map((hall) => [hall.id, hall])), [halls]);
  const canManage = Boolean(data?.permissions.canManage);

  const dayReservations = useMemo(
    () => (data?.reservations || []).filter((reservation) => reservation.reserved_date === date)
      .sort((left, right) => left.reserved_time.localeCompare(right.reserved_time) || left.guest_name.localeCompare(right.guest_name, 'uk')),
    [data, date],
  );
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    (data?.reservations || []).filter(isLive).forEach((reservation) => map.set(reservation.reserved_date, (map.get(reservation.reserved_date) || 0) + 1));
    return map;
  }, [data]);

  const live = dayReservations.filter(isLive);
  const closedCount = dayReservations.length - live.length;
  const guests = live.reduce((sum, reservation) => sum + reservation.guests, 0);
  const seated = live.filter((reservation) => reservation.status === 'occupied').length;

  const needle = query.trim().toLocaleLowerCase('uk-UA');
  const matches = (reservation: Reservation) => {
    if (hallFilter !== 'all' && reservation.hall_id !== hallFilter) return false;
    if (!needle) return true;
    return [reservation.guest_name, reservation.phone, reservation.note, reservation.menu_note, ...tableLabels(reservation, tableById)]
      .join(' ').toLocaleLowerCase('uk-UA').includes(needle);
  };
  const visible = dayReservations.filter((reservation) => isLive(reservation) && matches(reservation));
  const closedVisible = dayReservations.filter((reservation) => !isLive(reservation) && matches(reservation));

  const slots: { time: string; items: Reservation[] }[] = [];
  visible.forEach((reservation) => {
    const time = hhmm(reservation.reserved_time);
    const last = slots[slots.length - 1];
    if (last?.time === time) last.items.push(reservation); else slots.push({ time, items: [reservation] });
  });

  // The floor always shows one concrete hall: the picked one, or the first.
  const floorHallId = hallFilter === 'all' ? halls[0]?.id ?? null : hallFilter;
  // The strip starts yesterday, or at the picked day when it is further away, so the selected day always has a chip.
  const stripStart = date < addDays(today, -1) || date > addDays(today, 12) ? addDays(date, -1) : addDays(today, -1);
  const strip = Array.from({ length: 14 }, (_, index) => addDays(stripStart, index));
  const windowFrom = data ? addDays(data.selectedDate, -14) : '';
  const windowTo = data ? addDays(data.selectedDate, 35) : '';
  const inWindow = (value: string) => Boolean(data) && value >= windowFrom && value <= windowTo;

  // Status taps change only the status (reserve_status), and report on the card that was tapped.
  async function setStatus(reservation: Reservation, status: Status) {
    setPending(reservation.id);
    setCardError(null);
    try {
      const response = await secureApi<{ ok: true; reservation: Reservation }>({ action: 'reserve_status', id: reservation.id, status }, 'tiflis-reserve-api');
      setData((current) => current && ({ ...current, reservations: current.reservations.map((item) => (item.id === reservation.id ? { ...item, ...response.reservation } : item)) }));
    } catch (reason) {
      setCardError({ id: reservation.id, message: reason instanceof Error ? reason.message : 'Статус не змінено.' });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rv3">
      <div className="rv3-days" role="group" aria-label="Дата">
        {strip.map((value) => {
          const parsed = new Date(`${value}T12:00:00Z`);
          const known = inWindow(value);
          const count = known ? countByDate.get(value) || 0 : 0;
          const label = `${value === today ? 'сьогодні, ' : ''}${new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parsed)}${count ? `, ${count} ${reserveWord(count)}` : ''}`;
          return (
            <button key={value} type="button" aria-pressed={value === date} aria-label={label} className={`${value === date ? 'is-on' : ''}${value === today ? ' is-today' : ''}`} onClick={() => setDate(value)}>
              <small aria-hidden="true">{DOW[parsed.getUTCDay()]}</small>
              <b aria-hidden="true">{parsed.getUTCDate()}</b>
              <i aria-hidden="true">{count || ''}</i>
            </button>
          );
        })}
        <label className="rv3-day-pick">
          <span className="rv3-sr">Інша дата</span>
          <input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
        </label>
      </div>

      <header className="rv3-head">
        <div>
          <h2>{dayTitle(date, today)}</h2>
          <p>{live.length ? `${live.length} ${reserveWord(live.length)} · ${guests} ${guestWord(guests)}${seated ? ` · ${seated} за столом` : ''}` : 'Резервів немає'}</p>
        </div>
        {canManage ? <button type="button" className="rv3-primary" onClick={() => setDraft(newDraft(date))}><Plus size={18} aria-hidden="true" /> Новий резерв</button> : null}
      </header>

      <div className="rv3-tools">
        <div className="rv3-seg" role="group" aria-label="Вигляд">
          <button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>Список</button>
          <button type="button" aria-pressed={view === 'floor'} className={view === 'floor' ? 'is-on' : ''} onClick={() => setView('floor')}>Схема залу</button>
        </div>
        {view === 'list' ? (
          <label className="rv3-search">
            <Search size={17} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Імʼя, телефон, стіл" aria-label="Пошук резерву" />
            {query ? <button type="button" onClick={() => setQuery('')} aria-label="Очистити пошук"><X size={15} /></button> : null}
          </label>
        ) : null}
      </div>

      <div className="rv3-chips" role="group" aria-label="Зал">
        {view === 'list' ? <button type="button" aria-pressed={hallFilter === 'all'} className={hallFilter === 'all' ? 'is-on' : ''} onClick={() => setHallFilter('all')}>Усі зали</button> : null}
        {halls.map((hall) => {
          const count = live.filter((reservation) => reservation.hall_id === hall.id).length;
          const on = view === 'floor' ? floorHallId === hall.id : hallFilter === hall.id;
          return (
            <button key={hall.id} type="button" aria-pressed={on} className={on ? 'is-on' : ''} onClick={() => setHallFilter(hall.id)}>
              {hall.name}{count ? <span>{count}</span> : null}
            </button>
          );
        })}
      </div>

      {error && !draft ? (
        <div className="rv3-alert" role="alert">
          <span>{error}</span>
          {!data ? <button type="button" onClick={() => void load()}>Спробувати ще раз</button> : <button type="button" onClick={() => setError(null)} aria-label="Закрити"><X size={16} /></button>}
        </div>
      ) : null}

      {loading && !data ? <div className="rv3-loading" role="status" aria-label="Завантажуємо резерви"><span /><span /><span /></div> : null}

      {data && view === 'list' ? (
        <>
          {!slots.length ? (
            <div className="rv3-empty">
              <p>{needle ? `Нічого не знайдено за «${query.trim()}».` : date === today ? 'Сьогодні резервів ще немає.' : date === addDays(today, 1) ? 'На завтра резервів ще немає.' : `На ${dayTitle(date, today).toLowerCase()} резервів ще немає.`}</p>
              {canManage && !needle ? <button type="button" className="rv3-secondary" onClick={() => setDraft(newDraft(date))}><Plus size={17} aria-hidden="true" /> Записати перший</button> : null}
            </div>
          ) : (
            <ol className="rv3-agenda">
              {slots.map((slot) => (
                <li key={slot.time} className="rv3-slot">
                  <time>{slot.time}</time>
                  <ul>
                    {slot.items.map((reservation) => (
                      <li key={reservation.id}>
                        <Booking
                          reservation={reservation}
                          labels={tableLabels(reservation, tableById)}
                          hall={hallById.get(reservation.hall_id)?.name || ''}
                          canManage={canManage}
                          busy={pending === reservation.id}
                          error={cardError?.id === reservation.id ? cardError.message : null}
                          onOpen={() => canManage && setDraft(draftFrom(reservation))}
                          onStatus={(status) => void setStatus(reservation, status)}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          {closedCount ? (
            <section className="rv3-closed" aria-label="Завершені й скасовані">
              <button type="button" className="rv3-link" aria-expanded={showClosed} onClick={() => setShowClosed((value) => !value)}>
                {showClosed ? 'Сховати завершені й скасовані' : `Показати завершені й скасовані · ${closedCount}`}
              </button>
              {showClosed ? (
                <ul>
                  {closedVisible.map((reservation) => (
                    <li key={reservation.id}>
                      <Booking
                        reservation={reservation}
                        labels={tableLabels(reservation, tableById)}
                        hall={hallById.get(reservation.hall_id)?.name || ''}
                        canManage={canManage}
                        busy={pending === reservation.id}
                        error={cardError?.id === reservation.id ? cardError.message : null}
                        onOpen={() => canManage && setDraft(draftFrom(reservation))}
                        onStatus={(status) => void setStatus(reservation, status)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {data && view === 'floor' ? (
        <Floor
          halls={halls}
          hallId={floorHallId}
          tables={tables}
          reservations={live}
          onTable={setTableSheet}
        />
      ) : null}

      {tableSheet ? (
        <Overlay>
          <TableSheet
            table={tableSheet}
            hall={hallById.get(tableSheet.hall_id)?.name || ''}
            day={dayTitle(date, today)}
            bookings={live.filter((reservation) => tableLabels(reservation, tableById).includes(tableSheet.label) && reservation.hall_id === tableSheet.hall_id)}
            canManage={canManage}
            onClose={() => setTableSheet(null)}
            onOpen={(reservation) => { setTableSheet(null); setDraft(draftFrom(reservation)); }}
            onNew={() => { setTableSheet(null); setDraft(newDraft(date, tableSheet.hall_id, tableSheet.id)); }}
          />
        </Overlay>
      ) : null}

      {draft ? (
        <Overlay>
          <ReservationForm
            initial={draft}
            today={today}
            halls={halls}
            tables={tables}
            loaded={data}
            onClose={() => setDraft(null)}
            onSaved={async (savedDate) => {
              setDraft(null);
              if (savedDate !== date) setDate(savedDate); else await load(savedDate);
            }}
          />
        </Overlay>
      ) : null}
    </div>
  );
}

/* ---------- one booking in the agenda ---------- */

function Booking({ reservation, labels, hall, canManage, busy, error, onOpen, onStatus }: {
  reservation: Reservation; labels: string[]; hall: string; canManage: boolean; busy: boolean; error: string | null;
  onOpen: () => void; onStatus: (status: Status) => void;
}) {
  const [more, setMore] = useState(false);
  const noShowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (more) noShowRef.current?.focus(); }, [more]);
  const { occasions, text } = splitNote(reservation.note);
  const closed = !isLive(reservation);

  return (
    <article className={`rv3-booking is-${reservation.status}`}>
      <button type="button" className="rv3-booking-main" onClick={onOpen} disabled={!canManage} aria-label={`${reservation.guest_name}, ${reservation.guests} ${guestWord(reservation.guests)}, ${hhmm(reservation.reserved_time)}${canManage ? ', редагувати' : ''}`}>
        <span className="rv3-booking-top">
          <strong>{reservation.guest_name}</strong>
          <span className="rv3-guests">{reservation.guests} <small>{guestWord(reservation.guests)}</small></span>
        </span>
        <span className="rv3-booking-where">{labels.length > 1 ? 'Столи' : 'Стіл'} {labels.join(' + ')} · {hall} · до {endTime(reservation)}</span>
        {occasions.length ? <span className="rv3-tags">{occasions.map((tag) => <b key={tag}>{tag}</b>)}</span> : null}
        {reservation.menu_note ? <span className="rv3-booking-note"><em>Меню:</em> {reservation.menu_note}</span> : null}
        {text ? <span className="rv3-booking-note">{text}</span> : null}
        {closed ? <span className="rv3-state">{STATUS_LABEL[reservation.status]}</span> : reservation.status === 'occupied' ? <span className="rv3-state is-seated"><Check size={13} aria-hidden="true" /> За столом</span> : null}
      </button>

      {canManage ? (
        <div className="rv3-booking-actions">
          {reservation.phone ? <a className="rv3-icon" href={`tel:${reservation.phone.replace(/[^\d+]/g, '')}`} aria-label={`Подзвонити: ${reservation.guest_name}`}><Phone size={17} aria-hidden="true" /></a> : null}
          {reservation.status === 'booked' ? (
            <>
              <button type="button" className="rv3-act is-seat" onClick={() => onStatus('occupied')} disabled={busy}>{busy ? <RefreshCw size={15} className="rv3-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Прийшли</button>
              {more ? (
                <>
                  <button ref={noShowRef} type="button" className="rv3-act" onClick={() => onStatus('no_show')} disabled={busy}>Не прийшли</button>
                  <button type="button" className="rv3-act" onClick={() => onStatus('cancelled')} disabled={busy}>Скасували</button>
                </>
              ) : <button type="button" className="rv3-act is-quiet" onClick={() => setMore(true)} aria-expanded="false">Інше</button>}
            </>
          ) : reservation.status === 'occupied' ? (
            <>
              <button type="button" className="rv3-act" onClick={() => onStatus('completed')} disabled={busy}>Стіл звільнився</button>
              <button type="button" className="rv3-act is-quiet" onClick={() => onStatus('booked')} disabled={busy}>Повернути</button>
            </>
          ) : (
            <button type="button" className="rv3-act is-quiet" onClick={() => onStatus('booked')} disabled={busy}>Відновити</button>
          )}
        </div>
      ) : null}
      {error ? <p className="rv3-card-error" role="alert">{error}</p> : null}
    </article>
  );
}

/* ---------- floor view ---------- */

function Floor({ halls, hallId, tables, reservations, onTable }: {
  halls: Hall[]; hallId: number | null; tables: Table[]; reservations: Reservation[]; onTable: (table: Table) => void;
}) {
  if (!hallId) return <p className="rv3-empty">Залів ще не налаштовано.</p>;
  const hallTables = tables.filter((table) => table.hall_id === hallId).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'uk', { numeric: true }));
  const maxX = Math.max(1, ...hallTables.map((table) => Number(table.position_x || 0))) + 1;
  const maxY = Math.max(1, ...hallTables.map((table) => Number(table.position_y || 0))) + 1;
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const bookingsFor = (table: Table) => reservations.filter((reservation) => reservation.hall_id === hallId && tableLabels(reservation, tableById).includes(table.label));
  const hall = halls.find((entry) => entry.id === hallId);

  return (
    <section className="rv3-floor" aria-label={`Схема: ${hall?.name || ''}`}>
      <div className="rv3-legend" aria-hidden="true"><span className="is-free">Вільний · місць</span><span className="is-booked">Резерв · час</span><span className="is-occupied">За столом</span></div>
      <div className="rv3-canvas" style={{ aspectRatio: `${Math.max(1.2, maxX / maxY)}` }}>
        {hallTables.map((table) => {
          const bookings = bookingsFor(table);
          const tone = bookings.some((reservation) => reservation.status === 'occupied') ? 'occupied' : bookings.length ? 'booked' : 'free';
          const next = bookings.find((reservation) => reservation.status === 'occupied') || bookings[0];
          const stateWord = tone === 'free' ? 'вільний' : tone === 'occupied' ? 'за столом' : 'резерв';
          return (
            <button
              key={table.id}
              type="button"
              className={`rv3-table is-${tone}`}
              style={{ left: `${((Number(table.position_x || 0) + 0.5) / maxX) * 100}%`, top: `${((Number(table.position_y || 0) + 0.5) / maxY) * 100}%` }}
              onClick={() => onTable(table)}
              aria-label={`Стіл ${table.label}, ${table.capacity} ${plural(table.capacity, 'місце', 'місця', 'місць')}, ${stateWord}${next ? `, ${hhmm(next.reserved_time)}, ${next.guest_name}` : ''}`}
            >
              <b>{table.label}</b>
              <small>{tone === 'occupied' ? 'за столом' : next ? hhmm(next.reserved_time) : `${table.capacity} м.`}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TableSheet({ table, hall, day, bookings, canManage, onClose, onOpen, onNew }: {
  table: Table; hall: string; day: string; bookings: Reservation[]; canManage: boolean;
  onClose: () => void; onOpen: (reservation: Reservation) => void; onNew: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { titleRef.current?.setAttribute('autofocus', ''); }, []);
  return (
    <div className="rv3-backdrop" onMouseDown={onClose}>
      <section className="rv3-sheet" role="dialog" aria-modal="true" aria-labelledby="rv3-table-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="rv3-sheet-head">
          <div>
            <h2 id="rv3-table-title" ref={titleRef} tabIndex={-1}>Стіл {table.label}</h2>
            <p>{hall} · {table.capacity} {plural(table.capacity, 'місце', 'місця', 'місць')} · {day}</p>
          </div>
          <button type="button" className="rv3-close" onClick={onClose} aria-label="Закрити"><X size={20} /></button>
        </div>
        {bookings.length ? (
          <ul className="rv3-table-list">
            {bookings.map((reservation) => (
              <li key={reservation.id}>
                <button type="button" onClick={() => canManage && onOpen(reservation)} disabled={!canManage}>
                  <time>{hhmm(reservation.reserved_time)}</time>
                  <span><strong>{reservation.guest_name}</strong><small>{reservation.guests} {guestWord(reservation.guests)} · {STATUS_LABEL[reservation.status]}</small></span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="rv3-sheet-empty">На цей день стіл вільний.</p>}
        {canManage ? <button type="button" className="rv3-primary is-wide" onClick={onNew}><Plus size={18} aria-hidden="true" /> Резерв на цей стіл</button> : null}
      </section>
    </div>
  );
}

/* ---------- the form: in the order of a phone call ---------- */

function ReservationForm({ initial, today, halls, tables, loaded, onClose, onSaved }: {
  initial: Draft; today: string; halls: Hall[]; tables: Table[]; loaded: Bootstrap | null;
  onClose: () => void; onSaved: (date: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [dayReservations, setDayReservations] = useState<Reservation[] | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAllTables, setShowAllTables] = useState(Boolean(initial.id));
  const nameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { titleRef.current?.setAttribute('autofocus', ''); }, []);

  const tableStepRef = useRef<HTMLFieldSetElement>(null);
  const [freshness, setFreshness] = useState(0);
  // Any change clears the last error: it described the previous attempt.
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setProblem(null); setDraft((current) => ({ ...current, [key]: value })); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // Availability is always fetched fresh for the chosen day (another hostess may have booked a minute ago).
  // Until it arrives, the page's own copy is shown when it covers that day.
  useEffect(() => {
    let cancelled = false;
    const covers = loaded && draft.date >= addDays(loaded.selectedDate, -14) && draft.date <= addDays(loaded.selectedDate, 35);
    setDayReservations(covers ? loaded.reservations.filter((reservation) => reservation.reserved_date === draft.date) : null);
    secureApi<Bootstrap>({ action: 'reserve_bootstrap', date: draft.date }, 'tiflis-reserve-api')
      .then((response) => { if (!cancelled) setDayReservations(response.reservations.filter((reservation) => reservation.reserved_date === draft.date)); })
      .catch(() => { if (!cancelled && !covers) setDayReservations([]); });
    return () => { cancelled = true; };
  }, [draft.date, loaded, freshness]);

  const tableById = useMemo(() => new Map(tables.map((table) => [table.id, table])), [tables]);

  /** Labels taken in each hall at the chosen time, ignoring the reservation being edited. */
  const busyLabels = useMemo(() => {
    const map = new Map<number, Set<string>>();
    if (!draft.time || !dayReservations) return map;
    const start = toMinutes(draft.time);
    dayReservations.filter((reservation) => isLive(reservation) && reservation.id !== draft.id).forEach((reservation) => {
      if (!overlaps(start, draft.duration, toMinutes(reservation.reserved_time), blockedLength(reservation, today))) return;
      const set = map.get(reservation.hall_id) || new Set<string>();
      tableLabels(reservation, tableById).forEach((label) => set.add(label));
      map.set(reservation.hall_id, set);
    });
    return map;
  }, [dayReservations, draft.duration, draft.id, draft.time, tableById, today]);

  const isFree = (table: Table) => !busyLabels.get(table.hall_id)?.has(table.label);

  /** Suggestions: free tables that seat the party, smallest fit first, at most two spare seats. When none fits (a big
      party) or the hostess asks, every free table is offered so she can pick one and merge its neighbours. */
  const hallOrder = (id: number) => halls.findIndex((hall) => hall.id === id);
  const byFit = (a: Table, b: Table) => a.capacity - b.capacity || hallOrder(a.hall_id) - hallOrder(b.hall_id) || a.label.localeCompare(b.label, 'uk', { numeric: true });
  const free = tables.filter(isFree);
  const fitting = free.filter((table) => table.capacity >= draft.guests).sort(byFit);
  const noneFits = fitting.length === 0;
  const suggestions = showAllTables || noneFits
    ? [...free].sort((a, b) => b.capacity - a.capacity || hallOrder(a.hall_id) - hallOrder(b.hall_id) || a.label.localeCompare(b.label, 'uk', { numeric: true }))
    : fitting.filter((table) => table.capacity <= draft.guests + 2).slice(0, 8);

  const chosen = draft.tableId ? tableById.get(draft.tableId) || null : null;
  const hallTables = chosen ? tables.filter((table) => table.hall_id === chosen.hall_id && table.id !== chosen.id).sort((a, b) => a.label.localeCompare(b.label, 'uk', { numeric: true })) : [];
  const seats = chosen ? chosen.capacity + hallTables.filter((table) => draft.merged.includes(table.label)).reduce((sum, table) => sum + table.capacity, 0) : 0;
  const chosenTaken = chosen ? !isFree(chosen) || draft.merged.some((label) => busyLabels.get(chosen.hall_id)?.has(label)) : false;

  function pickTable(table: Table) {
    setDraft((current) => ({ ...current, hallId: table.hall_id, tableId: table.id, merged: [] }));
  }

  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm(draft.id ? 'Закрити? Зміни не збережуться.' : 'Закрити без збереження? Резерв не буде записано.')) return;
    onClose();
  }

  async function save() {
    if (!draft.time) { setProblem('Обери час.'); return; }
    if (!draft.name.trim()) { setProblem('Вкажи імʼя гостя.'); nameRef.current?.focus(); return; }
    if (!chosen) { setProblem('Обери стіл.'); tableStepRef.current?.scrollIntoView({ block: 'start' }); return; }
    if (chosenTaken) { setProblem('Цей стіл у цей час уже зайнятий — обери інший.'); tableStepRef.current?.scrollIntoView({ block: 'start' }); return; }
    if (seats < draft.guests) { setProblem(`За обраними столами ${seats} ${plural(seats, 'місце', 'місця', 'місць')} на ${draft.guests} ${guestWord(draft.guests)} — додай стіл поруч.`); tableStepRef.current?.scrollIntoView({ block: 'start' }); return; }
    setBusy('save');
    setProblem(null);
    try {
      await secureApi({
        action: 'reserve_save',
        id: draft.id,
        hall_id: chosen.hall_id,
        table_id: chosen.id,
        date: draft.date,
        time: draft.time,
        duration_minutes: draft.duration,
        guests: draft.guests,
        guest_name: draft.name.trim(),
        phone: draft.phone.trim(),
        menu_note: draft.menuNote.trim(),
        note: joinNote(draft.occasions, draft.note),
        status: draft.status,
        merged_tables: draft.merged,
      }, 'tiflis-reserve-api');
      await onSaved(draft.date);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Резерв не збережено.';
      // Someone took the table meanwhile: refresh availability, drop the stale pick and take the hostess back to tables.
      if (/зайнятий/.test(message)) {
        setDraft((current) => ({ ...current, tableId: null, hallId: null, merged: [] }));
        setFreshness((value) => value + 1);
        tableStepRef.current?.scrollIntoView({ block: 'start' });
      }
      setProblem(message);
      setBusy(null);
    }
  }

  async function remove() {
    if (!draft.id) return;
    setBusy('delete');
    setProblem(null);
    try {
      await secureApi({ action: 'reserve_delete', id: draft.id }, 'tiflis-reserve-api');
      await onSaved(draft.date);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'Резерв не видалено.');
      setBusy(null);
    }
  }

  const dateChips = Array.from({ length: 4 }, (_, index) => addDays(today, index));

  // 24-hour time typed as digits: «1845» or «18:45». Only a valid HH:MM is applied to the draft.
  const [timeText, setTimeText] = useState(initial.time);
  useEffect(() => { setTimeText(draft.time); }, [draft.time]);
  function typeTime(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    const text = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setTimeText(text);
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) set('time', text);
  }

  return (
    <div className="rv3-backdrop" onMouseDown={requestClose}>
      <section className="rv3-sheet rv3-form" role="dialog" aria-modal="true" aria-labelledby="rv3-form-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="rv3-sheet-head">
          <h2 id="rv3-form-title" ref={titleRef} tabIndex={-1}>{draft.id ? 'Редагувати резерв' : 'Новий резерв'}</h2>
          <button type="button" className="rv3-close" onClick={requestClose} disabled={Boolean(busy)} aria-label="Закрити"><X size={20} /></button>
        </div>

        <fieldset className="rv3-step">
          <legend>Коли</legend>
          <div className="rv3-pills" role="group" aria-label="Дата">
            {dateChips.map((value) => (
              <button key={value} type="button" aria-pressed={draft.date === value} className={draft.date === value ? 'is-on' : ''} onClick={() => set('date', value)}>{shortDay(value, today)}</button>
            ))}
            <label className={`rv3-pill-date${dateChips.includes(draft.date) ? '' : ' is-on'}`}>
              <span>{dateChips.includes(draft.date) ? 'Інша дата' : shortDay(draft.date, today)}</span>
              <input type="date" value={draft.date} min={draft.id ? undefined : today} onChange={(event) => event.target.value && set('date', event.target.value)} aria-label="Інша дата" />
            </label>
          </div>
        </fieldset>

        <fieldset className="rv3-step">
          <legend>О котрій</legend>
          <div className="rv3-times" role="group" aria-label="Час">
            {TIME_SLOTS.map((slot) => (
              <button key={slot} type="button" aria-pressed={draft.time === slot} className={draft.time === slot ? 'is-on' : ''} onClick={() => set('time', slot)}>{slot}</button>
            ))}
          </div>
          <div className="rv3-inline">
            <label className="rv3-field is-small"><span>Точний час</span><input inputMode="numeric" placeholder="18:45" maxLength={5} value={timeText} onChange={(event) => typeTime(event.target.value)} aria-describedby="rv3-time-hint" /><small id="rv3-time-hint" className="rv3-sr">24-годинний формат, наприклад 18:45</small></label>
            <div className="rv3-field">
              <span>Скільки сидітимуть</span>
              <div className="rv3-pills is-tight" role="group" aria-label="Тривалість">
                {DURATIONS.map((minutes) => (
                  <button key={minutes} type="button" aria-pressed={draft.duration === minutes} className={draft.duration === minutes ? 'is-on' : ''} onClick={() => set('duration', minutes)}>{durationLabel(minutes)}</button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="rv3-step">
          <legend>Скільки гостей</legend>
          <div className="rv3-pills" role="group" aria-label="Гостей">
            {GUEST_CHIPS.map((count) => (
              <button key={count} type="button" aria-pressed={draft.guests === count} className={`is-num${draft.guests === count ? ' is-on' : ''}`} onClick={() => set('guests', count)}>{count}</button>
            ))}
            <label className="rv3-pill-num">
              <span className="rv3-sr">Інша кількість гостей</span>
              <input inputMode="numeric" value={GUEST_CHIPS.includes(draft.guests) ? '' : String(draft.guests)} placeholder="інше" onChange={(event) => { const value = Number(event.target.value.replace(/\D/g, '').slice(0, 3)); if (value) set('guests', Math.min(300, value)); }} />
            </label>
          </div>
        </fieldset>

        <fieldset className="rv3-step">
          <legend>Хто</legend>
          <div className="rv3-inline">
            <label className="rv3-field"><span>Імʼя гостя</span><input ref={nameRef} value={draft.name} onChange={(event) => set('name', event.target.value)} maxLength={180} autoComplete="off" /></label>
            <label className="rv3-field"><span>Телефон</span><input type="tel" inputMode="tel" value={draft.phone} onChange={(event) => set('phone', event.target.value)} maxLength={80} placeholder="+380" autoComplete="off" /></label>
          </div>
        </fieldset>

        <fieldset className="rv3-step" ref={tableStepRef}>
          <legend>Стіл</legend>
          {!draft.time ? <p className="rv3-hint">Спершу обери час — тоді покажу вільні столи.</p> : dayReservations === null ? <p className="rv3-hint">Перевіряю вільні столи…</p> : (
            <>
              {suggestions.length ? (
                <div className="rv3-suggest" role="group" aria-label="Вільні столи">
                  {suggestions.map((table) => (
                    <button key={table.id} type="button" aria-pressed={draft.tableId === table.id} className={draft.tableId === table.id ? 'is-on' : ''} onClick={() => pickTable(table)}>
                      <b>{table.label}</b>
                      <small>{hallName(halls, table.hall_id)} · {table.capacity} м.</small>
                    </button>
                  ))}
                </div>
              ) : <p className="rv3-hint is-warn">О {draft.time} вільних столів немає.</p>}
              {noneFits && suggestions.length ? <p className="rv3-hint is-warn">Жоден стіл не вміщує {draft.guests} {guestWord(draft.guests)}. Обери стіл і додай до нього сусідні.</p> : null}
              {!noneFits ? <button type="button" className="rv3-link" onClick={() => setShowAllTables((value) => !value)}>{showAllTables ? 'Лише ті, що підходять' : 'Показати всі вільні столи'}</button> : null}
              {chosen ? (
                <div className="rv3-merge">
                  <p>Обрано: <b>стіл {[chosen.label, ...draft.merged].join(' + ')}</b> · {hallName(halls, chosen.hall_id)} · {seats} {plural(seats, 'місце', 'місця', 'місць')}</p>
                  {chosenTaken ? <p className="rv3-hint is-warn">Цей стіл у цей час уже зайнятий.</p> : null}
                  {seats < draft.guests ? <p className="rv3-hint is-warn">Гостей більше, ніж місць. Додай стіл поруч:</p> : <p className="rv3-hint">Додати стіл поруч:</p>}
                  <div className="rv3-pills is-tight" role="group" aria-label="Обʼєднати зі столом">
                    {hallTables.map((table) => {
                      const on = draft.merged.includes(table.label);
                      const free = isFree(table);
                      return (
                        <button key={table.id} type="button" aria-pressed={on} disabled={!free && !on} className={on ? 'is-on' : ''} onClick={() => set('merged', on ? draft.merged.filter((label) => label !== table.label) : [...draft.merged, table.label])}>
                          {table.label} <small>{table.capacity}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </fieldset>

        <fieldset className="rv3-step">
          <legend>Привід і побажання</legend>
          <div className="rv3-pills is-tight" role="group" aria-label="Привід і побажання">
            {OCCASIONS.map((tag) => {
              const on = draft.occasions.includes(tag);
              return <button key={tag} type="button" aria-pressed={on} className={on ? 'is-on' : ''} onClick={() => set('occasions', on ? draft.occasions.filter((value) => value !== tag) : [...draft.occasions, tag])}>{on ? <Check size={13} aria-hidden="true" /> : null}{tag}</button>;
            })}
          </div>
          <label className="rv3-field"><span>Ще побажання</span><input value={draft.note} onChange={(event) => set('note', event.target.value)} maxLength={1500} placeholder="Біля вікна, алергія на горіхи…" /></label>
          <label className="rv3-field"><span>Передзамовлення меню</span><textarea value={draft.menuNote} onChange={(event) => set('menuNote', event.target.value)} maxLength={1200} rows={2} placeholder="Що гості замовили наперед" /></label>
        </fieldset>

        <div className="rv3-form-actions">
          {problem ? <p className="rv3-form-error" role="alert">{problem}</p> : null}
          {draft.id ? (
            confirmDelete
              ? <button type="button" className="rv3-danger is-confirm" onClick={() => void remove()} disabled={Boolean(busy)}>Так, видалити</button>
              : <button type="button" className="rv3-danger" onClick={() => setConfirmDelete(true)} disabled={Boolean(busy)}>Видалити</button>
          ) : null}
          <button type="button" className="rv3-primary" onClick={() => void save()} disabled={Boolean(busy)}>
            {busy === 'save' ? <RefreshCw size={17} className="rv3-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />} {draft.id ? 'Зберегти' : 'Записати резерв'}
          </button>
        </div>
      </section>
    </div>
  );
}

function hallName(halls: Hall[], id: number): string {
  return halls.find((hall) => hall.id === id)?.name || '';
}
