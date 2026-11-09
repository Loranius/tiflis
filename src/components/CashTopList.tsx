import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

export type CashTopPeriod = 'first' | 'second' | 'month' | 'year';

interface TimelinePoint {
  rank: number;
  progress: number;
}

export interface CashTopRow {
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

interface CashTopListProps {
  rows: CashTopRow[];
  period: CashTopPeriod;
  daysInMonth: number;
  monthLabel: string;
  year: number;
  focusUserId: string;
  refreshing: boolean;
  onPeriodChange: (period: CashTopPeriod) => void;
}

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

const amountFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });

function displayName(row: CashTopRow): string {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  return name || `Працівник #${row.rank}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '—';
}

function roleLabel(row: CashTopRow): string {
  return [row.role, row.role2]
    .filter((role): role is string => typeof role === 'string' && Boolean(role.trim()))
    .map((role) => ROLE_LABELS[role] || role)
    .filter((role, index, all) => all.indexOf(role) === index)
    .join(' · ') || 'Працівник ресторану';
}

/** Places gained since the previous ranking day (positive = moved up). */
export function rankMovement(row: CashTopRow): number {
  const timeline = row.timeline || {};
  const dates = Object.keys(timeline).sort();
  if (dates.length < 2) return 0;
  const latest = timeline[dates[dates.length - 1] ?? ''];
  const previous = timeline[dates[dates.length - 2] ?? ''];
  if (!latest || !previous) return 0;
  return Number(previous.rank) - Number(latest.rank);
}

function Movement({ value }: { value: number }) {
  if (value > 0) return <span className="cv3-move is-up" aria-label={`Піднявся на ${value}`}><ArrowUp size={13} />{value}</span>;
  if (value < 0) return <span className="cv3-move is-down" aria-label={`Опустився на ${Math.abs(value)}`}><ArrowDown size={13} />{Math.abs(value)}</span>;
  return <span className="cv3-move" aria-label="Без змін"><Minus size={13} /></span>;
}

function Avatar({ row }: { row: CashTopRow }) {
  const name = displayName(row);
  return (
    <span className="cv3-avatar" aria-hidden="true">
      <span>{initials(name)}</span>
      {row.avatar ? (
        <img src={row.avatar} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
      ) : null}
    </span>
  );
}

function goalText(rank: number): string {
  if (rank === 1) return 'Перше місце. Тримай темп.';
  if (rank <= 3) return `До ${rank - 1}-го місця — одна позиція.`;
  if (rank === 4) return 'До трійки — одна позиція.';
  return `Наступна ціль — ${rank - 1}-е місце.`;
}

export function CashTopList({
  rows,
  period,
  daysInMonth,
  monthLabel,
  year,
  focusUserId,
  refreshing,
  onPeriodChange,
}: CashTopListProps) {
  const sorted = [...rows].sort((left, right) => left.rank - right.rank);
  const focus = sorted.find((row) => row.userId === focusUserId) || sorted.find((row) => row.mine) || null;
  const focusIsMine = Boolean(focus?.mine);
  const periodText = period === 'first'
    ? `1–14, ${monthLabel.toLowerCase()}`
    : period === 'second'
      ? `15–${daysInMonth}, ${monthLabel.toLowerCase()}`
      : period === 'year'
        ? `${year} рік`
        : monthLabel;

  return (
    <div className={`cv3-top${refreshing ? ' is-refreshing' : ''}`}>
      <div className="cv3-seg is-four" role="radiogroup" aria-label="Період топу">
        {([
          ['first', '1–14'],
          ['second', `15–${daysInMonth}`],
          ['month', 'Місяць'],
          ['year', 'Рік'],
        ] as const).map(([value, label]) => (
          <button
            type="button"
            role="radio"
            aria-checked={period === value}
            key={value}
            className={period === value ? 'is-on' : ''}
            onClick={() => onPeriodChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="cv3-main">
        {focus ? (
          <section className="cv3-place" aria-labelledby="cv3-place-title">
            <div className="cv3-payout-head">
              <h2 id="cv3-place-title">{focusIsMine ? 'Твоє місце' : `Місце: ${displayName(focus)}`}</h2>
              <span>{periodText}</span>
            </div>
            <div className="cv3-place-row">
              <p className="cv3-payout-sum">{focus.rank}<span>з {sorted.length}</span></p>
              <Movement value={rankMovement(focus)} />
            </div>
            <p className="cv3-note">
              {focusIsMine && typeof focus.total === 'number' ? `Твоя каса за період: ${amountFormat.format(focus.total)} ₴. ` : ''}
              {goalText(focus.rank)}
            </p>
          </section>
        ) : (
          <section className="cv3-place">
            <div className="cv3-payout-head">
              <h2>Твоє місце</h2>
              <span>{periodText}</span>
            </div>
            <p className="cv3-empty">У цьому періоді ще немає твоєї каси. Внеси касу після зміни, і з’явишся в топі.</p>
          </section>
        )}

        <section className="cv3-card cv3-ranking" aria-labelledby="cv3-ranking-title">
          <div className="cv3-card-head">
            <h3 id="cv3-ranking-title">Топ каси</h3>
            <span>{sorted.length ? `${sorted.length} у рейтингу` : ''}</span>
          </div>
          {sorted.length === 0 ? (
            <p className="cv3-empty">Рейтинг за цей період ще порожній.</p>
          ) : (
            <ol>
              {sorted.map((row) => {
                const isFocus = focus ? row === focus : false;
                return (
                  <li key={row.userId || `${displayName(row)}-${row.rank}`} className={`${isFocus ? 'is-focus' : ''}${row.rank <= 3 ? ' is-podium' : ''}`}>
                    <span className="cv3-rank">{row.rank}</span>
                    <Avatar row={row} />
                    <span className="cv3-person">
                      <strong>{displayName(row)}{row.mine ? <em>Ти</em> : null}</strong>
                      <small>{roleLabel(row)}</small>
                    </span>
                    <Movement value={rankMovement(row)} />
                  </li>
                );
              })}
            </ol>
          )}
          <p className="cv3-privacy">Видно лише місця й рух. Суми інших працівників не показуються.</p>
        </section>
      </div>
    </div>
  );
}
