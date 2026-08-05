import {
  Crown,
  EyeOff,
  Medal,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import './cash-leaderboard.css';

export type CashLeaderboardPeriod = 'first' | 'second' | 'month' | 'year';

export interface CashLeaderboardRow {
  rank: number;
  mine: boolean;
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

function placeLabel(rank: number): string {
  return `${rank} місце`;
}

function periodLabel(period: CashLeaderboardPeriod, daysInMonth: number, year: number): string {
  if (period === 'first') return '1–14 число';
  if (period === 'second') return `15–${daysInMonth} число`;
  if (period === 'year') return String(year);
  return 'Увесь місяць';
}

export function CashLeaderboard({
  rows,
  period,
  daysInMonth,
  year,
  onPeriodChange,
}: CashLeaderboardProps) {
  const sorted = useMemo(() => [...rows].sort((left, right) => left.rank - right.rank), [rows]);
  const topThree = sorted.slice(0, 3);
  const trail = sorted.slice(3);
  const podium = [topThree[1], topThree[0], topThree[2]].filter((row): row is CashLeaderboardRow => Boolean(row));
  const mine = sorted.find((row) => row.mine) || null;

  return (
    <section className="cash-live-board cash-live-board-anonymous">
      <header className="cash-live-heading">
        <div>
          <span className="eyebrow">Анонімний рейтинг</span>
          <h3>Топ каси за місцями</h3>
          <p>Показано тільки перше, друге, третє та наступні місця. Без імен, фото, сум, відсотків і прогресу.</p>
        </div>
        <span className="cash-live-heading-mark"><Medal size={25} /></span>
      </header>

      <div className="cash-live-periods" role="group" aria-label="Період анонімного топу каси">
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

      <p className="cash-live-explanation">Період: {periodLabel(period, daysInMonth, year)}. Видно лише порядок місць.</p>

      {sorted.length === 0 ? (
        <div className="cash-live-empty">
          <TrendingUp size={28} />
          <strong>Топ ще формується</strong>
          <span>Місця з’являться після перших робочих записів.</span>
        </div>
      ) : (
        <>
          <div className="cash-live-podium" aria-label="Перші три місця">
            {podium.map((row) => (
              <article
                key={row.rank}
                className={`cash-podium-card rank-${row.rank} ${row.mine ? 'is-mine' : ''}`}
              >
                <span className="cash-podium-medal">{PODIUM_EMOJI[row.rank - 1] || `#${row.rank}`}</span>
                <span className="cash-anonymous-place-number">{row.rank}</span>
                <strong className="cash-anonymous-place-label">{placeLabel(row.rank)}</strong>
                {row.mine ? <b>Ви</b> : null}
              </article>
            ))}
          </div>

          {trail.length > 0 ? (
            <div className="cash-live-trail cash-live-trail-anonymous" aria-label="Наступні місця топу">
              {trail.map((row) => (
                <article key={row.rank} className={row.mine ? 'is-mine' : ''}>
                  <span className="cash-live-rank">#{row.rank}</span>
                  <strong>{placeLabel(row.rank)}</strong>
                  {row.mine ? <span className="cash-anonymous-you">Ви</span> : <span className="cash-anonymous-hidden">Анонімно</span>}
                </article>
              ))}
            </div>
          ) : null}

          {mine ? (
            <div className="cash-live-own-summary">
              <ShieldCheck size={18} />
              <span>Ваше місце</span>
              <strong>#{mine.rank}</strong>
            </div>
          ) : null}
        </>
      )}

      <footer className="cash-live-privacy">
        <EyeOff size={17} />
        <div>
          <strong>Повністю анонімний топ</strong>
          <span>Імена, аватари, ролі, суми, відсотки та фінансовий прогрес не передаються на цю сторінку.</span>
        </div>
        {sorted[0] ? <Crown size={18} /> : null}
      </footer>
    </section>
  );
}
