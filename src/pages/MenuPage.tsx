import {
  AlertTriangle,
  Check,
  Clock3,
  Edit3,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '../lib/secureApi';
import './menu.css';
import './menu-gallery.css';

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
}

interface MenuBootstrapResponse {
  ok: true;
  permissions: { canToggleStop: boolean; canEdit: boolean };
  items: MenuItem[];
}

interface MenuMutationResponse {
  ok: true;
  item?: MenuItem;
}

interface MenuEditorState {
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
}

interface VisibleCategory {
  key: string;
  section: string;
  category: string;
  items: MenuItem[];
}

const SECTION_META: Record<string, { label: string; icon: string; order: number }> = {
  main: { label: 'Основне меню', icon: '🍽️', order: 1 },
  bar: { label: 'Бар', icon: '🍸', order: 2 },
  wine: { label: 'Винна карта', icon: '🍷', order: 3 },
  lunch: { label: 'Комплексні обіди', icon: '🥗', order: 4 },
  season: { label: 'Сезонне', icon: '🌿', order: 5 },
  banquet: { label: 'Банкетне', icon: '🎉', order: 6 },
  lean: { label: 'Пісне', icon: '🕊️', order: 7 },
};

const MAIN_CATEGORY_ORDER = [
  'Холодні закуски',
  'Салати',
  'Перші страви',
  'Мангал',
  'Основні страви',
  'Хінкалі',
  'Гарніри',
  'Хлібобулочні',
  'Десерти',
  'До пива',
] as const;

const LUNCH_CATEGORY_ORDER = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пятниця'] as const;

const ALLERGENS = [
  'Глютен', 'Молоко', 'Яйця', 'Горіхи', 'Риба', 'Морепродукти', 'Соя',
  'Селера', 'Гірчиця', 'Кунжут', 'Лупин', 'Молюски', 'Діоксид сірки',
];

function sectionLabel(section: string): string {
  return SECTION_META[section]?.label || section;
}

function categoryLabel(category: string): string {
  return category === 'Хлібобулочні' ? 'Хачапурі' : category;
}

function sectionIcon(section: string): string {
  return SECTION_META[section]?.icon || '𐃯';
}

function sectionOrder(section: string): number {
  return SECTION_META[section]?.order ?? 999;
}

function categoryOrder(section: string, category: string): number {
  if (section === 'main') {
    const index = MAIN_CATEGORY_ORDER.indexOf(category as (typeof MAIN_CATEGORY_ORDER)[number]);
    return index >= 0 ? index : 999;
  }
  if (section === 'lunch') {
    const index = LUNCH_CATEGORY_ORDER.indexOf(category as (typeof LUNCH_CATEGORY_ORDER)[number]);
    return index >= 0 ? index : 999;
  }
  return 999;
}

function compareCategories(section: string, left: string, right: string): number {
  return categoryOrder(section, left) - categoryOrder(section, right)
    || categoryLabel(left).localeCompare(categoryLabel(right), 'uk');
}

function money(value: number | string | null): string {
  if (value === null || value === '') return 'Ціну не вказано';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Ціну не вказано';
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency', currency: 'UAH', maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA');
}

function itemSearchText(item: MenuItem): string {
  return [
    item.name,
    item.category,
    categoryLabel(item.category),
    sectionLabel(item.section),
    item.description || '',
    item.weight || '',
    ...(item.allergens || []),
  ].join(' ').toLocaleLowerCase('uk-UA');
}

function createEditor(item?: MenuItem): MenuEditorState {
  return {
    id: item?.id ?? null,
    section: item?.section || 'main',
    category: item?.category || '',
    name: item?.name || '',
    price: item?.price === null || item?.price === undefined ? '' : String(item.price),
    weight: item?.weight || '',
    description: item?.description || '',
    photo: item?.photo || '',
    allergens: item?.allergens || [],
    cookTimeNormal: item?.cook_time_normal === null || item?.cook_time_normal === undefined ? '' : String(item.cook_time_normal),
    cookTimeBusy: item?.cook_time_busy === null || item?.cook_time_busy === undefined ? '' : String(item.cook_time_busy),
    emoji: item?.emoji || '',
    stopped: item?.stopped || false,
    sortOrder: item?.sort_order || 0,
  };
}

export function MenuPage() {
  const [data, setData] = useState<MenuBootstrapResponse | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('main');
  const [activeCategory, setActiveCategory] = useState('all');
  const [busyMode, setBusyMode] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [editor, setEditor] = useState<MenuEditorState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<MenuBootstrapResponse>({ action: 'menu_bootstrap' }, 'tiflis-menu-api');
      setData(response);
      setItems(response.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити меню.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected && !editor) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (editor) {
        if (!saving) setEditor(null);
      } else {
        setSelected(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [editor, saving, selected]);

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.section, (counts.get(item.section) || 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => (
      sectionOrder(left) - sectionOrder(right)
      || sectionLabel(left).localeCompare(sectionLabel(right), 'uk')
    ));
  }, [items]);

  const categories = useMemo(() => {
    const scoped = activeSection === 'all' ? items : items.filter((item) => item.section === activeSection);
    const counts = new Map<string, number>();
    scoped.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => {
      if (activeSection !== 'all') return compareCategories(activeSection, left, right);
      return categoryLabel(left).localeCompare(categoryLabel(right), 'uk');
    });
  }, [activeSection, items]);

  useEffect(() => {
    if (activeCategory !== 'all' && !categories.some(([category]) => category === activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, categories]);

  const filtered = useMemo(() => {
    const query = normalizeSearch(search);
    return items.filter((item) => {
      if (activeSection !== 'all' && item.section !== activeSection) return false;
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      return !query || itemSearchText(item).includes(query);
    });
  }, [activeCategory, activeSection, items, search]);

  const metrics = useMemo(() => ({
    photographed: items.filter((item) => item.photo).length,
    timed: items.filter((item) => item.cook_time_normal !== null).length,
  }), [items]);

  const visibleCategories = useMemo<VisibleCategory[]>(() => {
    const groups = new Map<string, VisibleCategory>();
    filtered.forEach((item) => {
      const key = `${item.section}::${item.category}`;
      const current = groups.get(key) || { key, section: item.section, category: item.category, items: [] };
      current.items.push(item);
      groups.set(key, current);
    });
    return [...groups.values()]
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => (
          left.sort_order - right.sort_order || left.name.localeCompare(right.name, 'uk')
        )),
      }))
      .sort((left, right) => (
        sectionOrder(left.section) - sectionOrder(right.section)
        || compareCategories(left.section, left.category, right.category)
      ));
  }, [filtered]);

  async function saveItem() {
    if (!editor) return;
    if (!editor.name.trim() || !editor.category.trim()) {
      setError('Вкажіть назву та категорію позиції.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await secureApi<MenuMutationResponse>({
        action: 'menu_save_item',
        id: editor.id,
        section: editor.section,
        category: editor.category,
        name: editor.name,
        price: editor.price,
        weight: editor.weight,
        description: editor.description,
        photo: editor.photo,
        allergens: editor.allergens,
        cook_time_normal: editor.cookTimeNormal,
        cook_time_busy: editor.cookTimeBusy,
        emoji: editor.emoji,
        stopped: editor.stopped,
        sort_order: editor.sortOrder,
      }, 'tiflis-menu-api');
      setEditor(null);
      setSelected(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Позицію не збережено.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStop(item: MenuItem) {
    const nextStopped = !item.stopped;
    setError(null);
    try {
      await secureApi<{ ok: true; item: { id: number; stopped: boolean } }>({
        action: 'menu_toggle_stop',
        id: item.id,
        stopped: nextStopped,
      }, 'tiflis-menu-api');
      setItems((current) => current.map((existing) => (existing.id === item.id ? { ...existing, stopped: nextStopped } : existing)));
      setSelected((current) => (current && current.id === item.id ? { ...current, stopped: nextStopped } : current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося змінити статус позиції.');
    }
  }

  async function deleteItem() {
    if (!editor?.id) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>({ action: 'menu_delete_item', id: editor.id }, 'tiflis-menu-api');
      setItems((current) => current.filter((item) => item.id !== editor.id));
      setEditor(null);
      setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Позицію не видалено.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="menu-page-v2">
      <section className="menu-command-v2">
        <label className="menu-search-v2">
          <Search size={19} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Страва, напій, склад або алерген…" />
          {search ? <button type="button" onClick={() => setSearch('')} aria-label="Очистити пошук"><X size={16} /></button> : null}
        </label>
        <div className="menu-command-actions-v2">
          <button type="button" className={busyMode ? 'is-active' : ''} onClick={() => setBusyMode((value) => !value)}><Clock3 size={17} /> Завантажена кухня</button>
          {data?.permissions.canEdit ? <button type="button" className="menu-add-v2" onClick={() => setEditor(createEditor())}><Plus size={18} /> Нова позиція</button> : null}
        </div>
      </section>

      <section className="menu-metrics-v2">
        <article><UtensilsCrossed size={19} /><span>Позицій</span><strong>{items.length}</strong></article>
        <article><ImageIcon size={19} /><span>З фото</span><strong>{metrics.photographed}</strong></article>
        <article><Clock3 size={19} /><span>З часом кухні</span><strong>{metrics.timed}</strong></article>
      </section>

      <section className="menu-browser-v2">
        <div className="menu-section-tabs-v2" role="tablist" aria-label="Розділи меню">
          <button type="button" role="tab" aria-selected={activeSection === 'all'} className={activeSection === 'all' ? 'is-active' : ''} onClick={() => { setActiveSection('all'); setActiveCategory('all'); }}><Sparkles size={16} /> Усе <span>{items.length}</span></button>
          {sections.map(([section, count]) => (
            <button type="button" role="tab" aria-selected={activeSection === section} className={activeSection === section ? 'is-active' : ''} onClick={() => { setActiveSection(section); setActiveCategory('all'); }} key={section}>
              <span className="menu-tab-symbol">{sectionIcon(section)}</span>{sectionLabel(section)} <span>{count}</span>
            </button>
          ))}
        </div>

        <div className="menu-category-tabs-v2">
          <button type="button" className={activeCategory === 'all' ? 'is-active' : ''} onClick={() => setActiveCategory('all')}>Усі категорії</button>
          {categories.map(([category, count]) => <button type="button" className={activeCategory === category ? 'is-active' : ''} onClick={() => setActiveCategory(category)} key={category}>{categoryLabel(category)}<span>{count}</span></button>)}
        </div>

        {error ? <div className="menu-alert-v2" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
        {loading ? <div className="menu-loading-v2"><RefreshCw size={24} className="is-spinning" /><span>Готуємо каталог…</span></div> : null}
        {!loading && filtered.length === 0 ? <div className="menu-empty-v2"><Search size={30} /><strong>Нічого не знайдено</strong><span>Змініть секцію, категорію або пошуковий запит.</span></div> : null}

        {!loading ? <div className="menu-category-groups-v2">
          {visibleCategories.map((group) => <section key={group.key} className="menu-category-group-v2">
            <div className="menu-category-heading-v2"><div><span className="eyebrow">{sectionLabel(group.section)}</span><h3>{categoryLabel(group.category)}</h3></div><span>{group.items.length} позицій</span></div>
            <div className="menu-dish-grid-v4" aria-label={`Категорія: ${categoryLabel(group.category)}`}>
              {group.items.map((item) => {
                const shownTime = busyMode ? item.cook_time_busy : item.cook_time_normal;
                return (
                  <button
                    type="button"
                    className={`menu-dish-card-v4 ${item.stopped ? 'is-stopped' : ''}`}
                    key={item.id}
                    onClick={() => setSelected(item)}
                    aria-label={`${item.name}, ${money(item.price)}${item.weight ? `, ${item.weight}` : ''}`}
                  >
                    <span className="menu-dish-photo-v4">
                      <span className="menu-dish-photo-fallback-v4">{item.emoji || sectionIcon(item.section)}</span>
                      {item.photo ? <img src={item.photo} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
                      {item.stopped ? <b><AlertTriangle size={13} /> Стоп</b> : null}
                      {shownTime !== null ? <em><Clock3 size={13} /> {shownTime} хв</em> : null}
                    </span>
                    <span className="menu-dish-copy-v4">
                      <small>{categoryLabel(item.category)}</small>
                      <strong>{item.name}</strong>
                      <span className="menu-dish-value-v4"><b>{money(item.price)}</b><em>{item.weight || 'Вага не вказана'}</em></span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>)}
        </div> : null}
      </section>

      {selected ? <div className="menu-sheet-backdrop-v2 menu-detail-backdrop-v4" onMouseDown={() => setSelected(null)}><section className="menu-detail-sheet-v2 menu-detail-sheet-v4" role="dialog" aria-modal="true" aria-labelledby={`menu-detail-title-${selected.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="menu-detail-drag-v4" aria-hidden="true"><span /></div>
        <div className="menu-detail-media-v2 menu-detail-media-v4"><span>{selected.emoji || sectionIcon(selected.section)}</span>{selected.photo ? <img src={selected.photo} alt={selected.name} onError={(event) => { event.currentTarget.hidden = true; }} /> : null}<button type="button" onClick={() => setSelected(null)} aria-label="Закрити"><X size={20} /></button>{selected.stopped ? <b><AlertTriangle size={16} /> Позиція у стопі</b> : null}</div>
        <div className="menu-detail-body-v2 menu-detail-body-v4">
          <span className="eyebrow">{sectionLabel(selected.section)} · {categoryLabel(selected.category)}</span>
          <h3 id={`menu-detail-title-${selected.id}`}>{selected.name}</h3>
          <div className="menu-detail-price-v2"><strong>{money(selected.price)}</strong>{selected.weight ? <span>{selected.weight}</span> : null}</div>
          <p>{selected.description || 'Опис позиції не додано.'}</p>
          <div className="menu-detail-facts-v3 menu-detail-facts-v4"><span><b>Категорія</b>{categoryLabel(selected.category)}</span><span><b>Статус</b>{selected.stopped ? 'У стопі' : 'Доступна'}</span></div>
          {(selected.cook_time_normal !== null || selected.cook_time_busy !== null) ? <div className="menu-detail-times-v2"><span><Clock3 size={17} /><b>Звичайно</b>{selected.cook_time_normal !== null ? `${selected.cook_time_normal} хв` : 'не вказано'}</span><span><AlertTriangle size={17} /><b>При завантаженні</b>{selected.cook_time_busy !== null ? `${selected.cook_time_busy} хв` : 'не вказано'}</span></div> : null}
          {(selected.allergens || []).length > 0 ? <div className="menu-detail-allergens-v2"><strong>Алергени</strong><div>{(selected.allergens || []).map((allergen) => <span key={allergen}>{allergen}</span>)}</div></div> : null}
          <div className="menu-detail-actions-v2">
            {data?.permissions.canToggleStop ? (
              <button
                type="button"
                className={selected.stopped ? 'is-return' : 'is-stop'}
                onClick={() => void toggleStop(selected)}
              >
                {selected.stopped ? <Check size={17} /> : <AlertTriangle size={17} />}
                {selected.stopped ? 'Зняти зі стопу' : 'У стоп-лист'}
              </button>
            ) : <span />}
            {data?.permissions.canEdit ? <button type="button" className="is-edit" onClick={() => { setEditor(createEditor(selected)); setSelected(null); }}><Edit3 size={17} /> Редагувати</button> : null}
          </div>
        </div>
      </section></div> : null}

      {editor ? <div className="menu-sheet-backdrop-v2" onMouseDown={() => !saving && setEditor(null)}><section className="menu-editor-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="menu-editor-heading-v2"><div><span className="eyebrow">{editor.id ? 'Редагування' : 'Нова позиція'}</span><h3>{editor.id ? editor.name : 'Додати до меню'}</h3></div><button type="button" onClick={() => setEditor(null)} disabled={saving}><X size={19} /></button></div>
        <div className="menu-editor-grid-v2">
          <label><span>Розділ</span><select value={editor.section} onChange={(event) => setEditor({ ...editor, section: event.target.value })}>{[...new Set([...Object.keys(SECTION_META), ...sections.map(([section]) => section)])].map((section) => <option value={section} key={section}>{sectionLabel(section)}</option>)}</select></label>
          <label><span>Категорія</span><input value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} list="menu-categories" maxLength={120} /><datalist id="menu-categories">{categories.map(([category]) => <option value={category} key={category}>{categoryLabel(category)}</option>)}</datalist></label>
          <label className="is-wide"><span>Назва</span><input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} maxLength={180} /></label>
          <label><span>Ціна, ₴</span><input type="number" min="0" value={editor.price} onChange={(event) => setEditor({ ...editor, price: event.target.value })} /></label>
          <label><span>Вага / обʼєм</span><input value={editor.weight} onChange={(event) => setEditor({ ...editor, weight: event.target.value })} maxLength={100} placeholder="250 г / 50 мл" /></label>
          <label><span>Емодзі</span><input value={editor.emoji} onChange={(event) => setEditor({ ...editor, emoji: event.target.value })} maxLength={16} placeholder="🍽️" /></label>
          <label><span>Час, хв</span><input type="number" min="0" max="1440" value={editor.cookTimeNormal} onChange={(event) => setEditor({ ...editor, cookTimeNormal: event.target.value })} /></label>
          <label><span>При завантаженні, хв</span><input type="number" min="0" max="1440" value={editor.cookTimeBusy} onChange={(event) => setEditor({ ...editor, cookTimeBusy: event.target.value })} /></label>
          <label className="is-wide"><span>Фото, HTTPS URL</span><input type="url" value={editor.photo} onChange={(event) => setEditor({ ...editor, photo: event.target.value })} maxLength={1000} placeholder="https://…" /></label>
          <label className="is-wide"><span>Опис і склад</span><textarea value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} maxLength={3000} /></label>
        </div>
        <div className="menu-allergen-editor-v2"><strong>Алергени</strong><div>{ALLERGENS.map((allergen) => { const checked = editor.allergens.includes(allergen); return <button type="button" key={allergen} className={checked ? 'is-active' : ''} onClick={() => setEditor({ ...editor, allergens: checked ? editor.allergens.filter((item) => item !== allergen) : [...editor.allergens, allergen] })}>{checked ? <Check size={13} /> : null}{allergen}</button>; })}</div></div>
        <label className="menu-editor-stop-v2"><input type="checkbox" checked={editor.stopped} onChange={(event) => setEditor({ ...editor, stopped: event.target.checked })} /><span><AlertTriangle size={17} /><b>Позиція зараз у стопі</b></span></label>
        <div className="menu-editor-actions-v2">{editor.id ? <button type="button" className="is-delete" onClick={() => void deleteItem()} disabled={saving}><Trash2 size={17} /> Видалити</button> : <span />}<button type="button" className="is-save" onClick={() => void saveItem()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />} Зберегти</button></div>
      </section></div> : null}
    </div>
  );
}
