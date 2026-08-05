import {
  Crown,
  Medal,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { useMemo } from 'react';
import './cash-leaderboard.css';

export type CashLeaderboardPeriod = 'first' | 'second' | 'month' | 'year';

export interface CashLeaderboardRow {
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

interface CashLeaderboardProps {
  rows: CashLeaderboardRow[];
  period: CashLeaderboardPeriod;
  daysInMonth: number;
  year: number;
  canViewAll?: boolean;
  onPeriodChange: (period: CashLeaderboardPeriod) => void;
}

const PODIUM_EMOJI = ['🥇', '🥈', '🥉'];
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

function periodLabel(period: CashLeaderboardPeriod, daysInMonth: number, year: number): string {
  if (period === 'first') return '1–14 число';
  if (period === 'second') return `15–${daysInMonth} число`;
  if (period === 'year') return String(year);
  return 'Увесь місяць';
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
  const labels = [row.role, row.role2]
    .filter((role): role is string => Boolean(role))
    .map((role) => ROLE_LABELS[role] || role)
    .filter((role, index, all) => all.indexOf(role) === index);
  return labels.join(' · ') || 'Працівник ресторану';
}

function formatTotal(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value);
}

function PersonAvatar({ row, podium = false }: { row: CashLeaderboardRow; podium?: boolean }) {
  return (
    <span className={`cash-board-avatar ${podium ? 'is-podium' : ''}`} aria-hidden="true">
      <span>{initials(row.name)}</span>
      {row.avatar ? (
        <img
          src={row.avatar}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      ) : null}
    </span>
  );
}

function ResultValue({ row }: { row: CashLeaderboardRow }) {
  if (row.total !== null) return <strong>{formatTotal(row.total)}</strong>;
  return <strong>{Math.round(row.relative)}% від лідера</strong>;
}

export function CashLeaderboard({
  rows,
  period,
  daysInMonth,
  year,
  canViewAll = false,
  onPeriodChange,
}: CashLeaderboardProps) {
  const sorted = useMemo(() => [...rows].sort((left, right) => left.rank - right.rank), [rows]);
  const topThree = sorted.slice(0, 3);
  const trail = sorted.slice(3);
  const podium = [topThree[1], topThree[0], topThree[2]].filter(
    (row): row is CashLeaderboardRow => Boolean(row),
  );
  const mine = sorted.find((row) => row.mine) || null;

  return (
    <section className="cash-live-board">
      <header className="cash-live-heading">
        <div>
          <span className="eyebrow">Рейтинг команди</span>
          <h3>Топ каси</h3>
          <p>Кожне місце показує працівника, його ім’я та аватарку. Точна сума доступна власнику запису й адміністрації.</p>
        </div>
        <span className="cash-live-heading-mark"><UsersRound size={25} /></span>
      </header>

      <div className="cash-live-periods" role="group" aria-label="Період топу каси">
        {([
          ['first', '1–14'],
          ['second', `15–${daysInMonth}`],
          ['month', 'Місяць'],
          ['year', String(year)],
        ] as const).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={period === key ? 'is-active' : ''}
            onClick={() => onPeriodChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="cash-live-explanation">Період: {periodLabel(period, daysInMonth, year)}.</p>

      {sorted.length === 0 ? (
        <div className="cash-live-empty">
          <TrendingUp size={28} />
          <strong>Топ ще формується</strong>
          <span>Працівники з’являться після перших записів каси.</span>
        </div>
      ) : (
        <>
          <div className="cash-live-podium" aria-label="Перші три місця">
            {podium.map((row) => (
              <article
                key={row.userId}
                className={`cash-podium-card rank-${row.rank} ${row.mine ? 'is-mine' : ''}`}
              >
                <span className="cash-podium-medal">{PODIUM_EMOJI[row.rank - 1] || `#${row.rank}`}</span>
                <PersonAvatar row={row} podium />
                <div className="cash-podium-person">
                  <strong>{row.name}</strong>
                  <small>{roleLabel(row)}</small>
                </div>
                <ResultValue row={row} />
                {row.mine ? <b>Ви</b> : null}
              </article>
            ))}
          </div>

          {trail.length > 0 ? (
            <div className="cash-live-trail" aria-label="Наступні місця топу">
              {trail.map((row) => (
                <article key={row.userId} className={row.mine ? 'is-mine' : ''}>
                  <span className="cash-live-rank">#{row.rank}</span>
                  <PersonAvatar row={row} />
                  <div className="cash-live-person">
                    <strong>{row.name}</strong>
                    <small>{roleLabel(row)}</small>
                  </div>
                  <div className="cash-live-result">
                    <ResultValue row={row} />
                    {row.mine ? <span>Ви</span> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {mine ? (
            <div className="cash-live-own-summary">
              <ShieldCheck size={18} />
              <PersonAvatar row={mine} />
              <span>{mine.name}</span>
              <strong>#{mine.rank}</strong>
            </div>
          ) : null}
        </>
      )}

      <footer className="cash-live-privacy">
        <Medal size={17} />
        <div>
          <strong>Імена й аватарки відкриті для команди</strong>
          <span>{canViewAll ? 'Адміністрація бачить точні розрахункові суми.' : 'Чужі точні розрахункові суми залишаються прихованими.'}</span>
        </div>
        {sorted[0] ? <Crown size={18} /> : null}
      </footer>
    </section>
  );
}
