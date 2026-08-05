import {
  AlertTriangle,
  Check,
  ChefHat,
  Clock3,
  Coffee,
  Edit3,
  Image as ImageIcon,
  Leaf,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Wine,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { secureApi } from '../lib/secureApi';
import './menu.css';

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
  permissions: {
    canToggleStop: boolean;
    canEdit: boolean;
  };
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

const SECTION_META: Record<string, { label: string; icon: string; order: number }> = {
  main: { label: 'Основне меню', icon: '🍽️', order: 1 },
  bar: { label: 'Бар', icon: '🍸', order: 2 },
  wine: { label: 'Винна карта', icon: '🍷', order: 3 },
  lunch: { label: 'Комплексні обіди', icon: '🥗', order: 4 },
  season: { label: 'Сезонне', icon: '🌿', order: 5 },
  banquet: { label: 'Банкетне', icon: '🎉', order: 6 },
  lean: { label: 'Пісне', icon: '🕊️', order: 7 },
};

const ALLERGENS = [
  'Глютен', 'Молоко', 'Яйця', 'Горіхи', 'Риба', 'Морепродукти', 'Соя',
  'Селера', 'Гірчиця', 'Кунжут', 'Лупин', 'Молюски', 'Діоксид сірки',
];

function sectionLabel(section: string): string {
  return SECTION_META[section]?.label || section;
}

function sectionIcon(section: string): string {
  return SECTION_META[section]?.icon || '𐃯';
}

function money(value: number | string | null): string {
  if (value === null || value === '') return 'Ціну не вказано';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Ціну не вказано';
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA');
}

function itemSearchText(item: MenuItem): string {
  return [
    item.name,
    item.category,
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
    cookTimeNormal: item?.cook_time_normal === null || item?.cook_time_normal === undefined
      ? ''
      : String(item.cook_time_normal),
    cookTimeBusy: item?.cook_time_busy === null || item?.cook_time_busy === undefined
      ? ''
      : String(item.cook_time_busy),
    emoji: item?.emoji || '',
    stopped: item?.stopped || false,
    sortOrder: item?.sort_order || 0,
  };
}

function SectionSymbol({ section }: { section: string }) {
  if (section === 'bar') return <Coffee size={22} />;
  if (section === 'wine') return <Wine size={22} />;
  if (section === 'season' || section === 'lean') return <Leaf size={22} />;
  return <UtensilsCrossed size={22} />;
}

export function MenuPage() {
  const [data, setData] = useState<MenuBootstrapResponse | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [busyMode, setBusyMode] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [editor, setEditor] = useState<MenuEditorState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await secureApi<MenuBootstrapResponse>(
        { action: 'menu_bootstrap' },
        'tiflis-menu-api',
      );
      setData(response);
      setItems(response.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити меню.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.section, (counts.get(item.section) || 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => {
      const leftOrder = SECTION_META[left]?.order ?? 999;
      const rightOrder = SECTION_META[right]?.order ?? 999;
      return leftOrder - rightOrder || sectionLabel(left).localeCompare(sectionLabel(right), 'uk');
    });
  }, [items]);

  const categories = useMemo(() => {
    const scoped = activeSection === 'all'
      ? items
      : items.filter((item) => item.section === activeSection);
    const counts = new Map<string, number>();
    scoped.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'uk'));
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
      if (query && !itemSearchText(item).includes(query)) return false;
      return true;
    });
  }, [activeCategory, activeSection, items, search]);

  const metrics = useMemo(() => {
    const stopped = items.filter((item) => item.stopped).length;
    const photographed = items.filter((item) => item.photo).length;
    const timed = items.filter((item) => item.cook_time_normal !== null).length;
    return { stopped, photographed, timed };
  }, [items]);

  const visibleCategories = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    filtered.forEach((item) => {
      const group = groups.get(item.category) || [];
      group.push(item);
      groups.set(item.category, group);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'uk'));
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

  async function deleteItem() {
    if (!editor?.id) return;
    setSaving(true);
    setError(null);
    try {
      await secureApi<{ ok: true }>(
        { action: 'menu_delete_item', id: editor.id },
        'tiflis-menu-api',
      );
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
      <section className="menu-hero-v2">
        <div>
          <span className="eyebrow">Каталог ресторану</span>
          <h2>Меню, яке працює під час сервісу</h2>
          <p>Швидкий пошук по 315 позиціях, фото, склад, алергени та час кухні без зайвих службових перемикачів.</p>
        </div>
        <div className="menu-hero-mark"><ChefHat size={36} /></div>
      </section>

      <section className="menu-command-v2">
        <label className="menu-search-v2">
          <Search size={19} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Страва, напій, склад або алерген…"
          />
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
          <button type="button" role="tab" aria-selected={activeSection === 'all'} className={activeSection === 'all' ? 'is-active' : ''} onClick={() => setActiveSection('all')}><Sparkles size={16} /> Усе <span>{items.length}</span></button>
          {sections.map(([section, count]) => <button type="button" role="tab" aria-selected={activeSection === section} className={activeSection === section ? 'is-active' : ''} onClick={() => setActiveSection(section)} key={section}><span className="menu-tab-symbol">{sectionIcon(section)}</span>{sectionLabel(section)} <span>{count}</span></button>)}
        </div>

        <div className="menu-category-tabs-v2">
          <button type="button" className={activeCategory === 'all' ? 'is-active' : ''} onClick={() => setActiveCategory('all')}>Усі категорії</button>
          {categories.map(([category, count]) => <button type="button" className={activeCategory === category ? 'is-active' : ''} onClick={() => setActiveCategory(category)} key={category}>{category}<span>{count}</span></button>)}
        </div>

        {error ? <div className="menu-alert-v2" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
        {loading ? <div className="menu-loading-v2"><RefreshCw size={24} className="is-spinning" /><span>Готуємо каталог…</span></div> : null}

        {!loading && filtered.length === 0 ? <div className="menu-empty-v2"><Search size={30} /><strong>Нічого не знайдено</strong><span>Змініть секцію, категорію або пошуковий запит.</span></div> : null}

        {!loading ? <div className="menu-category-groups-v2">
          {visibleCategories.map(([category, categoryItems]) => <section key={category} className="menu-category-group-v2">
            <div className="menu-category-heading-v2"><div><span className="eyebrow">{activeSection === 'all' ? sectionLabel(categoryItems[0]?.section || '') : sectionLabel(activeSection)}</span><h3>{category}</h3></div><span>{categoryItems.length} позицій</span></div>
            <div className="menu-card-grid-v2">
              {categoryItems.map((item) => {
                const shownTime = busyMode ? item.cook_time_busy : item.cook_time_normal;
                return <article className={`menu-card-v2 ${item.stopped ? 'is-stopped' : ''}`} key={item.id}>
                  <button type="button" className="menu-card-main-v2" onClick={() => setSelected(item)}>
                    <div className="menu-card-media-v2">
                      {item.photo ? <img src={item.photo} alt="" loading="lazy" /> : <span>{item.emoji || sectionIcon(item.section)}</span>}
                      {item.stopped ? <b><AlertTriangle size={14} /> Стоп</b> : null}
                      <i><SectionSymbol section={item.section} /></i>
                    </div>
                    <div className="menu-card-copy-v2">
                      <span>{item.category}</span>
                      <h4>{item.name}</h4>
                      <p>{item.description || 'Опис позиції не додано.'}</p>
                      <div className="menu-card-meta-v2">
                        <strong>{money(item.price)}</strong>
                        {item.weight ? <span>{item.weight}</span> : null}
                        {shownTime !== null ? <span><Clock3 size={13} /> {shownTime} хв</span> : null}
                      </div>
                      {(item.allergens || []).length > 0 ? <div className="menu-card-allergens-v2">{(item.allergens || []).slice(0, 3).map((allergen) => <span key={allergen}>{allergen}</span>)}{(item.allergens || []).length > 3 ? <span>+{(item.allergens || []).length - 3}</span> : null}</div> : null}
                    </div>
                  </button>
                </article>;
              })}
            </div>
          </section>)}
        </div> : null}
      </section>

      {selected ? <div className="menu-sheet-backdrop-v2" onMouseDown={() => setSelected(null)}><section className="menu-detail-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="menu-detail-media-v2">{selected.photo ? <img src={selected.photo} alt={selected.name} /> : <span>{selected.emoji || sectionIcon(selected.section)}</span>}<button type="button" onClick={() => setSelected(null)} aria-label="Закрити"><X size={19} /></button>{selected.stopped ? <b><AlertTriangle size={16} /> Позиція у стопі</b> : null}</div>
        <div className="menu-detail-body-v2">
          <span className="eyebrow">{sectionLabel(selected.section)} · {selected.category}</span>
          <h3>{selected.name}</h3>
          <div className="menu-detail-price-v2"><strong>{money(selected.price)}</strong>{selected.weight ? <span>{selected.weight}</span> : null}</div>
          <p>{selected.description || 'Опис позиції не додано.'}</p>
          <div className="menu-detail-times-v2"><span><Clock3 size={17} /><b>Звичайно</b>{selected.cook_time_normal !== null ? `${selected.cook_time_normal} хв` : 'не вказано'}</span><span><AlertTriangle size={17} /><b>При завантаженні</b>{selected.cook_time_busy !== null ? `${selected.cook_time_busy} хв` : 'не вказано'}</span></div>
          {(selected.allergens || []).length > 0 ? <div className="menu-detail-allergens-v2"><strong>Алергени</strong><div>{(selected.allergens || []).map((allergen) => <span key={allergen}>{allergen}</span>)}</div></div> : null}
          <div className="menu-detail-actions-v2">
            <span />
            {data?.permissions.canEdit ? <button type="button" className="is-edit" onClick={() => { setEditor(createEditor(selected)); setSelected(null); }}><Edit3 size={17} /> Редагувати</button> : null}
          </div>
        </div>
      </section></div> : null}

      {editor ? <div className="menu-sheet-backdrop-v2" onMouseDown={() => !saving && setEditor(null)}><section className="menu-editor-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="menu-editor-heading-v2"><div><span className="eyebrow">{editor.id ? 'Редагування' : 'Нова позиція'}</span><h3>{editor.id ? editor.name : 'Додати до меню'}</h3></div><button type="button" onClick={() => setEditor(null)} disabled={saving}><X size={19} /></button></div>
        <div className="menu-editor-grid-v2">
          <label><span>Розділ</span><select value={editor.section} onChange={(event) => setEditor({ ...editor, section: event.target.value })}>{[...new Set([...Object.keys(SECTION_META), ...sections.map(([section]) => section)])].map((section) => <option value={section} key={section}>{sectionLabel(section)}</option>)}</select></label>
          <label><span>Категорія</span><input value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} list="menu-categories" maxLength={120} /><datalist id="menu-categories">{categories.map(([category]) => <option value={category} key={category} />)}</datalist></label>
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
