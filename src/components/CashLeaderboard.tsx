import {
  Award,
  Crown,
  Flame,
  Medal,
  Mountain,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import './cash-leaderboard.css';

export type CashLeaderboardPeriod = 'first' | 'second' | 'month' | 'year';

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

function displayName(row: CashLeaderboardRow): string {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  return name || `Працівник #${row.rank}`;
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
  const labels = [row.role, row.role2]
    .filter((role): role is string => typeof role === 'string' && Boolean(role.trim()))
    .map((role) => ROLE_LABELS[role] || role)
    .filter((role, index, all) => all.indexOf(role) === index);
  return labels.join(' · ') || 'Працівник ресторану';
}

function rankStatus(rank: number): string {
  if (rank === 1) return 'Тримає вершину ліги';
  if (rank === 2) return 'Головний переслідувач';
  if (rank === 3) return 'У призовій трійці';
  if (rank <= 5) return 'За крок до подіуму';
  return 'Підіймається маршрутом';
}

function personalGoal(rank: number): string {
  if (rank === 1) return 'Зберегти лідерство';
  if (rank <= 3) return 'Піднятися на наступну сходинку';
  return 'Увійти до топ-3';
}

function safeRelative(row: CashLeaderboardRow): number {
  const value = Number(row.relative ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function PersonAvatar({ row, podium = false }: { row: CashLeaderboardRow; podium?: boolean }) {
  const name = displayName(row);
  const avatar = typeof row.avatar === 'string' && row.avatar.trim() ? row.avatar.trim() : null;

  return (
    <span className={`cash-board-avatar ${podium ? 'is-podium' : ''}`} aria-hidden="true">
      <span>{initials(name)}</span>
      {avatar ? (
        <img
          src={avatar}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      ) : null}
    </span>
  );
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
  const leader = sorted[0] || null;
  const challenger = sorted[1] || null;
  const teamPulse = sorted.length
    ? Math.round(sorted.reduce((sum, row) => sum + safeRelative(row), 0) / sorted.length)
    : 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const preferred = mine || leader;
    if (!preferred) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (
      current && sorted.some((row) => rowIdentity(row) === current)
        ? current
        : rowIdentity(preferred)
    ));
  }, [leader, mine, sorted]);

  const selected = sorted.find((row) => rowIdentity(row) === selectedId) || mine || leader;

  function selectRow(row: CashLeaderboardRow) {
    setSelectedId(rowIdentity(row));
  }

  function scrollToEntry() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <section className="cash-live-board">
      <header className="cash-live-heading">
        <div>
          <span className="eyebrow">Сезонна ліга Tiflis</span>
          <h3>Сходження каси</h3>
          <p>Вносьте касу після зміни, з’являйтеся в рейтингу й підіймайтеся до вершини разом із командою.</p>
        </div>
        <span className="cash-live-heading-mark"><Mountain size={25} /></span>
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

      <div className="cash-league-status">
        <div>
          <span>Поточний етап</span>
          <strong>{periodLabel(period, daysInMonth, year)}</strong>
        </div>
        <div>
          <span>Учасників із внесеною касою</span>
          <strong>{sorted.length}</strong>
        </div>
        <div>
          <span>Командний темп</span>
          <strong>{teamPulse >= 75 ? 'Високий' : teamPulse >= 45 ? 'Набирає хід' : 'Стартує'}</strong>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="cash-live-empty">
          <TrendingUp size={28} />
          <strong>Ліга чекає на першу касу</strong>
          <span>Внесіть касу після зміни — і відкрийте рейтинг періоду.</span>
          <button type="button" onClick={scrollToEntry}>Внести першу касу</button>
        </div>
      ) : (
        <>
          <div className="cash-league-stage" key={period}>
            <span className="cash-league-route" aria-hidden="true" />
            <div className="cash-live-podium" aria-label="Перші три місця">
              {podium.map((row) => (
                <button
                  type="button"
                  key={rowIdentity(row)}
                  className={`cash-podium-card rank-${row.rank} ${row.mine ? 'is-mine' : ''} ${selected && rowIdentity(selected) === rowIdentity(row) ? 'is-selected' : ''}`}
                  onClick={() => selectRow(row)}
                  aria-label={`${displayName(row)}, місце ${row.rank}`}
                >
                  <span className="cash-podium-glow" aria-hidden="true" />
                  <span className="cash-podium-medal">{PODIUM_EMOJI[row.rank - 1] || `#${row.rank}`}</span>
                  <PersonAvatar row={row} podium />
                  <span className="cash-podium-person">
                    <strong>{displayName(row)}</strong>
                    <small>{roleLabel(row)}</small>
                  </span>
                  <span className="cash-podium-status">{rankStatus(row.rank)}</span>
                  {row.mine ? <b>Ви</b> : null}
                </button>
              ))}
            </div>
          </div>

          <section className="cash-league-awards" aria-label="Номінації періоду">
            <header><Award size={18} /><strong>Номінації періоду</strong></header>
            <div>
              <article className="is-gold">
                <Crown size={19} />
                <span>Лідер ліги</span>
                <strong>{leader ? displayName(leader) : '—'}</strong>
              </article>
              <article className="is-silver">
                <Zap size={19} />
                <span>Головний переслідувач</span>
                <strong>{challenger ? displayName(challenger) : 'Місце вільне'}</strong>
              </article>
              <article className="is-green">
                <UsersRound size={19} />
                <span>Командна активність</span>
                <strong>{sorted.length} у рейтингу</strong>
              </article>
            </div>
          </section>

          {trail.length > 0 ? (
            <div className="cash-live-trail" aria-label="Наступні місця топу">
              {trail.map((row, index) => (
                <button
                  type="button"
                  key={rowIdentity(row)}
                  className={`${row.mine ? 'is-mine' : ''} ${selected && rowIdentity(selected) === rowIdentity(row) ? 'is-selected' : ''}`}
                  style={{ '--rank-delay': `${Math.min(index, 8) * 35}ms` } as React.CSSProperties}
                  onClick={() => selectRow(row)}
                >
                  <span className="cash-live-rank">#{row.rank}</span>
                  <PersonAvatar row={row} />
                  <span className="cash-live-person">
                    <strong>{displayName(row)}</strong>
                    <small>{roleLabel(row)}</small>
                  </span>
                  <span className="cash-live-result">
                    <small>{rankStatus(row.rank)}</small>
                    {row.mine ? <b>Ви</b> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <section className={`cash-league-profile ${selected.mine ? 'is-mine' : ''}`} aria-live="polite">
              <div className="cash-league-profile-main">
                <PersonAvatar row={selected} />
                <div>
                  <span>{selected.mine ? 'Ваш маршрут' : 'Профіль учасника'}</span>
                  <strong>{displayName(selected)}</strong>
                  <small>{roleLabel(selected)}</small>
                </div>
                <b>#{selected.rank}</b>
              </div>
              <div className="cash-league-profile-progress">
                <header>
                  <span>{selected.mine ? personalGoal(selected.rank) : rankStatus(selected.rank)}</span>
                  <strong>{selected.rank === 1 ? 'Вершина' : 'Шлях до вершини'}</strong>
                </header>
                <div><span style={{ width: `${Math.max(7, safeRelative(selected))}%` }} /></div>
              </div>
              {selected.mine ? (
                <button type="button" className="cash-league-entry-button" onClick={scrollToEntry}>
                  <Flame size={17} /> Внести касу після зміни
                </button>
              ) : null}
            </section>
          ) : null}

          {mine ? (
            <div className="cash-live-own-summary">
              <ShieldCheck size={18} />
              <PersonAvatar row={mine} />
              <span>
                <small>Особиста позиція</small>
                <strong>{displayName(mine)}</strong>
              </span>
              <b>#{mine.rank}</b>
            </div>
          ) : (
            <div className="cash-league-callout">
              <Target size={19} />
              <div><strong>Вашого запису ще немає в цьому періоді</strong><span>Внесіть касу, щоб з’явитися на маршруті ліги.</span></div>
              <button type="button" onClick={scrollToEntry}>До форми</button>
            </div>
          )}
        </>
      )}

      <footer className="cash-live-privacy">
        <Medal size={17} />
        <div>
          <strong>Здорова конкуренція без чужих сум</strong>
          <span>{canViewAll ? 'Команда бачить імена, аватарки, місця й динаміку маршруту — без розрахованих сум.' : 'Ви бачите порядок місць і власний шлях до вершини без чужих фінансових даних.'}</span>
        </div>
        {sorted[0] ? <Trophy size={18} /> : <Sparkles size={18} />}
      </footer>
    </section>
  );
}
