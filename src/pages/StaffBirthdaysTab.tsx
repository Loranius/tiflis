import {
  Cake, Check, Edit3, Plus, RefreshCw, Search, Trash2, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useKyivDay } from '../hooks/useKyivDay';
import { secureApi } from '../lib/secureApi';
import './staff-birthdays.css';

interface BirthdayPerson {
  id: number;
  full_name: string;
  position: string;
  position_detail: string | null;
  position2: string | null;
  position2_detail: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  avatar: string | null;
}

interface BirthdaysBootstrapResponse {
  ok: true;
  permissions: { canManage: boolean };
  people: BirthdayPerson[];
}

interface BirthdayEditor {
  id: number | null;
  fullName: string;
  position: string;
  positionDetail: string;
  position2: string;
  position2Detail: string;
  birthdayMonth: string;
  birthdayDay: string;
  avatar: string;
}

const POSITION_ORDER = [
  'admin', 'bartender', 'waiter', 'hostess', 'runner', 'sommelier',
  'head_chef', 'cook', 'cook_assistant', 'housekeeping', 'facilities',
  'hearth_keeper', 'purchasing',
];

const POSITION_LABELS: Record<string, string> = {
  admin: 'Адміністратор',
  bartender: 'Бармен',
  waiter: 'Офіціант',
  hostess: 'Хостес',
  runner: 'Ранер',
  sommelier: 'Сомельє',
  head_chef: 'Шеф-кухар',
  cook: 'Кухар',
  cook_assistant: 'Помічник кухаря',
  housekeeping: 'Господині',
  facilities: 'Завгосп',
  hearth_keeper: 'Камінщик',
  purchasing: 'Закупівник',
};

const COOK_DETAIL_LABELS: Record<string, string> = {
  hot: 'Гарячий процес',
  cold: 'Холодний процес',
  pastry: 'Борошняно-кондитерський процес',
  grill: 'Мангал процес',
};

const HOUSEKEEPING_DETAIL_LABELS: Record<string, string> = {
  cleaner: 'Прибиральниця',
  wash_white: 'Біла мийка',
  wash_black: 'Чорна мийка',
};

const MONTH_LABELS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

const REFERENCE_LEAP_YEAR = 2028;

function detailOptions(position: string): Record<string, string> | null {
  if (position === 'cook') return COOK_DETAIL_LABELS;
  if (position === 'housekeeping') return HOUSEKEEPING_DETAIL_LABELS;
  return null;
}

function positionLabel(person: Pick<BirthdayPerson, 'position' | 'position_detail'>): string {
  const base = POSITION_LABELS[person.position] || person.position;
  const details = detailOptions(person.position);
  const detailLabel = person.position_detail && details ? details[person.position_detail] : null;
  return detailLabel ? `${base} · ${detailLabel}` : base;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('');
}

function formatBirthday(month: number | null, day: number | null): string {
  if (!month || !day) return 'Не вказано';
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' })
    .format(new Date(Date.UTC(REFERENCE_LEAP_YEAR, month - 1, day, 12)));
}

function dayOrdinal(month: number, day: number): number {
  return Math.floor(
    (Date.UTC(REFERENCE_LEAP_YEAR, month - 1, day) - Date.UTC(REFERENCE_LEAP_YEAR, 0, 1)) / 86_400_000,
  );
}

function daysUntil(month: number, day: number, todayMonth: number, todayDay: number): number {
  const diff = dayOrdinal(month, day) - dayOrdinal(todayMonth, todayDay);
  return diff >= 0 ? diff : diff + 366;
}

function countdownLabel(days: number): string {
  if (days === 0) return 'Сьогодні 🎉';
  if (days === 1) return 'Завтра';
  if (days >= 2 && days <= 4) return `Через ${days} дні`;
  return `Через ${days} днів`;
}

function createEditor(person?: BirthdayPerson): BirthdayEditor {
  return {
    id: person?.id ?? null,
    fullName: person?.full_name || '',
    position: person?.position || 'waiter',
    positionDetail: person?.position_detail || '',
    position2: person?.position2 || '',
    position2Detail: person?.position2_detail || '',
    birthdayMonth: person?.birthday_month ? String(person.birthday_month) : '',
    birthdayDay: person?.birthday_day ? String(person.birthday_day) : '',
    avatar: person?.avatar || '',
  };
}

export function StaffBirthdaysTab() {
  const todayKey = useKyivDay();
  const [data, setData] = useState<BirthdaysBootstrapResponse | null>(null);
  const [people, setPeople] = useState<BirthdayPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [editor, setEditor] = useState<BirthdayEditor | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<BirthdaysBootstrapResponse>(
        { action: 'birthdays_bootstrap' },
        'tiflis-staff-api',
      );
      setData(response);
      setPeople(response.people);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити дні народження.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const todayMonth = useMemo(() => Number(todayKey.slice(5, 7)), [todayKey]);
  const todayDay = useMemo(() => Number(todayKey.slice(8, 10)), [todayKey]);

  const usedPositions = useMemo(() => {
    const set = new Set<string>();
    people.forEach((person) => {
      set.add(person.position);
      if (person.position2) set.add(person.position2);
    });
    return POSITION_ORDER.filter((key) => set.has(key));
  }, [people]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    return people.filter((person) => {
      if (positionFilter !== 'all' && person.position !== positionFilter && person.position2 !== positionFilter) {
        return false;
      }
      if (!query) return true;
      return [person.full_name, positionLabel(person)].join(' ').toLocaleLowerCase('uk-UA').includes(query);
    }).sort((left, right) => {
      const leftDays = left.birthday_month && left.birthday_day
        ? daysUntil(left.birthday_month, left.birthday_day, todayMonth, todayDay)
        : null;
      const rightDays = right.birthday_month && right.birthday_day
        ? daysUntil(right.birthday_month, right.birthday_day, todayMonth, todayDay)
        : null;
      if (leftDays === null && rightDays === null) return left.full_name.localeCompare(right.full_name, 'uk');
      if (leftDays === null) return 1;
      if (rightDays === null) return -1;
      return leftDays - rightDays || left.full_name.localeCompare(right.full_name, 'uk');
    });
  }, [people, positionFilter, search, todayDay, todayMonth]);

  async function savePerson() {
    if (!editor) return;
    if (!editor.fullName.trim()) {
      setError('Вкажіть імʼя працівника.');
      return;
    }
    if ((editor.birthdayMonth === '') !== (editor.birthdayDay === '')) {
      setError('Вкажіть і місяць, і день народження — або залиште обидва поля порожніми.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true; id: number }>({
        action: 'birthdays_save',
        id: editor.id,
        full_name: editor.fullName,
        position: editor.position,
        position_detail: editor.positionDetail || null,
        position2: editor.position2 || null,
        position2_detail: editor.position2 ? (editor.position2Detail || null) : null,
        birthday_month: editor.birthdayMonth ? Number(editor.birthdayMonth) : null,
        birthday_day: editor.birthdayDay ? Number(editor.birthdayDay) : null,
        avatar: editor.avatar,
      }, 'tiflis-staff-api');
      setEditor(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося зберегти запис.');
    } finally {
      setSaving(false);
    }
  }

  async function deletePerson() {
    if (!editor?.id) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({ action: 'birthdays_delete', id: editor.id }, 'tiflis-staff-api');
      setPeople((current) => current.filter((person) => person.id !== editor.id));
      setEditor(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося видалити запис.');
    } finally {
      setSaving(false);
    }
  }

  const canManage = data?.permissions.canManage ?? false;
  const editorDetailOptions = editor ? detailOptions(editor.position) : null;
  const editorDetail2Options = editor?.position2 ? detailOptions(editor.position2) : null;

  return (
    <div className="birthdays-tab-v1">
      <section className="birthdays-command-v1">
        <label className="birthdays-search-v1">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Імʼя або посада…" />
          {search ? <button type="button" onClick={() => setSearch('')} aria-label="Очистити пошук"><X size={15} /></button> : null}
        </label>
        <label className="birthdays-filter-v1">
          <span>Посада</span>
          <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
            <option value="all">Уся команда</option>
            {usedPositions.map((key) => <option value={key} key={key}>{POSITION_LABELS[key] || key}</option>)}
          </select>
        </label>
        {canManage ? (
          <button type="button" className="birthdays-add-v1" onClick={() => setEditor(createEditor())}>
            <Plus size={18} /> Додати людину
          </button>
        ) : null}
      </section>

      {error ? <div className="birthdays-alert-v1" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
      {loading ? <div className="birthdays-loading-v1"><RefreshCw size={24} className="is-spinning" /><span>Завантажуємо список…</span></div> : null}
      {!loading && filtered.length === 0 ? <div className="birthdays-empty-v1"><Cake size={30} /><strong>Нікого не знайдено</strong><span>Змініть пошук або посаду.</span></div> : null}

      {!loading ? (
        <section className="birthdays-grid-v1">
          {filtered.map((person) => {
            const days = person.birthday_month && person.birthday_day
              ? daysUntil(person.birthday_month, person.birthday_day, todayMonth, todayDay)
              : null;
            return (
              <article key={person.id} className={days !== null && days <= 6 ? 'is-soon' : ''}>
                <div className="birthdays-avatar-v1">
                  {person.avatar ? <img src={person.avatar} alt="" loading="lazy" /> : <span>{initials(person.full_name)}</span>}
                </div>
                <div className="birthdays-card-copy-v1">
                  <span>{positionLabel(person)}{person.position2 ? ` · ${positionLabel({ position: person.position2, position_detail: person.position2_detail })}` : ''}</span>
                  <h3>{person.full_name}</h3>
                  <div className="birthdays-card-footer-v1">
                    <b><Cake size={14} /> {formatBirthday(person.birthday_month, person.birthday_day)}</b>
                    {days !== null ? <em>{countdownLabel(days)}</em> : null}
                  </div>
                </div>
                {canManage ? (
                  <button type="button" className="birthdays-edit-v1" onClick={() => setEditor(createEditor(person))} aria-label={`Редагувати ${person.full_name}`}>
                    <Edit3 size={16} />
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {editor ? (
        <div className="birthdays-sheet-backdrop-v1" onMouseDown={() => !saving && setEditor(null)}>
          <section className="birthdays-editor-sheet-v1" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="birthdays-editor-heading-v1">
              <div><span className="eyebrow">{editor.id ? 'Редагування' : 'Новий запис'}</span><h3>{editor.fullName || 'Працівник'}</h3></div>
              <button type="button" onClick={() => setEditor(null)} disabled={saving}><X size={19} /></button>
            </div>

            <div className="birthdays-editor-grid-v1">
              <label className="is-wide"><span>Імʼя</span><input value={editor.fullName} maxLength={120} onChange={(event) => setEditor({ ...editor, fullName: event.target.value })} /></label>

              <label>
                <span>Посада</span>
                <select
                  value={editor.position}
                  onChange={(event) => setEditor({
                    ...editor,
                    position: event.target.value,
                    positionDetail: '',
                    position2: editor.position2 === event.target.value ? '' : editor.position2,
                  })}
                >
                  {POSITION_ORDER.map((key) => <option value={key} key={key}>{POSITION_LABELS[key]}</option>)}
                </select>
              </label>
              {editorDetailOptions ? (
                <label>
                  <span>Процес / напрям</span>
                  <select value={editor.positionDetail} onChange={(event) => setEditor({ ...editor, positionDetail: event.target.value })}>
                    <option value="">Не вказано</option>
                    {Object.entries(editorDetailOptions).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
                  </select>
                </label>
              ) : null}

              <label>
                <span>Друга посада</span>
                <select
                  value={editor.position2}
                  onChange={(event) => setEditor({ ...editor, position2: event.target.value, position2Detail: '' })}
                >
                  <option value="">Немає</option>
                  {POSITION_ORDER.filter((key) => key !== editor.position).map((key) => <option value={key} key={key}>{POSITION_LABELS[key]}</option>)}
                </select>
              </label>
              {editorDetail2Options ? (
                <label>
                  <span>Процес / напрям (друга посада)</span>
                  <select value={editor.position2Detail} onChange={(event) => setEditor({ ...editor, position2Detail: event.target.value })}>
                    <option value="">Не вказано</option>
                    {Object.entries(editorDetail2Options).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
                  </select>
                </label>
              ) : null}

              <label>
                <span>Місяць народження</span>
                <select value={editor.birthdayMonth} onChange={(event) => setEditor({ ...editor, birthdayMonth: event.target.value })}>
                  <option value="">Не вказано</option>
                  {MONTH_LABELS.map((label, index) => <option value={String(index + 1)} key={label}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>День народження</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editor.birthdayDay}
                  onChange={(event) => setEditor({ ...editor, birthdayDay: event.target.value })}
                />
              </label>

              <label className="is-wide"><span>Avatar, HTTPS URL</span><input type="url" value={editor.avatar} maxLength={1000} onChange={(event) => setEditor({ ...editor, avatar: event.target.value })} placeholder="https://…" /></label>
            </div>

            <div className="birthdays-editor-actions-v1">
              {editor.id ? <button type="button" className="is-delete" onClick={() => void deletePerson()} disabled={saving}><Trash2 size={17} /> Видалити</button> : <span />}
              <button type="button" className="is-save" onClick={() => void savePerson()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />} Зберегти</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
