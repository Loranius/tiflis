import {
  Armchair,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  MapPinned,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useKyivDay } from '../hooks/useKyivDay';
import { secureApi } from '../lib/secureApi';
import './today-reservations.css';

type ReservationStatus = 'booked' | 'occupied';

interface TodayZone {
  key: string;
  title: string;
  hallId: number;
}

interface TodayReservation {
  id: number;
  time: string;
  durationMinutes: number;
  guests: number;
  guestName: string;
  menuNote: string | null;
  note: string | null;
  status: ReservationStatus;
  hallId: number;
  hallName: string;
  tableId: number;
  tableLabel: string;
  mergedTables: string[];
}

interface TodayReservationsResponse {
  ok: true;
  date: string;
  currentTime: string;
  canView: boolean;
  publication: boolean;
  zones: TodayZone[];
  reservations: TodayReservation[];
}

const AUTO_REFRESH_MIN_INTERVAL_MS = 30_000;

function tableLabel(reservation: TodayReservation): string {
  const labels = [reservation.tableLabel, ...reservation.mergedTables].filter(Boolean);
  return labels.length > 1 ? `Столи ${labels.join(' + ')}` : `Стіл ${labels[0] || '—'}`;
}

function durationLabel(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} год`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} год ${minutes % 60} хв`;
  return `${minutes} хв`;
}

export function TodayReservationsCard({ compact = false }: { compact?: boolean }) {
  const dayKey = useKyivDay();
  const [data, setData] = useState<TodayReservationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const lastRequestAt = useRef(0);

  const load = useCallback(async (forceRefresh = false) => {
    const id = ++requestId.current;
    lastRequestAt.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<TodayReservationsResponse>({
        action: 'today_reservations_get',
      }, 'tiflis-today-reserve-api', {
        forceRefresh,
        cacheTtlMs: 15_000,
      });
      if (requestId.current !== id) return;
      setData(response);
    } catch (reason) {
      if (requestId.current !== id) return;
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити резерви для ваших зон.');
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [dayKey, load]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (Date.now() - lastRequestAt.current < AUTO_REFRESH_MIN_INTERVAL_MS) return;
      void load();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };
    window.addEventListener('focus', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const guestCount = useMemo(
    () => data?.reservations.reduce((sum, reservation) => sum + reservation.guests, 0) || 0,
    [data?.reservations],
  );

  if (compact) {
    const nextReservation = data?.reservations[0];
    const reservationLabel = loading
      ? 'Перевіряємо бронювання…'
      : error
        ? 'Не вдалося завантажити резерви'
        : !data?.canView
          ? 'Недоступно для вашої ролі'
          : !data.publication
            ? 'Розподіл зон ще не опубліковано'
            : data.zones.length === 0
              ? 'На сьогодні зону не призначено'
              : nextReservation
                ? `${nextReservation.time} · ${nextReservation.guestName} · ${nextReservation.hallName}`
                : 'Немає найближчих';

    return (
      <Link className="today-reservations-card-v1 is-dashboard-compact today-dashboard-row-v2" to="/reserve" aria-label={`Найближчий резерв. ${reservationLabel}`}>
        <span className="today-dashboard-row-icon-v2" aria-hidden="true"><CalendarClock size={20} /></span>
        <span className="today-dashboard-row-copy-v2">
          <strong>Найближчий резерв</strong>
          <small>{reservationLabel}</small>
        </span>
        {nextReservation ? <strong className="today-dashboard-reserve-count-v2">{nextReservation.guests}</strong> : null}
        <ChevronRight className="today-dashboard-row-chevron-v2" size={19} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <section className="today-reservations-card-v1" aria-labelledby="today-reservations-title">
      <header className="today-reservations-heading-v1">
        <div>
          <span className="eyebrow">Мої робочі зони</span>
          <h2 id="today-reservations-title">Найближчі резерви</h2>
          <p>Активні бронювання на сьогодні тільки у залах, призначених вам у розподілі.</p>
        </div>
        <div className="today-reservations-tools-v1">
          <span className="today-reservations-count-v1" aria-label={`${data?.reservations.length || 0} резервів`}>
            <CalendarClock size={17} />
            <strong>{loading ? '…' : data?.reservations.length || 0}</strong>
          </span>
          <button type="button" onClick={() => void load(true)} disabled={loading} aria-label="Оновити резерви">
            <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
          </button>
        </div>
      </header>

      {error ? (
        <div className="today-reservations-alert-v1" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => void load(true)} aria-label="Спробувати ще раз">
            <RefreshCw size={15} />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="today-reservations-loading-v1">
          <RefreshCw className="is-spinning" size={20} />
          <span>Перевіряємо резерви у ваших зонах…</span>
        </div>
      ) : null}

      {!loading && data && !data.canView ? (
        <div className="today-reservations-empty-v1">
          <Armchair size={25} />
          <strong>Цей блок призначений для офіціантів</strong>
          <span>Для інших ролей резерви доступні у повному модулі відповідно до прав доступу.</span>
        </div>
      ) : null}

      {!loading && data?.canView && !data.publication ? (
        <div className="today-reservations-empty-v1">
          <MapPinned size={25} />
          <strong>Розподіл зон ще не опубліковано</strong>
          <span>Після публікації блок автоматично визначить ваші зали.</span>
        </div>
      ) : null}

      {!loading && data?.canView && data.publication && data.zones.length === 0 ? (
        <div className="today-reservations-empty-v1">
          <MapPinned size={25} />
          <strong>На сьогодні вам не призначено зону</strong>
          <span>Резерви з інших залів тут не показуються.</span>
        </div>
      ) : null}

      {!loading && data?.canView && data.zones.length > 0 ? (
        <>
          <div className="today-reservations-zones-v1" aria-label="Призначені зони">
            <MapPinned size={16} />
            {data.zones.map((zone) => <span key={zone.key}>{zone.title}</span>)}
          </div>

          {data.reservations.length === 0 ? (
            <div className="today-reservations-empty-v1">
              <CalendarClock size={25} />
              <strong>У ваших зонах найближчих резервів немає</strong>
              <span>Показуються активні резерви, які ще тривають або очікуються сьогодні.</span>
            </div>
          ) : (
            <div className="today-reservations-list-v1">
              {data.reservations.map((reservation) => (
                <article key={reservation.id} className={`status-${reservation.status}`}>
                  <div className="today-reservations-time-v1">
                    <strong>{reservation.time}</strong>
                    <span>{durationLabel(reservation.durationMinutes)}</span>
                  </div>
                  <div className="today-reservations-main-v1">
                    <div className="today-reservations-title-row-v1">
                      <strong>{reservation.guestName}</strong>
                      <span>{reservation.status === 'occupied' ? 'Гості за столом' : 'Очікуємо'}</span>
                    </div>
                    <div className="today-reservations-meta-v1">
                      <span><MapPinned size={13} /> {reservation.hallName} · {tableLabel(reservation)}</span>
                      <span><UsersRound size={13} /> {reservation.guests} гостей</span>
                    </div>
                    {reservation.menuNote || reservation.note ? (
                      <p>{[reservation.menuNote, reservation.note].filter(Boolean).join(' · ')}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}

          <footer className="today-reservations-footer-v1">
            <span>{data.reservations.length ? `${guestCount} гостей у найближчих резервах` : `Актуально на ${data.currentTime}`}</span>
            <Link to="/reserve">
              Всі резерви
              <ExternalLink size={15} />
            </Link>
          </footer>
        </>
      ) : null}
    </section>
  );
}
