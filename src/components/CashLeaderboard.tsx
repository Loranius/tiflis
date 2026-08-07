import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Mountain,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import './cash-leaderboard.css';

export type CashLeaderboardPeriod = 'first' | 'second' | 'month' | 'year';

type TimelinePoint = {
  rank: number;
  progress: number;
};

export interface CashLeaderboardRow {
  userId?: string | null;
  name?: string | null;
  rank: number;
  total?: number | null;
  relative?: number | null;
  mine: boolean;
  avatar?: string | null;
  role?: string | null;
  role2?: string | null;
  timeline?: Record<string, TimelinePoint> | null;
}

interface CashLeaderboardProps {
  rows: CashLeaderboardRow[];
  period: CashLeaderboardPeriod;
  daysInMonth: number;
  year: number;
  canViewAll?: boolean;
  onPeriodChange: (period: CashLeaderboardPeriod) => void;
}

type MotionDirection = 'forward' | 'backward' | 'reset' | 'idle';

type PositionedRow = CashLeaderboardRow & {
  progress: number;
  displayRank: number;
  x: number;
  y: number;
  clusterOffset: number;
  facing: 'left' | 'right';
};

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

const ROUTE_POINTS = [
  { x: 15, y: 86 },
  { x: 77, y: 76 },
  { x: 29, y: 63 },
  { x: 72, y: 50 },
  { x: 37, y: 37 },
  { x: 61, y: 24 },
  { x: 50, y: 11 },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function displayName(row: CashLeaderboardRow): string {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  return name || `Працівник #${row.rank}`;
}

function shortName(row: CashLeaderboardRow): string {
  return displayName(row).split(/\s+/).filter(Boolean)[0] || displayName(row);
}

function rowIdentity(row: CashLeaderboardRow): string {
  return row.userId || `${displayName(row)}:${row.rank}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '—';
}

function roleLabel(row: CashLeaderboardRow): string {
  const roles = [row.role, row.role2]
    .filter((role): role is string => typeof role === 'string' && Boolean(role.trim()))
    .map((role) => ROLE_LABELS[role] || role)
    .filter((role, index, all) => all.indexOf(role) === index);
  return roles.join(' · ') || 'Працівник ресторану';
}

function formatTimelineDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${value}T12:00:00`));
}

function formatCycleRange(value: string, daysInMonth: number): string {
  const day = Number(value.slice(-2));
  const monthName = new Intl.DateTimeFormat('uk-UA', { month: 'long' })
    .format(new Date(`${value.slice(0, 7)}-01T12:00:00`));
  return day <= 14
    ? `1–14 ${monthName}`
    : `15–${daysInMonth} ${monthName}`;
}

function cycleEndDay(value: string, daysInMonth: number): number {
  return Number(value.slice(-2)) <= 14 ? Math.min(14, daysInMonth) : daysInMonth;
}

function routePosition(progress: number): { x: number; y: number; facing: 'left' | 'right' } {
  const normalized = clamp(progress, 0, 100) / 100;
  const scaled = normalized * (ROUTE_POINTS.length - 1);
  const segment = Math.min(ROUTE_POINTS.length - 2, Math.floor(scaled));
  const local = scaled - segment;
  const start = ROUTE_POINTS[segment] ?? ROUTE_POINTS[0]!;
  const end = ROUTE_POINTS[segment + 1] ?? ROUTE_POINTS[ROUTE_POINTS.length - 1]!;
  return {
    x: start.x + (end.x - start.x) * local,
    y: start.y + (end.y - start.y) * local,
    facing: end.x >= start.x ? 'right' : 'left',
  };
}

function stableLane(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  }
  return ((Math.abs(hash) % 1000) / 999) * 2 - 1;
}

function positionsForDay(rows: CashLeaderboardRow[], date: string): PositionedRow[] {
  const withProgress = rows.map((row) => {
    const point = row.timeline?.[date];
    return {
      row,
      progress: clamp(Number(point?.progress ?? 0), 0, 100),
      displayRank: Math.max(1, Number(point?.rank ?? row.rank ?? 1)),
    };
  });

  return withProgress.map(({ row, progress, displayRank }) => {
    const base = routePosition(progress);
    const near = withProgress
      .filter((candidate) => Math.abs(candidate.progress - progress) <= 4.75)
      .sort((left, right) => rowIdentity(left.row).localeCompare(rowIdentity(right.row)));
    const clusterIndex = near.findIndex((candidate) => rowIdentity(candidate.row) === rowIdentity(row));
    const centeredIndex = clusterIndex - (near.length - 1) / 2;
    const lane = stableLane(rowIdentity(row));
    const crowdSpread = near.length > 1 ? clamp(17 / near.length, 2.3, 5) : 0;
    const summitNarrowing = 0.55 + (1 - progress / 100) * 0.45;
    const clusterOffset = centeredIndex * crowdSpread * summitNarrowing;
    const laneOffset = lane * (near.length > 1 ? 1.25 : 2.4) * summitNarrowing;

    return {
      ...row,
      progress,
      displayRank,
      x: clamp(base.x + clusterOffset + laneOffset, 10, 90),
      y: clamp(base.y + (Math.abs(centeredIndex) % 2) * 0.75, 9, 88),
      clusterOffset,
      facing: base.facing,
    };
  });
}

function MountainArt({ summitDay }: { summitDay: number }) {
  return (
    <svg className="sisyphus-mountain-art" viewBox="0 0 1000 720" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="mountainSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16251c" />
          <stop offset="0.64" stopColor="#0c1510" />
          <stop offset="1" stopColor="#080e0a" />
        </linearGradient>
        <linearGradient id="mountainFace" x1="0.15" y1="0.1" x2="0.86" y2="0.94">
          <stop offset="0" stopColor="#2b3f31" />
          <stop offset="0.45" stopColor="#1d2d23" />
          <stop offset="1" stopColor="#101a14" />
        </linearGradient>
        <linearGradient id="mountainGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d899" stopOpacity="0.82" />
          <stop offset="1" stopColor="#a77f3b" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id="summitGlow">
          <stop offset="0" stopColor="#e7c97f" stopOpacity="0.34" />
          <stop offset="1" stopColor="#e7c97f" stopOpacity="0" />
        </radialGradient>
        <filter id="mountainShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="26" stdDeviation="22" floodColor="#000" floodOpacity="0.38" />
        </filter>
      </defs>

      <rect width="1000" height="720" fill="url(#mountainSky)" />
      <circle cx="500" cy="105" r="150" fill="url(#summitGlow)" />
      <path d="M0 475 L155 330 L292 448 L418 286 L555 452 L720 300 L1000 485 L1000 720 L0 720 Z" fill="#142219" opacity="0.58" />
      <path d="M0 555 L180 430 L330 545 L470 410 L615 550 L785 425 L1000 560 L1000 720 L0 720 Z" fill="#101b14" opacity="0.82" />

      <g filter="url(#mountainShadow)">
        <path d="M73 666 L500 101 L936 666 Z" fill="url(#mountainFace)" stroke="rgba(222,231,224,.08)" strokeWidth="2" />
        <path d="M73 666 L500 101 L390 666 Z" fill="#26382c" opacity="0.92" />
        <path d="M390 666 L500 101 L654 666 Z" fill="#1a2a20" opacity="0.97" />
        <path d="M654 666 L500 101 L936 666 Z" fill="#111d16" opacity="0.96" />
        <path d="M500 101 L432 240 L505 211 L470 340 L565 298 L530 447 L618 397 L654 666" fill="none" stroke="url(#mountainGold)" strokeWidth="2.5" opacity="0.43" />
        <path d="M500 101 L545 204 L511 229 L590 338 L542 361 L704 525" fill="none" stroke="#eef3ef" strokeWidth="1.4" opacity="0.08" />
      </g>

      <path
        d="M150 620 C235 608 620 590 780 548 C622 528 382 502 286 456 C382 428 625 415 718 362 C620 337 430 321 370 278 C426 252 565 240 610 198 C565 177 520 151 500 126"
        fill="none"
        stroke="#d7b66c"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="2 18"
        opacity="0.34"
      />
      <path
        d="M150 620 C235 608 620 590 780 548 C622 528 382 502 286 456 C382 428 625 415 718 362 C620 337 430 321 370 278 C426 252 565 240 610 198 C565 177 520 151 500 126"
        fill="none"
        stroke="#f1e4c2"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.12"
      />

      <g className="sisyphus-summit-mark">
        <circle cx="500" cy="92" r="34" fill="#0d1711" stroke="#d7b66c" strokeWidth="2" />
        <text x="500" y="100" textAnchor="middle" fill="#f2e4be" fontSize="25" fontWeight="800">{summitDay}</text>
        <path d="M500 126 V158" stroke="#d7b66c" strokeWidth="3" strokeLinecap="round" />
        <path d="M501 132 L540 142 L501 153 Z" fill="#7d2635" stroke="#d7b66c" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function ClimberAvatar({ row }: { row: CashLeaderboardRow }) {
  const name = displayName(row);
  const avatar = typeof row.avatar === 'string' && row.avatar.trim() ? row.avatar.trim() : null;
  return (
    <span className="sisyphus-face" aria-hidden="true">
      <span>{initials(name)}</span>
      {avatar ? (
        <img
          src={avatar}
          alt=""
          loading="lazy"
          onError={(event: SyntheticEvent<HTMLImageElement>) => { event.currentTarget.hidden = true; }}
        />
      ) : null}
    </span>
  );
}

export function CashLeaderboard({ rows, daysInMonth, year }: CashLeaderboardProps) {
  const availableDates = useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      for (const date of Object.keys(row.timeline || {})) values.add(date);
    }
    return [...values].sort();
  }, [rows]);

  const fallbackDate = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const latestDate = availableDates[availableDates.length - 1] || fallbackDate;
  const [selectedDate, setSelectedDate] = useState(latestDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [motion, setMotion] = useState<MotionDirection>('idle');
  const [motionTick, setMotionTick] = useState(0);
  const motionTimer = useRef<number | null>(null);

  useEffect(() => {
    setSelectedDate(latestDate);
    setSelectedId(null);
    setMotion('idle');
  }, [latestDate]);

  useEffect(() => () => {
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
  }, []);

  const dateIndex = Math.max(0, availableDates.indexOf(selectedDate));
  const positioned = useMemo(() => positionsForDay(rows, selectedDate), [rows, selectedDate]);
  const sorted = useMemo(
    () => [...positioned].sort((left, right) => left.displayRank - right.displayRank || displayName(left).localeCompare(displayName(right), 'uk')),
    [positioned],
  );
  const selected = sorted.find((row) => rowIdentity(row) === selectedId) || sorted.find((row) => row.mine) || sorted[0] || null;
  const summitDay = cycleEndDay(selectedDate, daysInMonth);
  const activeDay = Number(selectedDate.slice(-2));
  const cycleStart = activeDay <= 14 ? 1 : 15;
  const cycleProgress = summitDay > cycleStart
    ? clamp(((activeDay - cycleStart) / (summitDay - cycleStart)) * 100, 0, 100)
    : 100;

  function triggerMotion(direction: MotionDirection) {
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
    setMotion(direction);
    setMotionTick((value) => value + 1);
    motionTimer.current = window.setTimeout(() => setMotion('idle'), 760);
  }

  function moveDate(delta: -1 | 1) {
    if (!availableDates.length) return;
    const nextIndex = clamp(dateIndex + delta, 0, availableDates.length - 1);
    const nextDate = availableDates[nextIndex];
    if (!nextDate || nextDate === selectedDate) return;
    const currentCycle = Number(selectedDate.slice(-2)) <= 14 ? 'first' : 'second';
    const nextCycle = Number(nextDate.slice(-2)) <= 14 ? 'first' : 'second';
    triggerMotion(currentCycle !== nextCycle && delta > 0 ? 'reset' : delta > 0 ? 'forward' : 'backward');
    setSelectedDate(nextDate);
  }

  function jumpToLatest() {
    if (selectedDate === latestDate) return;
    triggerMotion('forward');
    setSelectedDate(latestDate);
  }

  return (
    <section className="sisyphus-board">
      <header className="sisyphus-board-heading">
        <div>
          <span className="eyebrow">Рейтинг каси</span>
          <h3>Сходження на вершину</h3>
          <p>Однаковий валун для кожного. Вище на горі — більша накопичена каса в поточному півмісячному циклі.</p>
        </div>
        <span className="sisyphus-board-mark"><Mountain size={24} /></span>
      </header>

      <div className="sisyphus-day-nav" role="group" aria-label="Історія рейтингу за днями">
        <button
          type="button"
          onClick={() => moveDate(-1)}
          disabled={!availableDates.length || dateIndex <= 0}
          aria-label="Попередній день"
        >
          <ChevronLeft size={19} />
        </button>
        <div className="sisyphus-day-chip" aria-live="polite">
          <CalendarDays size={17} />
          <span>{formatTimelineDate(selectedDate)}</span>
        </div>
        <button
          type="button"
          onClick={() => moveDate(1)}
          disabled={!availableDates.length || dateIndex >= availableDates.length - 1}
          aria-label="Наступний день"
        >
          <ChevronRight size={19} />
        </button>
        {selectedDate !== latestDate ? (
          <button type="button" className="sisyphus-today-button" onClick={jumpToLatest}>
            <RotateCcw size={15} /> Актуальний день
          </button>
        ) : null}
      </div>

      <div className="sisyphus-cycle-strip">
        <span><Flag size={15} /> Сходження {formatCycleRange(selectedDate, daysInMonth)}</span>
        <div aria-hidden="true"><span style={{ width: `${cycleProgress}%` }} /></div>
        <b>Вершина — {summitDay}</b>
      </div>

      <div
        className={`sisyphus-mountain-stage is-${motion}`}
        data-motion-tick={motionTick}
        aria-label={`Рейтинг каси станом на ${formatTimelineDate(selectedDate)}`}
      >
        <MountainArt summitDay={summitDay} />

        {!availableDates.length ? (
          <div className="sisyphus-empty">
            <Mountain size={28} />
            <strong>Сходження ще не почалося</strong>
            <span>Після першої внесеної каси аватари почнуть рух угору.</span>
          </div>
        ) : null}

        {sorted.map((row) => {
          const identity = rowIdentity(row);
          const isSelected = selected && rowIdentity(selected) === identity;
          return (
            <button
              type="button"
              key={identity}
              className={`sisyphus-climber is-facing-${row.facing} ${row.mine ? 'is-mine' : ''} ${row.displayRank === 1 && row.progress > 0 ? 'is-leader' : ''} ${isSelected ? 'is-selected' : ''}`}
              style={{ left: `${row.x}%`, top: `${row.y}%`, zIndex: Math.max(3, 40 - row.displayRank) }}
              onClick={() => setSelectedId(identity)}
              aria-label={`${displayName(row)}, ${row.displayRank} місце`}
            >
              <span className="sisyphus-nameplate">
                <strong>{shortName(row)}</strong>
                {row.mine ? <b>Ви</b> : <small>#{row.displayRank}</small>}
              </span>
              <span className="sisyphus-figure" aria-hidden="true">
                <span className="sisyphus-boulder"><i /><i /><i /></span>
                <span className="sisyphus-person">
                  <ClimberAvatar row={row} />
                  <span className="sisyphus-torso" />
                  <span className="sisyphus-arm is-front" />
                  <span className="sisyphus-arm is-back" />
                  <span className="sisyphus-leg is-front" />
                  <span className="sisyphus-leg is-back" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className={`sisyphus-selected-card ${selected.mine ? 'is-mine' : ''}`} aria-live="polite">
          <ClimberAvatar row={selected} />
          <div>
            <span>{selected.mine ? 'Ваше положення на горі' : 'Офіціант на маршруті'}</span>
            <strong>{displayName(selected)}</strong>
            <small>{roleLabel(selected)}</small>
          </div>
          <b>#{selected.displayRank}</b>
        </div>
      ) : null}

      <footer className="sisyphus-board-note">
        <span>Суми на горі не показуються. Стрілки відтворюють реальний стан рейтингу день за днем.</span>
      </footer>
    </section>
  );
}
