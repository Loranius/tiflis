import {
  Crown,
  EyeOff,
  Medal,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import './cash-leaderboard.css';

export type CashLeaderboardPeriod = 'first' | 'second' | 'month' | 'year';

export interface CashLeaderboardRow {
  userId: string;
  name: string;
  rank: number;
  total: number | null;
  relative: number;
  mine: boolean;
  avatar?: string | null;
  role?: string | null;
  role2?: string | null;
}

interface CashLeaderboardProps {
  rows: CashLeaderboardRow[];
  period: CashLeaderboardPeriod;
  daysInMonth: number;
  year: number;
  canViewAll: boolean;
  onPeriodChange: (period: CashLeaderboardPeriod) => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністратор',
  sysadmin: 'Системний адміністратор',
  waiter: 'Офіціант',
  bar: 'Бармен',
  barman: 'Бармен',
  bartender: 'Бармен',
  sommelier: 'Сомельє',
  hostess: 'Хостес',
  runner: 'Ранер',
  chef: 'Шеф-кухар',
  cook: 'Кухар',
  trainee: 'Стажер',
  staff: 'Працівник',
};

const PODIUM_EMOJI = ['🥇', '🥈', '🥉'];

function money(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  if (role === 'barman' || role === 'bartender') return 'bar';
  return role;
}

function roleTitle(row: CashLeaderboardRow): string {
  const roles = [normalizeRole(row.role), normalizeRole(row.role2)]
    .filter((role, index, all): role is string => Boolean(role) && all.indexOf(role) === index);

  if (roles.includes('waiter') && roles.includes('bar')) return 'Бармен-офіціант';
  if (roles.includes('waiter') && roles.includes('sommelier')) return 'Сомельє-офіціант';
  if (roles.includes('waiter') && roles.includes('hostess')) return 'Хостес-офіціант';
  if (roles.length === 0) return 'Працівник';
  return roles.map((role) => ROLE_LABELS[role] || role).join(' · ');
}

function periodExplanation(period: CashLeaderboardPeriod, daysInMonth: number): string {
  if (period === 'first') return '4% каси за 1–14 число + ставки за робочі дні 1–15.';
  if (period === 'second') return `4% каси за 15–${daysInMonth} число + ставки за робочі дні 16–${daysInMonth}.`;
  if (period === 'year') return 'Загальна розрахункова виплата за вибраний рік.';
  return 'Повна розрахункова виплата за місяць.';
}

function progressStyle(relative: number): CSSProperties {
  return { '--cash-progress': `${Math.max(3, Math.min(100, relative))}%` } as CSSProperties;
}

function Avatar({ row, className = '' }: { row: CashLeaderboardRow; className?: string }) {
  return (
    <span className={`cash-live-avatar ${className}`}>
      {row.avatar ? <img src={row.avatar} alt="" loading="lazy" /> : <span>{initials(row.name)}</span>}
    </span>
  );
}

export function CashLeaderboard({
  rows,
  period,
  daysInMonth,
  year,
  canViewAll,
  onPeriodChange,
}: CashLeaderboardProps) {
  const sorted = useMemo(() => [...rows].sort((left, right) => left.rank - right.rank), [rows]);
  const mine = useMemo(() => sorted.find((row) => row.mine) || null, [sorted]);
  const [selectedId, setSelectedId] = useState<string | null>(() => mine?.userId || sorted[0]?.userId || null);

  useEffect(() => {
    if (selectedId && sorted.some((row) => row.userId === selectedId)) return;
    setSelectedId(mine?.userId || sorted[0]?.userId || null);
  }, [mine, selectedId, sorted]);

  const selected = sorted.find((row) => row.userId === selectedId) || mine || sorted[0] || null;
  const topThree = sorted.slice(0, 3);
  const trail = sorted.slice(3);
  const podium = [topThree[1], topThree[0], topThree[2]].filter((row): row is CashLeaderboardRow => Boolean(row));

  return (
    <section className="cash-live-board">
      <header className="cash-live-heading">
        <div>
          <span className="eyebrow">Командна динаміка</span>
          <h3>Живий топ каси</h3>
          <p>Місця та відносний прогрес без розкриття чужих фінансових результатів.</p>
        </div>
        <span className="cash-live-heading-mark"><Medal size={25} /></span>
      </header>

      <div className="cash-live-periods" role="group" aria-label="Період топу каси">
        {([
          ['first', '1–14 + ставка 15'],
          ['second', `15–${daysInMonth}`],
          ['month', 'Увесь місяць'],
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

      <p className="cash-live-explanation">{periodExplanation(period, daysInMonth)}</p>

      {sorted.length === 0 ? (
        <div className="cash-live-empty">
          <TrendingUp size={28} />
          <strong>Топ ще формується</strong>
          <span>Позиції з’являться після перших внесених змін.</span>
        </div>
      ) : (
        <>
          <div className="cash-live-podium" aria-label="Перші три місця">
            {podium.map((row) => (
              <button
                type="button"
                key={row.userId}
                className={`cash-podium-card rank-${row.rank} ${row.mine ? 'is-mine' : ''} ${selected?.userId === row.userId ? 'is-selected' : ''}`}
                onClick={() => setSelectedId(row.userId)}
                aria-pressed={selected?.userId === row.userId}
              >
                <span className="cash-podium-medal">{PODIUM_EMOJI[row.rank - 1] || `#${row.rank}`}</span>
                <Avatar row={row} className="cash-podium-avatar" />
                <span className="cash-podium-copy">
                  <strong>{row.name}</strong>
                  <small>{roleTitle(row)}</small>
                </span>
                <span className="cash-podium-progress" style={progressStyle(row.relative)}>
                  <i />
                </span>
                <span className="cash-podium-value">
                  {row.total !== null ? money(row.total) : `${Math.round(row.relative)}%`}
                </span>
                {row.mine ? <b>Ви</b> : null}
              </button>
            ))}
          </div>

          {selected ? (
            <article className={`cash-live-focus ${selected.mine ? 'is-mine' : ''}`}>
              <div className="cash-live-focus-person">
                <Avatar row={selected} />
                <div>
                  <span>{selected.mine ? 'Ваша позиція' : `Місце №${selected.rank}`}</span>
                  <strong>{selected.name}</strong>
                  <small>{roleTitle(selected)}</small>
                </div>
              </div>
              <div className="cash-live-focus-stat">
                <span>Прогрес до лідера</span>
                <strong>{Math.round(selected.relative)}%</strong>
              </div>
              <div className="cash-live-focus-stat">
                <span>{selected.total !== null ? 'Розрахунковий результат' : 'Фінансові дані'}</span>
                <strong>{selected.total !== null ? money(selected.total) : 'Приховано'}</strong>
              </div>
              <div className="cash-live-focus-track" style={progressStyle(selected.relative)}><i /></div>
            </article>
          ) : null}

          {trail.length > 0 ? (
            <div className="cash-live-trail" aria-label="Інші позиції топу">
              <div className="cash-live-trail-line" aria-hidden="true" />
              {trail.map((row) => (
                <button
                  type="button"
                  key={row.userId}
                  className={`${row.mine ? 'is-mine' : ''} ${selected?.userId === row.userId ? 'is-selected' : ''}`}
                  onClick={() => setSelectedId(row.userId)}
                  aria-pressed={selected?.userId === row.userId}
                >
                  <span className="cash-live-rank">#{row.rank}</span>
                  <Avatar row={row} />
                  <span className="cash-live-trail-copy">
                    <strong>{row.name}{row.mine ? ' · ви' : ''}</strong>
                    <small>{roleTitle(row)}</small>
                    <span className="cash-live-track" style={progressStyle(row.relative)}><i /></span>
                  </span>
                  <span className="cash-live-trail-value">
                    <strong>{row.total !== null ? money(row.total) : `${Math.round(row.relative)}%`}</strong>
                    <small>{row.total !== null ? 'ваш результат' : 'від лідера'}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {mine && mine.rank > 3 ? (
            <div className="cash-live-own-summary">
              <Sparkles size={18} />
              <span>Ваша поточна позиція</span>
              <strong>#{mine.rank}</strong>
              <small>{Math.round(mine.relative)}% від результату лідера</small>
            </div>
          ) : null}
        </>
      )}

      <footer className="cash-live-privacy">
        {canViewAll ? <ShieldCheck size={17} /> : <EyeOff size={17} />}
        <div>
          <strong>{canViewAll ? 'Адміністративний режим' : 'Приватний рейтинг'}</strong>
          <span>{canViewAll
            ? 'Адміністрації доступні точні підсумки для перевірки розрахунків.'
            : 'Точна сума доступна лише її власнику та адміністрації. Чужий прогрес показано округлено.'}</span>
        </div>
        {sorted[0] ? <Crown size={18} /> : null}
      </footer>
    </section>
  );
}
