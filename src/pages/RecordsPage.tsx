import {
  Banknote,
  CalendarCheck2,
  CalendarDays,
  Check,
  Coins,
  Edit3,
  LayoutGrid,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Trophy,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useKyivDay } from '../hooks/useKyivDay';
import { secureApi } from '../lib/secureApi';
import './records.css';

type ManualRecordCategory = 'largest_tip' | 'plates_at_once' | 'tables_at_once';
type HalfKey = 'first' | 'second';

interface RecordsStaff {
  id: string;
  name: string;
  avatar: string | null;
}

interface PeriodRecord {
  value: number;
  month: string | null;
  half?: HalfKey | null;
}

interface ManualRecord {
  value: number;
  achievedOn: string;
  updatedAt: string;
}

interface RecordsBootstrapResponse {
  ok: true;
  viewUserId: string;
  me: {
    legacyUserId: string;
    canViewAll: boolean;
    canEditAll: boolean;
  };
  users: RecordsStaff[];
  automatic: {
    largestMonthCash: PeriodRecord;
    largestHalfCash: PeriodRecord;
    largestMonthShifts: PeriodRecord;
    largestHalfShifts: PeriodRecord;
  };
  manual: Partial<Record<ManualRecordCategory, ManualRecord>>;
}

interface ManualRecordDefinition {
  title: string;
  description: string;
  inputLabel: string;
  unit: string;
  placeholder: string;
  max: number;
  step: string;
  icon: LucideIcon;
}

interface EditorState {
  category: ManualRecordCategory;
  value: string;
  achievedOn: string;
}

const MANUAL_RECORDS: Record<ManualRecordCategory, ManualRecordDefinition> = {
  largest_tip: {
    title: 'Найбільші чайові',
    description: 'Найбільша сума чайових за один стіл або подію.',
    inputLabel: 'Сума чайових',
    unit: '₴',
    placeholder: 'Наприклад, 2500',
    max: 1_000_000,
    step: '0.01',
    icon: Coins,
  },
  plates_at_once: {
    title: 'Тарілок за раз',
    description: 'Найбільша кількість тарілок, винесених одночасно.',
    inputLabel: 'Кількість тарілок',
    unit: 'шт.',
    placeholder: 'Наприклад, 6',
    max: 200,
    step: '1',
    icon: UtensilsCrossed,
  },
  tables_at_once: {
    title: 'Столиків одночасно',
    description: 'Найбільша кількість столиків, взятих у роботу за раз.',
    inputLabel: 'Кількість столиків',
    unit: 'шт.',
    placeholder: 'Наприклад, 8',
    max: 200,
    step: '1',
    icon: LayoutGrid,
  },
};

const MANUAL_ORDER = Object.keys(MANUAL_RECORDS) as ManualRecordCategory[];
const MONTH_FORMATTER = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' });
const DATE_FORMATTER = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
const NUMBER_FORMATTER = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
const MONEY_FORMATTER = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
});

function monthLabel(month: string | null): string {
  if (!month) return 'Даних ще немає';
  return MONTH_FORMATTER.format(new Date(`${month}-01T12:00:00`));
}

function halfLabel(record: PeriodRecord): string {
  if (!record.month || !record.half) return 'Даних ще немає';
  const [yearText = '', monthText = ''] = record.month.split('-');
  const daysInMonth = new Date(Number(yearText), Number(monthText), 0).getDate();
  return `${record.half === 'first' ? '1–14' : `15–${daysInMonth}`} · ${monthLabel(record.month)}`;
}

function dateLabel(value: string): string {
  return DATE_FORMATTER.format(new Date(`${value}T12:00:00`));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '—';
}

function plural(value: number, one: string, few: string, many: string): string {
  const absolute = Math.abs(Math.trunc(value));
  const tens = absolute % 100;
  const units = absolute % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

function manualValue(category: ManualRecordCategory, record: ManualRecord | undefined): string {
  if (!record) return '—';
  if (category === 'largest_tip') return MONEY_FORMATTER.format(record.value);
  if (category === 'plates_at_once') {
    return `${NUMBER_FORMATTER.format(record.value)} ${plural(record.value, 'тарілка', 'тарілки', 'тарілок')}`;
  }
  return `${NUMBER_FORMATTER.format(record.value)} ${plural(record.value, 'столик', 'столики', 'столиків')}`;
}

function shiftValue(record: PeriodRecord): string {
  return record.value > 0
    ? `${NUMBER_FORMATTER.format(record.value)} ${plural(record.value, 'зміна', 'зміни', 'змін')}`
    : '—';
}

export function RecordsPage() {
  const { user } = useAuth();
  const today = useKyivDay();
  const requestId = useRef(0);
  const [viewUserId, setViewUserId] = useState(user?.id || '');
  const [data, setData] = useState<RecordsBootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    if (user && !viewUserId) setViewUserId(user.id);
  }, [user, viewUserId]);

  const load = useCallback(async (forceRefresh = false) => {
    if (!viewUserId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<RecordsBootstrapResponse>({
        action: 'records_bootstrap',
        user_id: viewUserId,
      }, 'tiflis-secure-api', { forceRefresh });
      if (requestId.current !== id) return;
      setData(response);
      if (response.viewUserId !== viewUserId) setViewUserId(response.viewUserId);
    } catch (reason) {
      if (requestId.current !== id) return;
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити рекорди.');
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [viewUserId]);

  useEffect(() => { void load(); }, [load]);

  const selectedStaff = useMemo(
    () => data?.users.find((staff) => staff.id === data.viewUserId) || null,
    [data],
  );
  const canEdit = Boolean(data && (data.me.canEditAll || data.viewUserId === data.me.legacyUserId));

  function openEditor(category: ManualRecordCategory) {
    const current = data?.manual[category];
    setError(null);
    setEditorError(null);
    setEditor({
      category,
      value: current ? String(current.value) : '',
      achievedOn: current?.achievedOn || today,
    });
  }

  async function saveManualRecord() {
    if (!data || !editor) return;
    const definition = MANUAL_RECORDS[editor.category];
    const normalized = Number(editor.value.replace(',', '.'));
    const requiresInteger = editor.category !== 'largest_tip';
    if (
      !Number.isFinite(normalized)
      || normalized <= 0
      || normalized > definition.max
      || (requiresInteger && !Number.isInteger(normalized))
    ) {
      setEditorError(requiresInteger
        ? 'Вкажіть цілу кількість більше нуля.'
        : 'Вкажіть коректну суму більше нуля.');
      return;
    }

    setSaving(true);
    setEditorError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'records_save_manual',
        user_id: data.viewUserId,
        category: editor.category,
        value: normalized,
        achieved_on: editor.achievedOn,
      });
      setEditor(null);
      await load(true);
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : 'Не вдалося зберегти рекорд.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteManualRecord() {
    if (!data || !editor || !data.manual[editor.category]) return;
    if (!window.confirm('Видалити цей особистий рекорд?')) return;
    setSaving(true);
    setEditorError(null);
    try {
      await secureApi<{ ok: true }>({
        action: 'records_delete_manual',
        user_id: data.viewUserId,
        category: editor.category,
      });
      setEditor(null);
      await load(true);
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : 'Не вдалося видалити рекорд.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="records-page">
      <section className="records-hero">
        <div>
          <span className="eyebrow">Особистий прогрес</span>
          <h2>Рекорди</h2>
          <p>Каса та зміни рахуються автоматично за всю історію. Особисті досягнення можна додати вручну.</p>
        </div>
        <span className="records-hero-mark" aria-hidden="true"><Trophy size={34} /></span>
      </section>

      {error ? (
        <div className="records-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Закрити повідомлення"><X size={17} /></button>
        </div>
      ) : null}

      {loading ? (
        <div className="records-loading" aria-live="polite">
          <RefreshCw className="is-spinning" size={23} />
          <span>Збираємо рекорди з історії…</span>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="records-person-bar">
            <div className="records-person">
              <span className="records-avatar" aria-hidden="true">
                <span>{initials(selectedStaff?.name || 'Офіціант')}</span>
                {selectedStaff?.avatar ? (
                  <img
                    src={selectedStaff.avatar}
                    alt=""
                    onError={(event) => { event.currentTarget.hidden = true; }}
                  />
                ) : null}
              </span>
              <div>
                <span>Особисті рекорди</span>
                <strong>{selectedStaff?.name || 'Офіціант'}</strong>
              </div>
            </div>

            <div className="records-person-actions">
              {data.me.canViewAll ? (
                <label>
                  <span>Офіціант</span>
                  <select value={data.viewUserId} onChange={(event) => setViewUserId(event.target.value)}>
                    {data.users.map((staff) => <option value={staff.id} key={staff.id}>{staff.name}</option>)}
                  </select>
                </label>
              ) : null}
              <button type="button" onClick={() => void load(true)} aria-label="Оновити рекорди">
                <RefreshCw size={17} />
                <span>Оновити</span>
              </button>
            </div>
          </section>

          <section className="records-section" aria-labelledby="automatic-records-title">
            <header className="records-section-heading">
              <div>
                <span className="eyebrow">Без ручного вводу</span>
                <h3 id="automatic-records-title">Рахує система</h3>
              </div>
              <span><ShieldCheck size={16} /> Дані каси й графіка</span>
            </header>

            <div className="records-grid records-grid-automatic">
              <article className="record-card record-card-auto">
                <header><span><Banknote size={21} /></span><b>Автоматично</b></header>
                <div>
                  <span>Найбільша каса за місяць</span>
                  <strong>{data.automatic.largestMonthCash.value > 0 ? MONEY_FORMATTER.format(data.automatic.largestMonthCash.value) : '—'}</strong>
                  <small>{monthLabel(data.automatic.largestMonthCash.month)}</small>
                </div>
              </article>

              <article className="record-card record-card-auto">
                <header><span><CalendarDays size={21} /></span><b>Автоматично</b></header>
                <div>
                  <span>Найбільша каса за півмісяця</span>
                  <strong>{data.automatic.largestHalfCash.value > 0 ? MONEY_FORMATTER.format(data.automatic.largestHalfCash.value) : '—'}</strong>
                  <small>{halfLabel(data.automatic.largestHalfCash)}</small>
                </div>
              </article>

              <article className="record-card record-card-auto record-card-shifts">
                <header><span><CalendarCheck2 size={21} /></span><b>Автоматично</b></header>
                <div className="record-card-title">
                  <span>Найбільша кількість змін</span>
                </div>
                <div className="record-split">
                  <div>
                    <span>За місяць</span>
                    <strong>{shiftValue(data.automatic.largestMonthShifts)}</strong>
                    <small>{monthLabel(data.automatic.largestMonthShifts.month)}</small>
                  </div>
                  <div>
                    <span>За півмісяця</span>
                    <strong>{shiftValue(data.automatic.largestHalfShifts)}</strong>
                    <small>{halfLabel(data.automatic.largestHalfShifts)}</small>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="records-section" aria-labelledby="manual-records-title">
            <header className="records-section-heading">
              <div>
                <span className="eyebrow">Особисті досягнення</span>
                <h3 id="manual-records-title">Вносяться вручну</h3>
              </div>
              <span><Edit3 size={16} /> Підтримує офіціант</span>
            </header>

            <div className="records-grid records-grid-manual">
              {MANUAL_ORDER.map((category) => {
                const definition = MANUAL_RECORDS[category];
                const record = data.manual[category];
                const Icon = definition.icon;
                return (
                  <article className={`record-card record-card-manual${record ? ' has-record' : ' is-empty'}`} key={category}>
                    <header>
                      <span><Icon size={21} /></span>
                      <b>{record ? 'Особистий рекорд' : 'Ще не внесено'}</b>
                    </header>
                    <div>
                      <span>{definition.title}</span>
                      <strong>{manualValue(category, record)}</strong>
                      <small>{record ? `Досягнуто ${dateLabel(record.achievedOn)}` : definition.description}</small>
                    </div>
                    {canEdit ? (
                      <button type="button" onClick={() => openEditor(category)}>
                        {record ? <Edit3 size={16} /> : <Plus size={16} />}
                        {record ? 'Оновити' : 'Додати'}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {editor ? (
        <div className="records-editor-backdrop" onMouseDown={() => !saving && setEditor(null)}>
          <section
            className="records-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="records-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Особистий рекорд</span>
                <h3 id="records-editor-title">{MANUAL_RECORDS[editor.category].title}</h3>
              </div>
              <button type="button" onClick={() => setEditor(null)} disabled={saving} aria-label="Закрити"><X size={20} /></button>
            </header>

            <p>{MANUAL_RECORDS[editor.category].description}</p>

            {editorError ? <div className="records-editor-error" role="alert">{editorError}</div> : null}

            <div className="records-editor-fields">
              <label>
                <span>{MANUAL_RECORDS[editor.category].inputLabel}</span>
                <span className="records-value-input">
                  <input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={MANUAL_RECORDS[editor.category].max}
                    step={MANUAL_RECORDS[editor.category].step}
                    value={editor.value}
                    placeholder={MANUAL_RECORDS[editor.category].placeholder}
                    onChange={(event) => setEditor({ ...editor, value: event.target.value })}
                  />
                  <b>{MANUAL_RECORDS[editor.category].unit}</b>
                </span>
              </label>
              <label>
                <span>Дата досягнення</span>
                <input
                  type="date"
                  max={today}
                  value={editor.achievedOn}
                  onChange={(event) => setEditor({ ...editor, achievedOn: event.target.value })}
                />
              </label>
            </div>

            <footer>
              {data?.manual[editor.category] ? (
                <button type="button" className="is-danger" onClick={() => void deleteManualRecord()} disabled={saving}>
                  <Trash2 size={17} /> Видалити
                </button>
              ) : <span />}
              <button type="button" className="is-primary" onClick={() => void saveManualRecord()} disabled={saving || !editor.value || !editor.achievedOn}>
                {saving ? <RefreshCw className="is-spinning" size={17} /> : <Check size={17} />}
                Зберегти рекорд
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
