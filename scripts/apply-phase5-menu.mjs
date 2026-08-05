import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const pagePath = 'src/pages/MenuPage.tsx';
let page = await readFile(pagePath, 'utf8');

page = replaceOnce(
  page,
  `function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA');
}`,
  `function formatUpdatedAt(value: string | null): string {
  if (!value) return 'Не вказано';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Не вказано';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA');
}`,
  'updated at formatter',
);

const oldGrid = `            <div className="menu-card-grid-v2">
              {categoryItems.map((item) => {
                const shownTime = busyMode ? item.cook_time_busy : item.cook_time_normal;
                return <article className={\`menu-card-v2 \${item.stopped ? 'is-stopped' : ''}\`} key={item.id}>
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
            </div>`;

const newGrid = `            <div className="menu-table-v3" aria-label={\`Категорія: \${category}\`}>
              <div className="menu-table-heading-v3" aria-hidden="true"><span>Позиція</span><span>Ціна / вага</span></div>
              {categoryItems.map((item) => {
                const shownTime = busyMode ? item.cook_time_busy : item.cook_time_normal;
                const allergenCount = (item.allergens || []).length;
                return (
                  <button
                    type="button"
                    className={\`menu-table-row-v3 \${item.stopped ? 'is-stopped' : ''}\`}
                    key={item.id}
                    onClick={() => setSelected(item)}
                    aria-label={\`\${item.name}, \${money(item.price)}\${item.weight ? \`, \${item.weight}\` : ''}\`}
                  >
                    <span className="menu-table-name-v3">
                      <i><SectionSymbol section={item.section} /></i>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.stopped ? <b><AlertTriangle size={12} /> Стоп</b> : null}
                          {item.photo ? <em><ImageIcon size={12} /> Фото</em> : null}
                          {shownTime !== null ? <em><Clock3 size={12} /> {shownTime} хв</em> : null}
                          {allergenCount > 0 ? <em>{allergenCount} алергенів</em> : null}
                          {!item.stopped && !item.photo && shownTime === null && allergenCount === 0 ? <em>{item.category}</em> : null}
                        </small>
                      </span>
                    </span>
                    <span className="menu-table-value-v3">
                      <strong>{money(item.price)}</strong>
                      <small>{item.weight || 'Вагу не вказано'}</small>
                    </span>
                  </button>
                );
              })}
            </div>`;

page = replaceOnce(page, oldGrid, newGrid, 'menu card grid');

page = replaceOnce(
  page,
  `          <p>{selected.description || 'Опис позиції не додано.'}</p>
          <div className="menu-detail-times-v2">`,
  `          <p>{selected.description || 'Опис позиції не додано.'}</p>
          <div className="menu-detail-facts-v3">
            <span><b>Розділ</b>{sectionLabel(selected.section)}</span>
            <span><b>Категорія</b>{selected.category}</span>
            <span><b>Статус</b>{selected.stopped ? 'У стопі' : 'Доступна'}</span>
            <span><b>Фото</b>{selected.photo ? 'Додано' : 'Відсутнє'}</span>
            <span><b>ID позиції</b>#{selected.id}</span>
            <span><b>Порядок</b>{selected.sort_order}</span>
            <span className="is-wide"><b>Останнє оновлення</b>{formatUpdatedAt(selected.updated_at)}</span>
          </div>
          <div className="menu-detail-times-v2">`,
  'menu modal facts',
);

await writeFile(pagePath, page, 'utf8');

const cssPath = 'src/pages/menu.css';
let css = await readFile(cssPath, 'utf8');
css += `

/* Compact two-column menu table */
.menu-table-v3{overflow:hidden;border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.012)}
.menu-table-heading-v3,.menu-table-row-v3{display:grid;grid-template-columns:minmax(0,1fr) minmax(132px,22%);align-items:center;gap:16px}
.menu-table-heading-v3{min-height:38px;padding:0 16px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.025);color:var(--muted);font-size:9px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}
.menu-table-heading-v3 span:last-child{text-align:right}
.menu-table-row-v3{width:100%;min-height:76px;padding:11px 16px;border:0;border-bottom:1px solid rgba(207,223,211,.075);background:transparent;color:var(--text);text-align:left;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}
.menu-table-row-v3:last-child{border-bottom:0}
.menu-table-row-v3:hover,.menu-table-row-v3:focus-visible{background:rgba(215,182,108,.045);outline:0}
.menu-table-row-v3:active{transform:scale(.995)}
.menu-table-row-v3.is-stopped{background:rgba(126,34,49,.055)}
.menu-table-row-v3.is-stopped:hover{background:rgba(126,34,49,.09)}
.menu-table-name-v3{min-width:0;display:grid;grid-template-columns:43px minmax(0,1fr);align-items:center;gap:11px}
.menu-table-name-v3>i{width:41px;height:41px;display:grid;place-items:center;border:1px solid var(--border);border-radius:13px;background:var(--surface-2);color:var(--gold);font-style:normal}
.menu-table-name-v3>span{min-width:0;display:grid;gap:6px}
.menu-table-name-v3 strong{overflow-wrap:anywhere;font-size:13px;line-height:1.35}
.menu-table-name-v3 small{display:flex;align-items:center;flex-wrap:wrap;gap:5px 8px;color:var(--muted);font-size:8px}
.menu-table-name-v3 small b,.menu-table-name-v3 small em{display:inline-flex;align-items:center;gap:4px;font-style:normal;font-weight:750}
.menu-table-name-v3 small b{padding:3px 6px;border-radius:7px;background:rgba(239,124,124,.1);color:#ffadad}
.menu-table-value-v3{min-width:0;display:grid;justify-items:end;gap:5px;text-align:right}
.menu-table-value-v3 strong{color:var(--gold);font-size:13px}
.menu-table-value-v3 small{color:var(--muted);font-size:9px;line-height:1.35}
.menu-detail-facts-v3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:18px 0}
.menu-detail-facts-v3 span{min-width:0;display:grid;gap:5px;padding:11px 12px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.018);color:#d0d8d1;font-size:10px;overflow-wrap:anywhere}
.menu-detail-facts-v3 span b{color:var(--muted);font-size:8px;letter-spacing:.08em;text-transform:uppercase}
.menu-detail-facts-v3 span.is-wide{grid-column:span 3}
@media(max-width:640px){.menu-category-groups-v2{gap:24px;padding:14px 10px}.menu-category-heading-v2{padding:0 4px}.menu-table-heading-v3,.menu-table-row-v3{grid-template-columns:minmax(0,1fr) minmax(104px,34%);gap:9px}.menu-table-heading-v3{padding:0 11px}.menu-table-row-v3{min-height:72px;padding:10px 11px}.menu-table-name-v3{grid-template-columns:35px minmax(0,1fr);gap:8px}.menu-table-name-v3>i{width:34px;height:34px;border-radius:11px}.menu-table-name-v3>i svg{width:17px;height:17px}.menu-table-name-v3 strong{font-size:11px}.menu-table-name-v3 small{gap:4px 6px}.menu-table-value-v3 strong{font-size:11px}.menu-detail-facts-v3{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.menu-detail-facts-v3 span.is-wide{grid-column:span 2}}
@media(max-width:390px){.menu-table-name-v3 small em:nth-of-type(n+3){display:none}.menu-detail-facts-v3{grid-template-columns:1fr}.menu-detail-facts-v3 span.is-wide{grid-column:auto}}
`;
await writeFile(cssPath, css, 'utf8');

console.log('Phase 5 menu patch applied.');
