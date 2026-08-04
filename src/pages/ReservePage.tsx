import {
  Armchair,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  LayoutGrid,
  List,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '../lib/secureApi';
import './reserve.css';

type ReserveStatus = 'booked' | 'occupied' | 'completed' | 'cancelled' | 'no_show';
type ReserveView = 'floor' | 'timeline';

interface ReserveHall {
  id: number;
  name: string;
  sort_order: number;
  note: string | null;
  active: boolean;
}

interface ReserveTable {
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
  status: ReserveStatus;
  merged_tables: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ReserveBootstrapResponse {
  ok: true;
  selectedDate: string;
  permissions: { canManage: boolean };
  halls: ReserveHall[];
  tables: ReserveTable[];
  reservations: Reservation[];
}

interface ReservationEditor {
  id: number | null;
  hallId: number;
  tableId: number;
  date: string;
  time: string;
  durationMinutes: number;
  guests: number;
  guestName: string;
  phone: string;
  menuNote: string;
  note: string;
  status: ReserveStatus;
  mergedTables: string[];
}

const DOW = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_SHORT = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
const STATUS_META: Record<ReserveStatus, { label: string; tone: string }> = {
  booked: { label: 'Заброньовано', tone: 'booked' },
  occupied: { label: 'Гості за столом', tone: 'occupied' },
  completed: { label: 'Завершено', tone: 'completed' },
  cancelled: { label: 'Скасовано', tone: 'cancelled' },
  no_show: { label: 'Не прийшли', tone: 'no-show' },
};

function localIso(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localIso(date);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function shortTime(value: string): string {
  return value.slice(0, 5);
}

function naturalTableSort(left: ReserveTable, right: ReserveTable): number {
  return left.sort_order - right.sort_order || left.label.localeCompare(right.label, 'uk', { numeric: true });
}

function effectiveTableLabels(reservation: Reservation, tableById: Map<number, ReserveTable>): string[] {
  const primary = tableById.get(reservation.table_id)?.label;
  return [primary || '', ...(reservation.merged_tables || [])].filter(Boolean);
}

function isActiveReservation(reservation: Reservation): boolean {
  return reservation.status === 'booked' || reservation.status === 'occupied';
}

function createEditor(
  date: string,
  hallId: number,
  tableId: number,
  reservation?: Reservation,
): ReservationEditor {
  return {
    id: reservation?.id ?? null,
    hallId: reservation?.hall_id ?? hallId,
    tableId: reservation?.table_id ?? tableId,
    date: reservation?.reserved_date ?? date,
    time: reservation ? shortTime(reservation.reserved_time) : '19:00',
    durationMinutes: reservation?.duration_minutes ?? 120,
    guests: reservation?.guests ?? 2,
    guestName: reservation?.guest_name ?? '',
    phone: reservation?.phone ?? '',
    menuNote: reservation?.menu_note ?? '',
    note: reservation?.note ?? '',
    status: reservation?.status ?? 'booked',
    mergedTables: reservation?.merged_tables ?? [],
  };
}

function tableSizeClass(kind: string): string {
  if (kind === 'round' || kind === 'round-big') return 'is-round';
  if (kind === 'cabin') return 'is-cabin';
  if (kind === 'big' || kind === 'big-8') return 'is-big';
  return 'is-small';
}

export function ReservePage() {
  const [selectedDate, setSelectedDate] = useState(() => localIso());
  const [data, setData] = useState<ReserveBootstrapResponse | null>(null);
  const [activeHallId, setActiveHallId] = useState<number | null>(null);
  const [view, setView] = useState<ReserveView>('floor');
  const [search, setSearch] = useState('');
  const [focusedTable, setFocusedTable] = useState<ReserveTable | null>(null);
  const [editor, setEditor] = useState<ReservationEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<ReserveBootstrapResponse>(
        { action: 'reserve_bootstrap', date: selectedDate },
        'tiflis-reserve-api',
      );
      setData(response);
      setActiveHallId((current) => response.halls.some((hall) => hall.id === current)
        ? current
        : response.halls[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити резерви.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { void load(); }, [load]);

  const tableById = useMemo(
    () => new Map((data?.tables || []).map((table) => [table.id, table])),
    [data],
  );
  const hallById = useMemo(
    () => new Map((data?.halls || []).map((hall) => [hall.id, hall])),
    [data],
  );
  const activeHall = data?.halls.find((hall) => hall.id === activeHallId) || null;
  const hallTables = useMemo(
    () => (data?.tables || []).filter((table) => table.hall_id === activeHallId).sort(naturalTableSort),
    [activeHallId, data],
  );
  const selectedReservations = useMemo(
    () => (data?.reservations || []).filter((reservation) => reservation.reserved_date === selectedDate),
    [data, selectedDate],
  );
  const hallReservations = useMemo(
    () => selectedReservations.filter((reservation) => reservation.hall_id === activeHallId),
    [activeHallId, selectedReservations],
  );

  const dateStrip = useMemo(
    () => Array.from({ length: 11 }, (_, index) => addDays(selectedDate, index - 3)),
    [selectedDate],
  );
  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.reservations || []).forEach((reservation) => {
      if (!isActiveReservation(reservation)) return;
      counts.set(reservation.reserved_date, (counts.get(reservation.reserved_date) || 0) + 1);
    });
    return counts;
  }, [data]);

  const reservationsByTable = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    hallReservations.forEach((reservation) => {
      effectiveTableLabels(reservation, tableById).forEach((label) => {
        const current = map.get(label) || [];
        current.push(reservation);
        map.set(label, current);
      });
    });
    return map;
  }, [hallReservations, tableById]);

  const filteredTimeline = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    return [...hallReservations]
      .filter((reservation) => !query || [
        reservation.guest_name,
        reservation.phone || '',
        reservation.menu_note || '',
        reservation.note || '',
        tableById.get(reservation.table_id)?.label || '',
      ].join(' ').toLocaleLowerCase('uk-UA').includes(query))
      .sort((left, right) => left.reserved_time.localeCompare(right.reserved_time));
  }, [hallReservations, search, tableById]);

  const metrics = useMemo(() => {
    const active = selectedReservations.filter(isActiveReservation);
    const guests = active.reduce((sum, reservation) => sum + reservation.guests, 0);
    const occupied = active.filter((reservation) => reservation.status === 'occupied').length;
    const usedLabels = new Set(active.flatMap((reservation) => effectiveTableLabels(reservation, tableById)));
    const available = (data?.tables || []).filter((table) => !usedLabels.has(table.label)).length;
    return { reservations: active.length, guests, occupied, available };
  }, [data, selectedReservations, tableById]);

  const floorBounds = useMemo(() => {
    const xs = hallTables.map((table) => Number(table.position_x || 0));
    const ys = hallTables.map((table) => Number(table.position_y || 0));
    return {
      maxX: Math.max(1, ...xs) + 1,
      maxY: Math.max(1, ...ys) + 1,
    };
  }, [hallTables]);

  const focusedBookings = useMemo(() => {
    if (!focusedTable) return [];
    return [...(reservationsByTable.get(focusedTable.label) || [])]
      .sort((left, right) => left.reserved_time.localeCompare(right.reserved_time));
  }, [focusedTable, reservationsByTable]);

  function tableTone(table: ReserveTable): string {
    const reservations = reservationsByTable.get(table.label) || [];
    if (reservations.some((reservation) => reservation.status === 'occupied')) return 'occupied';
    if (reservations.some((reservation) => reservation.status === 'booked')) return 'booked';
    return 'free';
  }

  function openNew(table?: ReserveTable) {
    const target = table || hallTables[0];
    if (!target || !activeHallId) return;
    setFocusedTable(null);
    setEditor(createEditor(selectedDate, activeHallId, target.id));
  }

  async function saveReservation() {
    if (!editor) return;
    if (!editor.guestName.trim()) {
      setError('Вкажіть імʼя гостя.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'reserve_save',
        id: editor.id,
        hall_id: editor.hallId,
        table_id: editor.tableId,
        date: editor.date,
        time: editor.time,
        duration_minutes: editor.durationMinutes,
        guests: editor.guests,
        guest_name: editor.guestName,
        phone: editor.phone,
        menu_note: editor.menuNote,
        note: editor.note,
        status: editor.status,
        merged_tables: editor.mergedTables,
      }, 'tiflis-reserve-api');
      setEditor(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Резерв не збережено.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteReservation() {
    if (!editor?.id) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>(
        { action: 'reserve_delete', id: editor.id },
        'tiflis-reserve-api',
      );
      setEditor(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Резерв не видалено.');
    } finally {
      setSaving(false);
    }
  }

  const editorTables = useMemo(
    () => (data?.tables || []).filter((table) => table.hall_id === editor?.hallId).sort(naturalTableSort),
    [data, editor?.hallId],
  );
  const editorPrimary = editorTables.find((table) => table.id === editor?.tableId) || null;
  const editorCapacity = editorTables
    .filter((table) => table.id === editor?.tableId || editor?.mergedTables.includes(table.label))
    .reduce((sum, table) => sum + table.capacity, 0);

  return (
    <div className="reserve-page-v2">
      <section className="reserve-hero-v2">
        <div><span className="eyebrow">Карта сервісу</span><h2>Резерви без накладок</h2><p>Зали, реальні столи, об’єднання, часові конфлікти й статус гостей в одному живому робочому просторі.</p></div>
        <div className="reserve-hero-mark"><Armchair size={36} /></div>
      </section>

      <section className="reserve-date-control-v2">
        <button type="button" onClick={() => setSelectedDate((date) => addDays(date, -7))} aria-label="Попередній тиждень"><ChevronLeft size={20} /></button>
        <div className="reserve-date-strip-v2">
          {dateStrip.map((date) => {
            const parsed = new Date(`${date}T12:00:00`);
            const selected = date === selectedDate;
            const today = date === localIso();
            return <button type="button" key={date} className={`${selected ? 'is-selected' : ''} ${today ? 'is-today' : ''}`} onClick={() => setSelectedDate(date)}><span>{DOW[parsed.getDay()]}</span><strong>{parsed.getDate()}</strong><small>{MONTH_SHORT[parsed.getMonth()]}</small>{countsByDate.get(date) ? <i>{countsByDate.get(date)}</i> : null}</button>;
          })}
        </div>
        <button type="button" onClick={() => setSelectedDate((date) => addDays(date, 7))} aria-label="Наступний тиждень"><ChevronRight size={20} /></button>
        <button type="button" className="reserve-today-v2" onClick={() => setSelectedDate(localIso())}>Сьогодні</button>
      </section>

      <section className="reserve-metrics-v2">
        <article><CalendarDays size={19} /><span>Активних резервів</span><strong>{metrics.reservations}</strong></article>
        <article><UsersRound size={19} /><span>Очікуємо гостей</span><strong>{metrics.guests}</strong></article>
        <article><Armchair size={19} /><span>Гості вже сіли</span><strong>{metrics.occupied}</strong></article>
        <article><Check size={19} /><span>Вільних столів</span><strong>{metrics.available}</strong></article>
      </section>

      <section className="reserve-workspace-v2">
        <div className="reserve-workspace-head-v2">
          <div><span className="eyebrow">{formatDate(selectedDate)}</span><h3>{activeHall?.name || 'Зали ресторану'}</h3>{activeHall?.note ? <p>{activeHall.note}</p> : null}</div>
          <div className="reserve-head-actions-v2">
            <div className="reserve-view-switch-v2"><button type="button" className={view === 'floor' ? 'is-active' : ''} onClick={() => setView('floor')}><LayoutGrid size={16} /> Схема</button><button type="button" className={view === 'timeline' ? 'is-active' : ''} onClick={() => setView('timeline')}><List size={16} /> Таймлайн</button></div>
            {data?.permissions.canManage ? <button type="button" className="reserve-add-v2" onClick={() => openNew()}><Plus size={18} /> Новий резерв</button> : null}
          </div>
        </div>

        <div className="reserve-hall-tabs-v2">
          {(data?.halls || []).map((hall) => {
            const count = selectedReservations.filter((reservation) => reservation.hall_id === hall.id && isActiveReservation(reservation)).length;
            return <button type="button" key={hall.id} className={activeHallId === hall.id ? 'is-active' : ''} onClick={() => setActiveHallId(hall.id)}><MapPin size={15} /> {hall.name}<span>{count}</span></button>;
          })}
        </div>

        {error ? <div className="reserve-alert-v2" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
        {loading ? <div className="reserve-loading-v2"><RefreshCw size={24} className="is-spinning" /><span>Готуємо зал…</span></div> : null}

        {!loading && view === 'floor' ? <div className="reserve-floor-wrap-v2">
          <div className="reserve-floor-legend-v2"><span className="tone-free">Вільний</span><span className="tone-booked">Резерв</span><span className="tone-occupied">Зайнято</span></div>
          <div className="reserve-floor-canvas-v2" style={{ aspectRatio: `${Math.max(1.8, floorBounds.maxX / floorBounds.maxY)}` }}>
            {hallTables.map((table) => {
              const tone = tableTone(table);
              const bookings = reservationsByTable.get(table.label) || [];
              const firstBooking = bookings.find(isActiveReservation);
              const left = ((Number(table.position_x || 0) + 0.5) / floorBounds.maxX) * 100;
              const top = ((Number(table.position_y || 0) + 0.5) / floorBounds.maxY) * 100;
              return <button type="button" key={table.id} className={`reserve-floor-table-v2 ${tableSizeClass(table.kind)} tone-${tone}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => setFocusedTable(table)}><strong>{table.label}</strong><span>{table.capacity} ос.</span>{firstBooking ? <small>{shortTime(firstBooking.reserved_time)}</small> : <small>вільний</small>}{(firstBooking?.merged_tables || []).length > 0 ? <i>+{firstBooking?.merged_tables.length}</i> : null}</button>;
            })}
          </div>
        </div> : null}

        {!loading && view === 'timeline' ? <div className="reserve-timeline-v2">
          <label className="reserve-search-v2"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Гість, телефон, стіл або примітка…" />{search ? <button type="button" onClick={() => setSearch('')}><X size={15} /></button> : null}</label>
          {filteredTimeline.length === 0 ? <div className="reserve-empty-v2"><CalendarDays size={30} /><strong>На цю дату резервів немає</strong><span>Оберіть інший зал або створіть новий резерв.</span></div> : null}
          {filteredTimeline.map((reservation) => {
            const table = tableById.get(reservation.table_id);
            const status = STATUS_META[reservation.status];
            return <article key={reservation.id} className={`tone-${status.tone}`}><time>{shortTime(reservation.reserved_time)}</time><div className="reserve-timeline-main-v2"><div><strong>{reservation.guest_name}</strong><span><UsersRound size={13} /> {reservation.guests} · стіл {table?.label || '—'}{(reservation.merged_tables || []).length ? ` + ${reservation.merged_tables?.join(', ')}` : ''}</span></div><p>{reservation.phone || reservation.menu_note || reservation.note || 'Без додаткових приміток'}</p></div><span className="reserve-status-v2">{status.label}</span>{data?.permissions.canManage ? <button type="button" onClick={() => setEditor(createEditor(selectedDate, reservation.hall_id, reservation.table_id, reservation))}><Edit3 size={16} /></button> : null}</article>;
          })}
        </div> : null}
      </section>

      {focusedTable ? <div className="reserve-sheet-backdrop-v2" onMouseDown={() => setFocusedTable(null)}><section className="reserve-table-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="reserve-sheet-heading-v2"><div><span className="eyebrow">{activeHall?.name}</span><h3>Стіл {focusedTable.label}</h3><p>{focusedTable.capacity} місць · {formatDate(selectedDate)}</p></div><button type="button" onClick={() => setFocusedTable(null)}><X size={19} /></button></div>
        <div className="reserve-focused-list-v2">{focusedBookings.length === 0 ? <div className="reserve-empty-v2"><Check size={28} /><strong>Стіл вільний</strong><span>На вибрану дату немає бронювань.</span></div> : focusedBookings.map((reservation) => <button type="button" key={reservation.id} onClick={() => { setEditor(createEditor(selectedDate, reservation.hall_id, reservation.table_id, reservation)); setFocusedTable(null); }}><time>{shortTime(reservation.reserved_time)}</time><span><strong>{reservation.guest_name}</strong><small>{reservation.guests} гостей · {STATUS_META[reservation.status].label}</small></span><Edit3 size={15} /></button>)}</div>
        {data?.permissions.canManage ? <button type="button" className="reserve-sheet-add-v2" onClick={() => openNew(focusedTable)}><Plus size={17} /> Додати резерв на цей стіл</button> : null}
      </section></div> : null}

      {editor ? <div className="reserve-sheet-backdrop-v2" onMouseDown={() => !saving && setEditor(null)}><section className="reserve-editor-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="reserve-sheet-heading-v2"><div><span className="eyebrow">{editor.id ? 'Редагування' : 'Новий резерв'}</span><h3>{editor.guestName || 'Дані гостя'}</h3><p>{hallById.get(editor.hallId)?.name} · стіл {editorPrimary?.label || '—'}</p></div><button type="button" onClick={() => setEditor(null)} disabled={saving}><X size={19} /></button></div>
        <div className="reserve-editor-grid-v2">
          <label><span>Зал</span><select value={editor.hallId} onChange={(event) => { const hallId = Number(event.target.value); const firstTable = (data?.tables || []).filter((table) => table.hall_id === hallId).sort(naturalTableSort)[0]; setEditor({ ...editor, hallId, tableId: firstTable?.id || 0, mergedTables: [] }); }}>{(data?.halls || []).map((hall) => <option value={hall.id} key={hall.id}>{hall.name}</option>)}</select></label>
          <label><span>Основний стіл</span><select value={editor.tableId} onChange={(event) => setEditor({ ...editor, tableId: Number(event.target.value), mergedTables: editor.mergedTables.filter((label) => label !== editorTables.find((table) => table.id === Number(event.target.value))?.label) })}>{editorTables.map((table) => <option value={table.id} key={table.id}>{table.label} · {table.capacity} ос.</option>)}</select></label>
          <label><span>Дата</span><input type="date" value={editor.date} onChange={(event) => setEditor({ ...editor, date: event.target.value })} /></label>
          <label><span>Час</span><input type="time" value={editor.time} onChange={(event) => setEditor({ ...editor, time: event.target.value })} /></label>
          <label><span>Тривалість</span><select value={editor.durationMinutes} onChange={(event) => setEditor({ ...editor, durationMinutes: Number(event.target.value) })}>{[60,90,120,150,180,240,300].map((minutes) => <option value={minutes} key={minutes}>{minutes / 60 % 1 === 0 ? `${minutes / 60} год` : `${Math.floor(minutes / 60)} год ${minutes % 60} хв`}</option>)}</select></label>
          <label><span>Гостей</span><input type="number" min="1" max="300" value={editor.guests} onChange={(event) => setEditor({ ...editor, guests: Number(event.target.value) })} /></label>
          <label className="is-wide"><span>Імʼя гостя</span><input value={editor.guestName} maxLength={180} onChange={(event) => setEditor({ ...editor, guestName: event.target.value })} /></label>
          <label><span>Телефон</span><input type="tel" value={editor.phone} maxLength={80} onChange={(event) => setEditor({ ...editor, phone: event.target.value })} /></label>
          <label><span>Статус</span><select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as ReserveStatus })}>{(Object.keys(STATUS_META) as ReserveStatus[]).map((status) => <option value={status} key={status}>{STATUS_META[status].label}</option>)}</select></label>
          <label className="is-wide"><span>Попереднє меню</span><textarea value={editor.menuNote} maxLength={1200} onChange={(event) => setEditor({ ...editor, menuNote: event.target.value })} placeholder="Замовлені страви, побажання…" /></label>
          <label className="is-wide"><span>Службова примітка</span><textarea value={editor.note} maxLength={2000} onChange={(event) => setEditor({ ...editor, note: event.target.value })} placeholder="День народження, дитячий стілець, декор…" /></label>
        </div>
        <div className="reserve-merge-editor-v2"><div><strong>Об’єднати столи</strong><span>Загальна місткість: {editorCapacity} ос.</span></div><div>{editorTables.filter((table) => table.id !== editor.tableId).map((table) => { const active = editor.mergedTables.includes(table.label); return <button type="button" key={table.id} className={active ? 'is-active' : ''} onClick={() => setEditor({ ...editor, mergedTables: active ? editor.mergedTables.filter((label) => label !== table.label) : [...editor.mergedTables, table.label] })}>{active ? <Check size={13} /> : null}{table.label}<span>{table.capacity}</span></button>; })}</div></div>
        {editor.guests > editorCapacity ? <div className="reserve-capacity-warning-v2">Гостей більше, ніж місць за вибраними столами.</div> : null}
        <div className="reserve-editor-actions-v2">{editor.id ? <button type="button" className="is-delete" onClick={() => void deleteReservation()} disabled={saving}><Trash2 size={17} /> Видалити</button> : <span />}<button type="button" className="is-save" onClick={() => void saveReservation()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />} Зберегти</button></div>
      </section></div> : null}
    </div>
  );
}
