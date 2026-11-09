import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { secureApi } from '../lib/secureApi';
import './menu-v3.css';

/* ---------- data ---------- */

interface MenuItem {
  id: number;
  section: string;
  category: string;
  name: string;
  price: number | string | null;
  weight: string | null;
  description: string | null;
  photo: string | null;
  allergens: string[] | null;
  cook_time_normal: number | null;
  cook_time_busy: number | null;
  emoji: string | null;
  stopped: boolean;
  sort_order: number;
  updated_at: string | null;
  explain: string | null;
  sell_line: string | null;
  pairing: string | null;
  learning_reviewed: boolean;
}

type Status = 'learning' | 'known';

interface MenuBootstrapResponse {
  ok: true;
  permissions: { canToggleStop: boolean; canEdit: boolean };
  items: MenuItem[];
  progress?: { item_id: number; status: Status }[];
}

type Mode = 'guide' | 'train' | 'plan';

interface Lesson {
  key: string;
  title: string;
  items: MenuItem[];
}

interface Deck {
  title: string;
  items: MenuItem[];
  index: number;
  revealed: boolean;
  known: number;
  learning: number;
}

const SECTION_META: Record<string, { label: string; order: number }> = {
  main: { label: 'Кухня', order: 1 },
  season: { label: 'Сезонне', order: 2 },
  bar: { label: 'Бар', order: 3 },
  wine: { label: 'Вино', order: 4 },
  lunch: { label: 'Обіди', order: 5 },
  banquet: { label: 'Банкет', order: 6 },
  lean: { label: 'Пісне', order: 7 },
};

const MAIN_CATEGORY_ORDER = [
  'Холодні закуски', 'Салати', 'Перші страви', 'Мангал', 'Основні страви',
  'Хінкалі', 'Хлібобулочні', 'Гарніри', 'Десерти', 'До пива',
];
const LUNCH_CATEGORY_ORDER = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пятниця'];

const ALLERGENS = [
  'Глютен', 'Молоко', 'Яйця', 'Горіхи', 'Риба', 'Морепродукти', 'Соя',
  'Селера', 'Гірчиця', 'Кунжут', 'Лупин', 'Молюски', 'Діоксид сірки',
];

/** Sections with a teaching plan: dishes a waiter describes to a guest. Bar and wine stay a reference. */
const LEARNABLE = new Set(['main', 'season']);

const sectionLabel = (section: string) => SECTION_META[section]?.label || section;
const sectionOrder = (section: string) => SECTION_META[section]?.order ?? 99;
const categoryLabel = (category: string) => (category === 'Хлібобулочні' ? 'Хачапурі і випічка' : category);

function categoryOrder(section: string, category: string): number {
  const list = section === 'main' ? MAIN_CATEGORY_ORDER : section === 'lunch' ? LUNCH_CATEGORY_ORDER : [];
  const index = list.indexOf(category);
  return index >= 0 ? index : 99;
}

function byMenuOrder(left: MenuItem, right: MenuItem): number {
  return sectionOrder(left.section) - sectionOrder(right.section)
    || categoryOrder(left.section, left.category) - categoryOrder(right.section, right.category)
    || categoryLabel(left.category).localeCompare(categoryLabel(right.category), 'uk')
    || left.sort_order - right.sort_order
    || left.name.localeCompare(right.name, 'uk');
}

function money(value: number | string | null): string | null {
  if (value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(amount)} ₴`;
}

function weightLabel(weight: string | null): string | null {
  if (!weight) return null;
  return /^\d+(?:[.,]\d+)?$/.test(weight.trim()) ? `${weight.trim()} г` : weight;
}

function initials(name: string): string {
  return name.replace(/[«»"'’ʼ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const held = copy[index] as T;
    copy[index] = copy[swap] as T;
    copy[swap] = held;
  }
  return copy;
}

const hasTeaching = (item: MenuItem) => Boolean(item.explain || item.sell_line || item.pairing || (item.allergens || []).length);

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
const dishWord = (count: number) => plural(count, 'страва', 'страви', 'страв');

/* ---------- photo upload (resize on device, then menu_upload_photo) ---------- */

const PHOTO_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const PHOTO_MAX_DIMENSION = 1600;
const PHOTO_JPEG_QUALITY = 0.82;

async function resizePhotoFile(file: File): Promise<{ dataUrl: string; contentType: string }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не може обробити фото.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY), contentType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}

/* ---------- page ---------- */

export function MenuPage() {
  const [data, setData] = useState<MenuBootstrapResponse | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [progress, setProgress] = useState<Map<number, Status>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('guide');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<MenuBootstrapResponse>({ action: 'menu_bootstrap' }, 'tiflis-menu-api');
      setData(response);
      setItems([...response.items].sort(byMenuOrder));
      setProgress(new Map((response.progress || []).map((row) => [row.item_id, row.status])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити меню.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const canEdit = Boolean(data?.permissions.canEdit);

  const lessons = useMemo<Lesson[]>(() => {
    const groups = new Map<string, Lesson>();
    items.filter((item) => LEARNABLE.has(item.section)).forEach((item) => {
      const key = item.section === 'season' ? 'season' : `main:${item.category}`;
      const title = item.section === 'season' ? 'Сезонне меню' : categoryLabel(item.category);
      const lesson = groups.get(key) || { key, title, items: [] };
      lesson.items.push(item);
      groups.set(key, lesson);
    });
    return [...groups.values()];
  }, [items]);

  async function saveStatus(item: MenuItem, status: Status | null) {
    const previous = progress.get(item.id) ?? null;
    setProgress((current) => {
      const next = new Map(current);
      if (status) next.set(item.id, status); else next.delete(item.id);
      return next;
    });
    try {
      await secureApi({ action: 'menu_progress_set', id: item.id, status }, 'tiflis-menu-api');
    } catch {
      setProgress((current) => {
        const next = new Map(current);
        if (previous) next.set(item.id, previous); else next.delete(item.id);
        return next;
      });
      setError('Прогрес не збережено. Перевірте звʼязок і спробуйте ще раз.');
    }
  }

  function startDeck(title: string, pool: MenuItem[]) {
    // Not-yet-known dishes first (still learning, then never seen), known ones at the end for revision.
    const rank = (item: MenuItem) => (progress.get(item.id) === 'learning' ? 0 : progress.get(item.id) === 'known' ? 2 : 1);
    const ordered = [0, 1, 2].flatMap((value) => shuffled(pool.filter((item) => rank(item) === value)));
    setDeck({ title, items: ordered, index: 0, revealed: false, known: 0, learning: 0 });
    setMode('train');
  }

  function answer(status: Status) {
    if (!deck) return;
    const item = deck.items[deck.index];
    if (item) void saveStatus(item, status);
    setDeck({
      ...deck,
      index: deck.index + 1,
      revealed: false,
      known: deck.known + (status === 'known' ? 1 : 0),
      learning: deck.learning + (status === 'learning' ? 1 : 0),
    });
  }

  function onSaved(saved: MenuItem | null, removedId?: number) {
    setEditor(null);
    setSelected(null);
    if (removedId) setItems((current) => current.filter((item) => item.id !== removedId));
    if (saved) {
      setItems((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return (exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]).sort(byMenuOrder);
      });
    }
  }

  return (
    <div className="mv3">
      <div className="mv3-top">
        <div className="mv3-seg" role="tablist" aria-label="Режим меню">
          {([['guide', 'Довідник'], ['train', 'Тренажер'], ['plan', 'План']] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? 'is-on' : ''} onClick={() => setMode(key)}>{label}</button>
          ))}
        </div>
        {canEdit ? <button type="button" className="mv3-add" onClick={() => setEditor(createEditor())}><Plus size={17} aria-hidden="true" /> Позиція</button> : null}
      </div>

      {error ? (
        <div className="mv3-alert" role="alert">
          <span>{error}</span>
          {!data ? <button type="button" onClick={() => void load()}>Спробувати ще раз</button> : <button type="button" aria-label="Закрити" onClick={() => setError(null)}><X size={16} /></button>}
        </div>
      ) : null}

      {loading ? <div className="mv3-loading" aria-label="Завантажуємо меню"><span /><span /><span /></div> : null}

      {!loading && data ? (
        mode === 'guide' ? (
          <Guide items={items} progress={progress} canEdit={canEdit} onOpen={setSelected} />
        ) : mode === 'train' ? (
          <Trainer deck={deck} lessons={lessons} progress={progress} onStart={startDeck} onReveal={() => deck && setDeck({ ...deck, revealed: true })} onAnswer={answer} onExit={() => setDeck(null)} />
        ) : (
          <Plan lessons={lessons} progress={progress} onStart={startDeck} />
        )
      ) : null}

      {selected ? (
        <DishSheet
          item={selected}
          status={progress.get(selected.id) ?? null}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onStatus={(status) => void saveStatus(selected, status)}
          onEdit={() => { setEditor(createEditor(selected)); setSelected(null); }}
        />
      ) : null}

      {editor ? <Editor initial={editor} items={items} onClose={() => setEditor(null)} onSaved={onSaved} /> : null}
    </div>
  );
}

/* ---------- Довідник ---------- */

function Guide({ items, progress, canEdit, onOpen }: { items: MenuItem[]; progress: Map<number, Status>; canEdit: boolean; onOpen: (item: MenuItem) => void }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('main');
  const [category, setCategory] = useState('all');
  const [draftsOnly, setDraftsOnly] = useState(false);

  const sections = useMemo(() => [...new Set(items.map((item) => item.section))].sort((a, b) => sectionOrder(a) - sectionOrder(b)), [items]);
  const categories = useMemo(() => [...new Set(items.filter((item) => item.section === section).map((item) => item.category))]
    .sort((a, b) => categoryOrder(section, a) - categoryOrder(section, b) || categoryLabel(a).localeCompare(categoryLabel(b), 'uk')), [items, section]);
  const draftCount = useMemo(() => items.filter((item) => !item.learning_reviewed && hasTeaching(item)).length, [items]);

  const needle = query.trim().toLocaleLowerCase('uk-UA');
  const visible = items.filter((item) => {
    if (draftsOnly) return !item.learning_reviewed && hasTeaching(item);
    if (needle) {
      return [item.name, item.description, item.explain, item.category, ...(item.allergens || [])]
        .join(' ').toLocaleLowerCase('uk-UA').includes(needle);
    }
    return item.section === section && (category === 'all' || item.category === category);
  });

  const groups: { key: string; title: string; items: MenuItem[] }[] = [];
  visible.forEach((item) => {
    const key = `${item.section}:${item.category}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, title: needle || draftsOnly ? `${sectionLabel(item.section)} · ${categoryLabel(item.category)}` : categoryLabel(item.category), items: [item] });
  });

  return (
    <section className="mv3-guide" aria-label="Довідник меню">
      <label className="mv3-search">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Страва, складник або алерген" aria-label="Пошук по меню" />
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="Очистити пошук"><X size={16} /></button> : null}
      </label>

      {!needle && !draftsOnly ? (
        <>
          <div className="mv3-chips" role="tablist" aria-label="Розділ">
            {sections.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={section === key} className={section === key ? 'is-on' : ''} onClick={() => { setSection(key); setCategory('all'); }}>{sectionLabel(key)}</button>
            ))}
          </div>
          {categories.length > 1 ? (
            <div className="mv3-chips is-quiet" aria-label="Категорія">
              <button type="button" className={category === 'all' ? 'is-on' : ''} onClick={() => setCategory('all')}>Усі</button>
              {categories.map((key) => (
                <button key={key} type="button" className={category === key ? 'is-on' : ''} onClick={() => setCategory(key)}>{categoryLabel(key)}</button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {canEdit && draftCount ? (
        <button type="button" className={`mv3-drafts${draftsOnly ? ' is-on' : ''}`} onClick={() => setDraftsOnly((value) => !value)}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{draftsOnly ? 'Показати все меню' : `Чернетки на перевірку: ${draftCount}`}</span>
          {draftsOnly ? <X size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
      ) : null}

      {groups.length === 0 ? (
        <p className="mv3-empty">{needle ? `Нічого не знайдено за «${query.trim()}».` : 'У цьому розділі поки немає позицій.'}</p>
      ) : groups.map((group) => (
        <div key={group.key} className="mv3-group">
          <h2>{group.title}<span>{group.items.length}</span></h2>
          <ul>
            {group.items.map((item) => <li key={item.id}><DishRow item={item} status={progress.get(item.id) ?? null} onOpen={onOpen} /></li>)}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Thumb({ item, size }: { item: MenuItem; size: 'row' | 'card' | 'sheet' }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`mv3-thumb is-${size}${item.photo && !broken ? '' : ' is-empty'}`} aria-hidden="true">
      {item.photo && !broken ? <img src={item.photo} alt="" loading="lazy" onError={() => setBroken(true)} /> : <b>{initials(item.name)}</b>}
    </span>
  );
}

function DishRow({ item, status, onOpen }: { item: MenuItem; status: Status | null; onOpen: (item: MenuItem) => void }) {
  const price = money(item.price);
  const weight = weightLabel(item.weight);
  return (
    <button type="button" className="mv3-row" onClick={() => onOpen(item)}>
      <Thumb item={item} size="row" />
      <span className="mv3-row-copy">
        <strong>{item.name}{status === 'known' ? <Check size={14} className="mv3-known" aria-label="Знаю" /> : null}</strong>
        {item.description ? <small>{item.description}</small> : null}
      </span>
      {price || weight ? (
        <span className="mv3-row-meta">
          {price ? <b>{price}</b> : null}
          {weight ? <small>{weight}</small> : null}
        </span>
      ) : null}
    </button>
  );
}

/* ---------- Картка страви ---------- */

function DishSheet({ item, status, canEdit, onClose, onStatus, onEdit }: {
  item: MenuItem; status: Status | null; canEdit: boolean; onClose: () => void; onStatus: (status: Status | null) => void; onEdit: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { closeRef.current?.setAttribute('autofocus', ''); }, []);
  const price = money(item.price);
  const weight = weightLabel(item.weight);

  return (
    <div className="mv3-backdrop" onMouseDown={onClose}>
      <section className="mv3-sheet" role="dialog" aria-modal="true" aria-labelledby={`mv3-dish-${item.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="mv3-sheet-media">
          <Thumb item={item} size="sheet" />
          <button ref={closeRef} type="button" className="mv3-close" onClick={onClose} aria-label="Закрити"><X size={20} /></button>
        </div>
        <div className="mv3-sheet-body">
          <p className="mv3-kicker">{sectionLabel(item.section)} · {categoryLabel(item.category)}</p>
          <h2 id={`mv3-dish-${item.id}`}>{item.name}</h2>
          {price || weight || item.cook_time_normal !== null ? (
            <p className="mv3-facts">
              {price ? <b>{price}</b> : null}
              {weight ? <span>{weight}</span> : null}
              {item.cook_time_normal !== null ? <span><Clock3 size={14} aria-hidden="true" /> {item.cook_time_normal} хв{item.cook_time_busy !== null ? ` · у завал ${item.cook_time_busy} хв` : ''}</span> : null}
            </p>
          ) : null}

          {!item.learning_reviewed && hasTeaching(item) ? (
            <p className="mv3-draft-note"><AlertTriangle size={15} aria-hidden="true" /> Чернетка: поради й алергени ще не перевірила кухня.</p>
          ) : null}

          {item.explain ? <Block title="Що це">{item.explain}</Block> : null}
          {item.description ? <Block title="Склад і подача">{item.description}</Block> : null}
          {item.sell_line ? <Block title="Як запропонувати гостю" tone="say">«{item.sell_line}»</Block> : null}
          {item.pairing ? <Block title="До чого порадити">{item.pairing}</Block> : null}
          {(item.allergens || []).length ? (
            <Block title="Алергени">
              <span className="mv3-allergens">{(item.allergens || []).map((allergen) => <span key={allergen}>{allergen}</span>)}</span>
            </Block>
          ) : null}

          <div className="mv3-sheet-actions">
            <button type="button" className={status === 'known' ? 'is-known' : ''} aria-pressed={status === 'known'} onClick={() => onStatus(status === 'known' ? 'learning' : 'known')}>
              {status === 'known' ? <><Check size={17} aria-hidden="true" /> Знаю</> : <><BookOpen size={17} aria-hidden="true" /> Позначити: знаю</>}
            </button>
            {canEdit ? <button type="button" className="is-quiet" onClick={onEdit}><Edit3 size={17} aria-hidden="true" /> Редагувати</button> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Block({ title, tone, children }: { title: string; tone?: 'say'; children: ReactNode }) {
  return (
    <div className={`mv3-block${tone ? ` is-${tone}` : ''}`}>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

/* ---------- Тренажер ---------- */

function Trainer({ deck, lessons, progress, onStart, onReveal, onAnswer, onExit }: {
  deck: Deck | null; lessons: Lesson[]; progress: Map<number, Status>;
  onStart: (title: string, pool: MenuItem[]) => void; onReveal: () => void; onAnswer: (status: Status) => void; onExit: () => void;
}) {
  if (!deck) {
    const all = lessons.flatMap((lesson) => lesson.items);
    const unknown = all.filter((item) => progress.get(item.id) !== 'known');
    return (
      <section className="mv3-train-pick" aria-label="Тренажер">
        <p className="mv3-lead">Картка показує страву. Згадай склад, як її запропонувати і до чого порадити, потім переверни й перевір себе.</p>
        <button type="button" className="mv3-primary" disabled={!unknown.length} onClick={() => onStart('Усе, що ще не знаю', unknown)}>
          {unknown.length ? `Тренувати невивчені · ${unknown.length}` : 'Усі страви кухні вивчено'}
        </button>
        <h2 className="mv3-subhead">Або обери тему</h2>
        <ul className="mv3-topics">
          {lessons.map((lesson) => {
            const known = lesson.items.filter((item) => progress.get(item.id) === 'known').length;
            return (
              <li key={lesson.key}>
                <button type="button" onClick={() => onStart(lesson.title, lesson.items)}>
                  <span>{lesson.title}</span>
                  <small>{known} / {lesson.items.length}</small>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const item = deck.items[deck.index];
  if (!item) {
    return (
      <section className="mv3-done" aria-live="polite">
        <h2>{deck.title}: готово</h2>
        <p><b>{deck.known}</b> знаю · <b>{deck.learning}</b> ще вчу</p>
        <div className="mv3-done-actions">
          {deck.learning ? <button type="button" className="mv3-primary" onClick={() => onStart(`${deck.title}: повтор`, deck.items.filter((entry) => progress.get(entry.id) === 'learning'))}><RotateCcw size={16} aria-hidden="true" /> Повторити ті, що вчу</button> : null}
          <button type="button" className="mv3-secondary" onClick={onExit}>Інша тема</button>
        </div>
      </section>
    );
  }

  return (
    <section className="mv3-trainer" aria-label={`Тренажер: ${deck.title}`}>
      <div className="mv3-trainer-head">
        <button type="button" className="mv3-link" onClick={onExit}><X size={16} aria-hidden="true" /> {deck.title}</button>
        <span>{deck.index + 1} з {deck.items.length}</span>
      </div>
      <div className="mv3-progress" aria-hidden="true"><span style={{ width: `${(deck.index / deck.items.length) * 100}%` }} /></div>

      <article className="mv3-card">
        <Thumb item={item} size="card" />
        <div className="mv3-card-body">
          <p className="mv3-kicker">{categoryLabel(item.category)}</p>
          <h2>{item.name}</h2>
          {!deck.revealed ? (
            <>
              <p className="mv3-prompt">Що входить? Як запропонуєш гостю? Які алергени?</p>
              <button type="button" className="mv3-primary" onClick={onReveal}>Перевірити себе</button>
            </>
          ) : (
            <div className="mv3-answer" aria-live="polite">
              {item.explain ? <Block title="Що це">{item.explain}</Block> : null}
              {item.description ? <Block title="Склад і подача">{item.description}</Block> : null}
              {item.sell_line ? <Block title="Як запропонувати" tone="say">«{item.sell_line}»</Block> : null}
              {item.pairing ? <Block title="До чого порадити">{item.pairing}</Block> : null}
              {(item.allergens || []).length ? <Block title="Алергени"><span className="mv3-allergens">{(item.allergens || []).map((allergen) => <span key={allergen}>{allergen}</span>)}</span></Block> : null}
              <div className="mv3-answer-actions">
                <button type="button" className="mv3-secondary" onClick={() => onAnswer('learning')}>Ще вчу</button>
                <button type="button" className="mv3-primary" onClick={() => onAnswer('known')}><Check size={17} aria-hidden="true" /> Знаю</button>
              </div>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

/* ---------- План ---------- */

function Plan({ lessons, progress, onStart }: { lessons: Lesson[]; progress: Map<number, Status>; onStart: (title: string, pool: MenuItem[]) => void }) {
  const total = lessons.reduce((sum, lesson) => sum + lesson.items.length, 0);
  const known = lessons.reduce((sum, lesson) => sum + lesson.items.filter((item) => progress.get(item.id) === 'known').length, 0);
  const nextLesson = lessons.find((lesson) => lesson.items.some((item) => progress.get(item.id) !== 'known'));

  return (
    <section className="mv3-plan" aria-label="План вивчення">
      <div className="mv3-plan-hero">
        <p className="mv3-kicker">Кухня і сезонне меню</p>
        <p className="mv3-plan-figure"><b>{known}</b> з {total} {dishWord(total)}</p>
        <div className="mv3-progress is-big" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={known} aria-label="Вивчено страв"><span style={{ width: `${total ? (known / total) * 100 : 0}%` }} /></div>
        {nextLesson ? (
          <button type="button" className="mv3-primary" onClick={() => onStart(nextLesson.title, nextLesson.items)}>Продовжити: {nextLesson.title}</button>
        ) : <p className="mv3-lead">Усе меню кухні вивчено. Повторюй у тренажері, коли зʼявляться нові страви.</p>}
      </div>

      <ol className="mv3-lessons">
        {lessons.map((lesson, index) => {
          const done = lesson.items.filter((item) => progress.get(item.id) === 'known').length;
          const complete = done === lesson.items.length;
          return (
            <li key={lesson.key} className={complete ? 'is-complete' : ''}>
              <button type="button" onClick={() => onStart(lesson.title, lesson.items)}>
                <span className="mv3-lesson-no" aria-hidden="true">{complete ? <Check size={15} /> : index + 1}</span>
                <span className="mv3-lesson-copy">
                  <strong>{lesson.title}</strong>
                  <small>{done} з {lesson.items.length} знаю</small>
                  <span className="mv3-progress" aria-hidden="true"><span style={{ width: `${(done / lesson.items.length) * 100}%` }} /></span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- Редактор (кухня / адмін) ---------- */

interface EditorState {
  id: number | null;
  section: string;
  category: string;
  name: string;
  price: string;
  weight: string;
  description: string;
  photo: string;
  allergens: string[];
  cookTimeNormal: string;
  cookTimeBusy: string;
  emoji: string;
  stopped: boolean;
  sortOrder: number;
  explain: string;
  sellLine: string;
  pairing: string;
  reviewed: boolean;
}

function createEditor(item?: MenuItem): EditorState {
  const text = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value));
  return {
    id: item?.id ?? null,
    section: item?.section || 'main',
    category: item?.category || '',
    name: item?.name || '',
    price: text(item?.price),
    weight: item?.weight || '',
    description: item?.description || '',
    photo: item?.photo || '',
    allergens: item?.allergens || [],
    cookTimeNormal: text(item?.cook_time_normal),
    cookTimeBusy: text(item?.cook_time_busy),
    emoji: item?.emoji || '',
    stopped: item?.stopped || false,
    sortOrder: item?.sort_order || 0,
    explain: item?.explain || '',
    sellLine: item?.sell_line || '',
    pairing: item?.pairing || '',
    reviewed: item?.learning_reviewed || false,
  };
}

function Editor({ initial, items, onClose, onSaved }: { initial: EditorState; items: MenuItem[]; onClose: () => void; onSaved: (item: MenuItem | null, removedId?: number) => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState<'save' | 'delete' | 'photo' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { nameRef.current?.setAttribute('autofocus', ''); }, []);

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const categories = [...new Set(items.filter((item) => item.section === form.section).map((item) => item.category))];
  const sections = [...new Set([...Object.keys(SECTION_META), ...items.map((item) => item.section)])];

  async function uploadPhoto(file: File) {
    if (!file.type.startsWith('image/')) { setProblem('Оберіть файл зображення.'); return; }
    if (file.size > PHOTO_MAX_SOURCE_BYTES) { setProblem('Файл завеликий (максимум 15 МБ).'); return; }
    setBusy('photo');
    setProblem(null);
    try {
      const { dataUrl, contentType } = await resizePhotoFile(file);
      const response = await secureApi<{ ok: true; photo: string }>({ action: 'menu_upload_photo', data: dataUrl, content_type: contentType }, 'tiflis-menu-api');
      set('photo', response.photo);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'Не вдалося завантажити фото.');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!form.name.trim() || !form.category.trim()) { setProblem('Вкажіть назву і категорію.'); return; }
    setBusy('save');
    setProblem(null);
    try {
      const response = await secureApi<{ ok: true; item: MenuItem }>({
        action: 'menu_save_item',
        id: form.id,
        section: form.section,
        category: form.category,
        name: form.name,
        price: form.price,
        weight: form.weight,
        description: form.description,
        photo: form.photo,
        allergens: form.allergens,
        cook_time_normal: form.cookTimeNormal,
        cook_time_busy: form.cookTimeBusy,
        emoji: form.emoji,
        stopped: form.stopped,
        sort_order: form.sortOrder,
        explain: form.explain,
        sell_line: form.sellLine,
        pairing: form.pairing,
        learning_reviewed: form.reviewed,
      }, 'tiflis-menu-api');
      onSaved(response.item);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'Позицію не збережено.');
      setBusy(null);
    }
  }

  async function remove() {
    if (!form.id) return;
    setBusy('delete');
    setProblem(null);
    try {
      await secureApi({ action: 'menu_delete_item', id: form.id }, 'tiflis-menu-api');
      onSaved(null, form.id);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'Позицію не видалено.');
      setBusy(null);
    }
  }

  return (
    <div className="mv3-backdrop" onMouseDown={() => !busy && onClose()}>
      <section className="mv3-sheet mv3-editor" role="dialog" aria-modal="true" aria-labelledby="mv3-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mv3-editor-head">
          <h2 id="mv3-editor-title">{form.id ? 'Редагувати позицію' : 'Нова позиція'}</h2>
          <button type="button" className="mv3-close is-flat" onClick={onClose} disabled={Boolean(busy)} aria-label="Закрити"><X size={20} /></button>
        </div>

        <div className="mv3-form">
          <label className="is-wide"><span>Назва</span><input ref={nameRef} value={form.name} onChange={(event) => set('name', event.target.value)} maxLength={180} /></label>
          <label><span>Розділ</span><select value={form.section} onChange={(event) => set('section', event.target.value)}>{sections.map((key) => <option key={key} value={key}>{sectionLabel(key)}</option>)}</select></label>
          <label><span>Категорія</span><input value={form.category} onChange={(event) => set('category', event.target.value)} list="mv3-categories" maxLength={120} /><datalist id="mv3-categories">{categories.map((key) => <option key={key} value={key} />)}</datalist></label>
          <label><span>Ціна, ₴</span><input inputMode="decimal" value={form.price} onChange={(event) => set('price', event.target.value)} /></label>
          <label><span>Вага / обʼєм</span><input value={form.weight} onChange={(event) => set('weight', event.target.value)} maxLength={100} placeholder="250 г" /></label>
          <label><span>Час кухні, хв</span><input inputMode="numeric" value={form.cookTimeNormal} onChange={(event) => set('cookTimeNormal', event.target.value)} /></label>
          <label><span>У завал, хв</span><input inputMode="numeric" value={form.cookTimeBusy} onChange={(event) => set('cookTimeBusy', event.target.value)} /></label>

          <div className="is-wide mv3-photo-field">
            <span>Фото</span>
            <div>
              {form.photo ? <img src={form.photo} alt="" /> : <span className="mv3-photo-empty"><ImageIcon size={20} aria-hidden="true" /></span>}
              <label className="mv3-secondary">
                {busy === 'photo' ? <RefreshCw size={15} className="mv3-spin" aria-hidden="true" /> : null}
                {busy === 'photo' ? 'Завантаження…' : form.photo ? 'Змінити фото' : 'Завантажити фото'}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadPhoto(file); }} />
              </label>
              {form.photo ? <button type="button" className="mv3-link" onClick={() => set('photo', '')} disabled={Boolean(busy)}>Прибрати</button> : null}
            </div>
          </div>

          <label className="is-wide"><span>Склад і подача</span><textarea value={form.description} onChange={(event) => set('description', event.target.value)} maxLength={3000} rows={3} /></label>
          <label className="is-wide"><span>Що це / як вимовляти</span><textarea value={form.explain} onChange={(event) => set('explain', event.target.value)} maxLength={600} rows={2} /></label>
          <label className="is-wide"><span>Як запропонувати гостю</span><textarea value={form.sellLine} onChange={(event) => set('sellLine', event.target.value)} maxLength={600} rows={2} /></label>
          <label className="is-wide"><span>До чого порадити</span><input value={form.pairing} onChange={(event) => set('pairing', event.target.value)} maxLength={600} /></label>

          <fieldset className="is-wide mv3-allergen-pick">
            <legend>Алергени</legend>
            <div>
              {ALLERGENS.map((allergen) => {
                const on = form.allergens.includes(allergen);
                return (
                  <button key={allergen} type="button" role="checkbox" aria-checked={on} className={on ? 'is-on' : ''} onClick={() => set('allergens', on ? form.allergens.filter((value) => value !== allergen) : [...form.allergens, allergen])}>
                    {on ? <Check size={13} aria-hidden="true" /> : null}{allergen}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="is-wide mv3-check">
            <input type="checkbox" checked={form.reviewed} onChange={(event) => set('reviewed', event.target.checked)} />
            <span><b>Перевірено кухнею</b><small>Поради й алергени правильні — прибрати позначку «чернетка».</small></span>
          </label>
        </div>

        {problem ? <p className="mv3-form-error" role="alert">{problem}</p> : null}

        <div className="mv3-editor-actions">
          {form.id ? (
            confirmDelete ? (
              <button type="button" className="mv3-danger" onClick={() => void remove()} disabled={Boolean(busy)}>{busy === 'delete' ? <RefreshCw size={16} className="mv3-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />} Так, видалити</button>
            ) : (
              <button type="button" className="mv3-link is-danger" onClick={() => setConfirmDelete(true)} disabled={Boolean(busy)}>Видалити</button>
            )
          ) : <span />}
          <button type="button" className="mv3-primary" onClick={() => void save()} disabled={Boolean(busy)}>
            {busy === 'save' ? <RefreshCw size={16} className="mv3-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Зберегти
          </button>
        </div>
      </section>
    </div>
  );
}
