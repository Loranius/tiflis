import {
  Award,
  Crown,
  Flame,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import './cash-leaderboard.css';
import './cash-leaderboard-enhanced.css';
import './cash-combo.css';

export type CashLeaderboardPeriod = 'first' | 'second' | 'month' | 'year';

type TimelinePoint = {
  rank: number;
  progress: number;
};

type ComboTone = 'leader' | 'chase' | 'breakthrough' | 'comeback';

type RankCombo = {
  tone: ComboTone;
  label: string;
  streak: number;
  goal: string;
  level: string;
  nextMilestone: number | null;
  milestoneProgress: number;
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

const PODIUM_EMOJI = ['🥇', '🥈', '🥉'];
const COMBO_MILESTONES = [3, 5, 10, 20] as const;
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
  if (rank === 1) return 'Лідер рейтингу';
  if (rank === 2) return 'Найближче до лідера';
  if (rank === 3) return 'У призовій трійці';
  if (rank <= 5) return 'Поруч із топ-3';
  return 'У рейтингу';
}

function personalGoal(rank: number): string {
  if (rank === 1) return 'Збережи лідерство';
  if (rank === 2) return 'Наступна ціль — #1';
  if (rank === 3) return 'Закріпись у топ-3';
  if (rank === 4) return 'До топ-3 — одне місце';
  return `Наступна ціль — #${Math.max(1, rank - 1)}`;
}

function safeRelative(row: CashLeaderboardRow): number {
  const value = Number(row.relative ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function rankMovement(row: CashLeaderboardRow): number {
  const timeline = row.timeline || {};
  const dates = Object.keys(timeline).sort();
  if (dates.length < 2) return 0;
  const latest = timeline[dates[dates.length - 1] ?? ''];
  const previous = timeline[dates[dates.length - 2] ?? ''];
  if (!latest || !previous) return 0;
  return Number(previous.rank) - Number(latest.rank);
}

function timelineRanks(row: CashLeaderboardRow): number[] {
  const timeline = row.timeline || {};
  const ranks = Object.keys(timeline)
    .sort()
    .map((date) => Math.max(1, Number(timeline[date]?.rank ?? row.rank)))
    .filter((rank) => Number.isFinite(rank));
  return ranks.length ? ranks : [Math.max(1, Number(row.rank) || 1)];
}

function trailingWhere(ranks: number[], predicate: (rank: number) => boolean): number {
  let streak = 0;
  for (let index = ranks.length - 1; index >= 0; index -= 1) {
    if (!predicate(ranks[index] ?? Number.POSITIVE_INFINITY)) break;
    streak += 1;
  }
  return Math.max(1, streak);
}

function trailingWithoutDrop(ranks: number[]): number {
  if (!ranks.length) return 1;
  let streak = 1;
  for (let index = ranks.length - 1; index > 0; index -= 1) {
    const current = ranks[index] ?? Number.POSITIVE_INFINITY;
    const previous = ranks[index - 1] ?? Number.POSITIVE_INFINITY;
    if (current > previous) break;
    streak += 1;
  }
  return streak;
}

function comboLevel(streak: number): string {
  if (streak >= 20) return 'Легендарна серія';
  if (streak >= 10) return 'Сильна форма';
  if (streak >= 5) return 'Стабільність';
  if (streak >= 3) return 'Серія';
  return 'Старт';
}

function rankCombo(row: CashLeaderboardRow): RankCombo {
  const rank = Math.max(1, Number(row.rank) || 1);
  const ranks = timelineRanks(row);
  let tone: ComboTone;
  let label: string;
  let streak: number;
  let goal: string;

  if (rank === 1) {
    tone = 'leader';
    label = 'Утримання лідерства';
    streak = trailingWhere(ranks, (value) => value === 1);
    goal = 'Утримай #1 у наступний рейтинговий день';
  } else if (rank <= 3) {
    tone = 'chase';
    label = 'Погоня в топ-3';
    streak = trailingWhere(ranks, (value) => value <= 3);
    goal = rank === 2 ? 'До #1 — одне місце' : 'Закріпись у топ-3 та атакуй #2';
  } else if (rank <= 5) {
    tone = 'breakthrough';
    label = 'Прорив без падіння';
    streak = trailingWithoutDrop(ranks);
    goal = rank === 4 ? 'До топ-3 — одне місце' : 'Продовжуй прорив — наступна ціль #4';
  } else {
    tone = 'comeback';
    label = 'Камбек';
    streak = trailingWithoutDrop(ranks);
    goal = `Продовжуй камбек — наступна ціль #${rank - 1}`;
  }

  const nextMilestone = COMBO_MILESTONES.find((milestone) => milestone > streak) ?? null;
  const previousMilestone = [...COMBO_MILESTONES].reverse().find((milestone) => milestone <= streak) ?? 0;
  const milestoneProgress = nextMilestone
    ? Math.max(8, Math.min(100, ((streak - previousMilestone) / (nextMilestone - previousMilestone)) * 100))
    : 100;

  return {
    tone,
    label,
    streak,
    goal,
    level: comboLevel(streak),
    nextMilestone,
    milestoneProgress,
  };
}

function rankingDayLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'рейтинговий день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'рейтингові дні';
  return 'рейтингових днів';
}

function ComboIcon({ tone, size = 14 }: { tone: ComboTone; size?: number }) {
  if (tone === 'leader') return <Crown size={size} />;
  if (tone === 'chase') return <Zap size={size} />;
  if (tone === 'breakthrough') return <TrendingUp size={size} />;
  return <Flame size={size} />;
}

function ComboBadge({ row }: { row: CashLeaderboardRow }) {
  const combo = rankCombo(row);
  return (
    <span
      className={`cash-combo-badge is-${combo.tone}`}
      title={`${combo.label}: ${combo.streak} ${rankingDayLabel(combo.streak)}`}
      aria-label={`${combo.label}, серія ${combo.streak}`}
    >
      <ComboIcon tone={combo.tone} size={12} />
      <b>×{combo.streak}</b>
    </span>
  );
}

function ComboPanel({ row }: { row: CashLeaderboardRow }) {
  const combo = rankCombo(row);
  return (
    <div className={`cash-combo-card is-${combo.tone}`}>
      <div className="cash-combo-card__top">
        <span className="cash-combo-card__icon" aria-hidden="true">
          <ComboIcon tone={combo.tone} size={20} />
        </span>
        <div className="cash-combo-card__copy">
          <span>Поточна серія</span>
          <strong>{combo.label}</strong>
          <small>{combo.goal}</small>
        </div>
        <div className="cash-combo-card__score">
          <b>×{combo.streak}</b>
          <span>{rankingDayLabel(combo.streak)}</span>
        </div>
      </div>
      <div className="cash-combo-card__track" aria-label={`Прогрес серії: ${combo.level}`}>
        <span style={{ width: `${combo.milestoneProgress}%` }} />
      </div>
      <div className="cash-combo-card__meta">
        <strong>{combo.level}</strong>
        <span>
          {combo.nextMilestone
            ? `Ще ${combo.nextMilestone - combo.streak} до серії ×${combo.nextMilestone}`
            : 'Серія вийшла на максимальний рівень'}
        </span>
      </div>
    </div>
  );
}

function MovementBadge({ row, compact = false }: { row: CashLeaderboardRow; compact?: boolean }) {
  const movement = rankMovement(row);
  const tone = movement > 0 ? 'is-up' : movement < 0 ? 'is-down' : 'is-flat';
  const symbol = movement > 0 ? '▲' : movement < 0 ? '▼' : '—';
  const text = movement === 0 ? 'без змін' : `${Math.abs(movement)} ${Math.abs(movement) === 1 ? 'місце' : 'місця'}`;
  return (
    <span className={`cash-rank-movement ${tone} ${compact ? 'is-compact' : ''}`} title="Зміна позиції відносно попереднього рейтингового дня">
      <b>{symbol}</b><span>{text}</span>
    </span>
  );
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
  const biggestClimber = [...sorted].sort((left, right) => rankMovement(right) - rankMovement(left))[0] || null;
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
          <span className="eyebrow">Рейтинг каси</span>
          <h3>Топ команди</h3>
          <p>Місця формуються за результатами поточного періоду. Чужі суми приховані — видно позицію, серію та її динаміку.</p>
        </div>
        <span className="cash-live-heading-mark"><Trophy size={25} /></span>
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
          <span>Поточний період</span>
          <strong>{periodLabel(period, daysInMonth, year)}</strong>
        </div>
        <div>
          <span>У рейтингу</span>
          <strong>{sorted.length} учасників</strong>
        </div>
        <div>
          <span>Активність</span>
          <strong>{teamPulse >= 75 ? 'Висока' : teamPulse >= 45 ? 'Середня' : 'Стартує'}</strong>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="cash-live-empty">
          <TrendingUp size={28} />
          <strong>Рейтинг ще порожній</strong>
          <span>Внесіть касу після зміни — і перша позиція з’явиться тут.</span>
          <button type="button" onClick={scrollToEntry}>Внести касу</button>
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
                  <ComboBadge row={row} />
                  {row.mine ? <b>Ви</b> : null}
                </button>
              ))}
            </div>
          </div>

          <section className="cash-league-awards" aria-label="Коротко про рейтинг">
            <header><Award size={18} /><strong>Що змінилося</strong></header>
            <div>
              <article className="is-gold">
                <Crown size={19} />
                <span>Перше місце</span>
                <strong>{leader ? displayName(leader) : '—'}</strong>
              </article>
              <article className="is-silver">
                <Zap size={19} />
                <span>Найближчий суперник</span>
                <strong>{challenger ? displayName(challenger) : 'Місце вільне'}</strong>
              </article>
              <article className="is-green">
                <UsersRound size={19} />
                <span>Найбільший ривок</span>
                <strong>{biggestClimber && rankMovement(biggestClimber) > 0 ? `${displayName(biggestClimber)} +${rankMovement(biggestClimber)}` : 'Без перестановок'}</strong>
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
                  style={{ '--rank-delay': `${Math.min(index, 8) * 35}ms` } as CSSProperties}
                  onClick={() => selectRow(row)}
                >
                  <span className="cash-live-rank">#{row.rank}</span>
                  <PersonAvatar row={row} />
                  <span className="cash-live-person">
                    <strong>{displayName(row)}</strong>
                    <small>{roleLabel(row)}</small>
                  </span>
                  <span className="cash-live-result">
                    <ComboBadge row={row} />
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
                  <span>{selected.mine ? 'Ваша позиція' : 'Учасник рейтингу'}</span>
                  <strong>{displayName(selected)}</strong>
                  <small>{roleLabel(selected)}</small>
                </div>
                <b>#{selected.rank}</b>
              </div>
              <div className="cash-league-profile-progress">
                <header>
                  <span>{selected.mine ? personalGoal(selected.rank) : rankStatus(selected.rank)}</span>
                  <MovementBadge row={selected} />
                </header>
                <div><span style={{ width: `${Math.max(7, safeRelative(selected))}%` }} /></div>
              </div>

              <ComboPanel row={selected} />

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
              <div><strong>Вашого запису ще немає в цьому періоді</strong><span>Внесіть касу, щоб з’явитися в рейтингу.</span></div>
              <button type="button" onClick={scrollToEntry}>До форми</button>
            </div>
          )}
        </>
      )}

      <footer className="cash-live-privacy">
        <Medal size={17} />
        <div>
          <strong>Місця, серії й динаміка — без чужих сум</strong>
          <span>{canViewAll ? 'Команда бачить імена, аватарки, позиції, серії та рух у рейтингу. Фінансові суми інших працівників у цьому модулі не показуються.' : 'Ви бачите порядок місць, серії, зміну позицій і власний прогрес без чужих фінансових даних.'}</span>
        </div>
        {sorted[0] ? <Trophy size={18} /> : <Sparkles size={18} />}
      </footer>
    </section>
  );
}
