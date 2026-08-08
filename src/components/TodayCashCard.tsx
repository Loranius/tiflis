import {
  Banknote,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useKyivDay } from '../hooks/useKyivDay';
import { secureApi } from '../lib/secureApi';
import './today-cash.css';

type NumericValue = number | string | null;

interface TodayCashEntry {
  id: number;
  date: string;
  cash: NumericValue;
  tips: NumericValue;
  firstCash: NumericValue;
}

interface TodayCashResponse {
  ok: true;
  date: string;
  canUseCash: boolean;
  entry: TodayCashEntry | null;
}

function valueString(value: NumericValue | undefined): string {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function money(value: NumericValue | undefined): string {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

export function TodayCashCard({ compact = false }: { compact?: boolean }) {
  const dayKey = useKyivDay();
  const [data, setData] = useState<TodayCashResponse | null>(null);
  const [cash, setCash] = useState('');
  const [tips, setTips] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = useRef(0);

  const hydrate = useCallback((response: TodayCashResponse) => {
    setData(response);
    setCash(valueString(response.entry?.cash));
    setTips(valueString(response.entry?.tips));
  }, []);

  const load = useCallback(async (forceRefresh = false) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<TodayCashResponse>({
        action: 'today_cash_get',
      }, 'tiflis-today-cash-api', { forceRefresh });
      if (requestId.current !== id) return;
      hydrate(response);
    } catch (reason) {
      if (requestId.current !== id) return;
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити касу за сьогодні.');
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    setNotice(null);
    void load(true);
  }, [dayKey, load]);

  const originalCash = valueString(data?.entry?.cash);
  const originalTips = valueString(data?.entry?.tips);
  const dirty = cash !== originalCash || tips !== originalTips;
  const total = useMemo(() => {
    const cashValue = Number(cash || 0);
    const tipsValue = Number(tips || 0);
    return (Number.isFinite(cashValue) ? cashValue : 0) + (Number.isFinite(tipsValue) ? tipsValue : 0);
  }, [cash, tips]);

  async function save() {
    if (!data?.canUseCash || !dirty) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await secureApi<TodayCashResponse>({
        action: 'today_cash_save',
        date: dayKey,
        cash,
        tips,
      }, 'tiflis-today-cash-api');
      hydrate(response);
      setNotice(response.entry ? 'Касу за сьогодні збережено.' : 'Порожній запис за сьогодні прибрано.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Касу не збережено.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`today-cash-card-v1${compact ? ' is-dashboard-compact' : ''}`} aria-labelledby="today-cash-title">
      <header className="today-cash-heading-v1">
        <div>
          <span className="eyebrow">Каса за поточний день</span>
          <h2 id="today-cash-title">{compact ? 'Каса, ₴' : 'Швидке внесення каси'}</h2>
          <p>Тільки ваша каса та чайові за сьогодні. Повна статистика залишається в модулі «Каса».</p>
        </div>
        <span className={`today-cash-status-v1${data?.entry ? ' is-saved' : ''}`}>
          {data?.entry ? <CheckCircle2 size={17} /> : <Banknote size={17} />}
          {loading ? 'Перевіряємо…' : data?.entry ? 'Внесено' : 'Не внесено'}
        </span>
      </header>

      {error ? (
        <div className="today-cash-alert-v1" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => void load(true)} aria-label="Спробувати ще раз">
            <RefreshCw size={15} />
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="today-cash-notice-v1" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="today-cash-loading-v1">
          <RefreshCw className="is-spinning" size={20} />
          <span>Завантажуємо сьогоднішній запис…</span>
        </div>
      ) : null}

      {!loading && data && !data.canUseCash ? (
        <div className="today-cash-unavailable-v1">
          <Banknote size={24} />
          <strong>Для вашої ролі каса не заповнюється</strong>
          <span>Цей блок залишається на своєму місці, але внесення сум недоступне.</span>
        </div>
      ) : null}

      {!loading && data?.canUseCash ? (
        <>
          <div className="today-cash-fields-v1">
            <label>
              <span>Каса, ₴</span>
              <input
                type="number"
                min="0"
                max="10000000"
                step="1"
                inputMode="decimal"
                value={cash}
                onChange={(event) => {
                  setCash(event.target.value);
                  setNotice(null);
                }}
                placeholder="0"
                aria-label="Каса за сьогодні"
              />
            </label>
            <label>
              <span>Чайові, ₴ <small>необов’язково</small></span>
              <input
                type="number"
                min="0"
                max="1000000"
                step="1"
                inputMode="decimal"
                value={tips}
                onChange={(event) => {
                  setTips(event.target.value);
                  setNotice(null);
                }}
                placeholder="0"
                aria-label="Чайові за сьогодні"
              />
            </label>
            <div className="today-cash-total-v1">
              <span>Разом за записом</span>
              <strong>{money(total)}</strong>
              <small>{data.entry ? `Збережена каса: ${money(data.entry.cash)}` : 'Запису за сьогодні ще немає'}</small>
            </div>
          </div>

          <footer className="today-cash-actions-v1">
            <Link to="/cash" className="today-cash-link-v1">
              Повна каса
              <ExternalLink size={15} />
            </Link>
            <button
              type="button"
              className="today-cash-save-v1"
              onClick={() => void save()}
              disabled={saving || !dirty}
            >
              {saving ? <RefreshCw className="is-spinning" size={17} /> : <Save size={17} />}
              {saving ? 'Зберігаємо…' : data.entry ? 'Оновити запис' : 'Зберегти за сьогодні'}
            </button>
          </footer>
        </>
      ) : null}
    </section>
  );
}
