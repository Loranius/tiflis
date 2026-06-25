// ╔═══════════════════════════════════════════════════════════════╗
// ║  Резерв — бронювання столиків                                  ║
// ╚═══════════════════════════════════════════════════════════════╝
const Reserve = {
  _key: 'tiflis_reserve_halls_order',

  DEFAULT_HALLS: [
    'Загальний зал',
    'Камінний зал',
    'Нижній зал №2',
    'Нижній зал №3',
    'Літня тераса',
    'Кабінки',
  ],

  _active: null, // поточний активний зал

  // ── Стрип вибору дати (єдина дата для всіх залів) ─────────
  _selectedDate: null,

  _initStrip() {
    if (Reserve._selectedDate) return;
    Reserve._selectedDate = todayKey();
  },

  stripPrev() {
    Reserve._initStrip();
    const d = new Date(Reserve._selectedDate);
    d.setDate(d.getDate() - 7);
    Reserve._stripCenter = d;
    Reserve.renderStrip();
  },

  stripNext() {
    Reserve._initStrip();
    const d = new Date(Reserve._stripCenter || Reserve._selectedDate);
    d.setDate(d.getDate() + 7);
    Reserve._stripCenter = d;
    Reserve.renderStrip();
  },

  stripSelect(dk) {
    Reserve._selectedDate = dk;
    Reserve.renderStrip();
    Reserve.renderContent();
    Reserve.renderTablesList();
  },

  renderStrip() {
    Reserve._initStrip();
    const container = $('reserve-strip-days');
    if (!container) return;
    const DOW_UK = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
    const MON_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
    const todayStr = todayKey();
    const VISIBLE = 7;

    const center = Reserve._stripCenter || new Date(Reserve._selectedDate);
    const base = new Date(center);
    base.setDate(base.getDate() - Math.floor(VISIBLE / 2));

    let html = '';
    for (let i = 0; i < VISIBLE; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      const isToday = dk === todayStr;
      const isSel = dk === Reserve._selectedDate;
      let cls = 'duties-strip-day';
      if (isToday) cls += ' today';
      if (isSel) cls += ' selected';
      const count = Reserve._countBookingsForDate(dk);
      html += `<div class="${cls}" onclick="Reserve.stripSelect('${dk}')">
        <span class="ds-dow">${DOW_UK[d.getDay()]}</span>
        <span class="ds-num">${d.getDate()}</span>
        <span class="ds-mon">${MON_SHORT[d.getMonth()]}</span>
        ${count > 0 ? `<span style="font-size:8px;color:var(--gold)">●</span>` : ''}
      </div>`;
    }
    container.innerHTML = html;
  },

  _countBookingsForDate(dk) {
    const all = Reserve.getAllBookings();
    let count = 0;
    for (const key in all) {
      for (const b of all[key]) {
        if (b.date === dk) count++;
      }
    }
    return count;
  },

  getHalls() {
    try {
      const saved = localStorage.getItem(Reserve._key);
      if (saved) {
        const arr = JSON.parse(saved);
        // Захист: якщо список не співпадає з дефолтним набором (нові додані) — мерджимо
        const merged = arr.filter(h => Reserve.DEFAULT_HALLS.includes(h));
        for (const h of Reserve.DEFAULT_HALLS) if (!merged.includes(h)) merged.push(h);
        return merged;
      }
    } catch(e) {}
    return [...Reserve.DEFAULT_HALLS];
  },

  setHalls(order) {
    localStorage.setItem(Reserve._key, JSON.stringify(order));
    // Зберігаємо і в Supabase щоб порядок був спільний для всіх
    sb.upsert('settings', { key: Reserve._key, value: JSON.stringify(order) }, 'key').catch(()=>{});
  },

  async init() {
    // Підтягуємо актуальний порядок залів з Supabase (якщо є)
    try {
      const rows = await sb.query('settings', { filter:{ key: Reserve._key }, select:'value', limit:1 });
      if (rows?.[0]?.value) {
        const remote = JSON.parse(rows[0].value);
        if (Array.isArray(remote) && remote.length) {
          localStorage.setItem(Reserve._key, JSON.stringify(remote));
        }
      }
    } catch(e) {}

    // Підтягуємо бронювання з Supabase
    try {
      const rows = await sb.query('settings', { filter:{ key: LS_KEYS.RESERVE_BOOKINGS }, select:'value', limit:1 });
      if (rows?.[0]?.value) {
        const parsed = JSON.parse(rows[0].value);
        const changed = Reserve._pruneExpired(parsed);
        DB.set(LS_KEYS.RESERVE_BOOKINGS, parsed);
        if (changed) Reserve.saveAllBookings(parsed).catch(()=>{});
      }
    } catch(e) {}

    const halls = Reserve.getHalls();
    if (!Reserve._active || !halls.includes(Reserve._active)) Reserve._active = halls[0];

    Reserve._initStrip();
    Reserve.renderAdminBtns();
    Reserve.renderTabs();
    Reserve.renderStrip();
    Reserve.renderContent();
    Reserve.renderTablesList();

    // Перерендер при зміні розміру екрану (поворот, resize)
    if (!Reserve._resizeBound) {
      Reserve._resizeBound = true;
      window.addEventListener('resize', () => {
        clearTimeout(Reserve._resizeT);
        Reserve._resizeT = setTimeout(() => {
          if ($('page-reserve')?.classList.contains('active')) Reserve.renderContent();
        }, 150);
      });
    }
  },

  renderAdminBtns() {
    const el = $('reserve-admin-btns');
    if (!el) return;
    if (!isAdmin(currentUser)) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <button class="btn btn-sm btn-ghost" onclick="Reserve.toggleReorder()">
        ${Reserve._reordering ? '✅ Готово' : '↔️ Порядок залів'}
      </button>`;
  },

  toggleReorder() {
    Reserve._reordering = !Reserve._reordering;
    Reserve.renderAdminBtns();
    Reserve.renderTabs();
  },

  renderTabs() {
    const el = $('reserve-hall-tabs');
    if (!el) return;
    const halls = Reserve.getHalls();
    const reordering = !!Reserve._reordering;

    el.innerHTML = `
      <div class="tab-row" id="reserve-tab-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${halls.map((h, i) => `
          <button class="tab-btn ${h===Reserve._active?'active':''}"
            draggable="${reordering}"
            data-hall="${esc(h)}"
            data-idx="${i}"
            ondragstart="Reserve._onDragStart(event)"
            ondragover="Reserve._onDragOver(event)"
            ondrop="Reserve._onDrop(event)"
            ondragend="Reserve._onDragEnd(event)"
            onclick="${reordering ? '' : `Reserve.selectHall('${esc(h)}')`}"
            style="padding:8px 14px;border-radius:10px;border:1px solid var(--border);
                   background:${h===Reserve._active?'var(--gold)':'var(--surface)'};
                   color:${h===Reserve._active?'#1a1a1a':'var(--text)'};
                   font-size:12.5px;font-weight:600;cursor:${reordering?'grab':'pointer'};
                   white-space:nowrap;transition:.15s;
                   ${reordering?'opacity:.9':''}">
            ${reordering ? '⠿ ' : ''}${esc(h)}
          </button>
        `).join('')}
      </div>
      ${reordering ? `<div style="font-size:11px;color:var(--text-dim);margin:-8px 0 12px">
        Перетягни вкладки щоб змінити порядок залів
      </div>` : ''}
    `;
  },

  // ── Дані розсадки столів по залах ─────────────────────────
  // Координати в умовних одиницях (grid), масштабуються через CSS.
  // type: 'big' | 'small' | 'round'
  LAYOUTS: {
    'Загальний зал': {
      note: 'Столи 7, 15, 16, 17, 18 не існують. Стіл 19 — круглий великий на 10 осіб',
      cellH: 0.78,
      tables: [
        // Ліва колонка
        {n:'1', x:0, y:6, type:'small'},
        {n:'2', x:0, y:5, type:'small'},
        {n:'3', x:0, y:4, type:'small'},
        {n:'4', x:0, y:3, type:'small'},
        {n:'5', x:0, y:2, type:'small'},
        {n:'6', x:0, y:1, type:'small'},

        // Права колонка
        {n:'19', x:1.6, y:5, type:'round-big'},
        {n:'14', x:1.6, y:4, type:'small'},
        {n:'13', x:1.6, y:3, type:'small'},
        {n:'12', x:1.6, y:2, type:'small'},
        {n:'11', x:1.6, y:1, type:'small'},

        // Верхній ряд
        {n:'8',  x:0,   y:0, type:'small'},
        {n:'9',  x:0.8, y:0, type:'small'},
        {n:'10', x:1.6, y:0, type:'small'},
      ],
      cols:2.6, rows:7,
    },

    'Камінний зал': {
      note: 'Столи 1-4, 6, 10 — великі (8 ос.); 5, 7, 9 — малі (4 ос.)',
      tables: [
        // Верхній ряд — від вікна
        {n:'1', x:0, y:0, type:'big-8'},
        {n:'2', x:1, y:0, type:'big-8'},
        {n:'3', x:2, y:0, type:'big-8'},
        {n:'4', x:3, y:0, type:'big-8'},
        {n:'5', x:4, y:0, type:'small'},

        // Нижній ряд — від каміна
        {n:'6', x:0, y:1, type:'big-8'},
        {n:'7', x:1, y:1, type:'small'},
        {n:'🔥', x:2, y:1, type:'fireplace'},
        {n:'9', x:3, y:1, type:'small'},
        {n:'10', x:4, y:1, type:'big-8'},
      ],
      cols:5, rows:2,
    },

    'Нижній зал №2': {
      note: '',
      tables: [
        // 3 великих ліворуч
        {n:'1', x:0, y:0, type:'big'},
        {n:'2', x:0, y:1, type:'big'},
        {n:'3', x:0, y:2, type:'big'},
        // 3 маленьких праворуч
        {n:'4', x:2, y:0, type:'small'},
        {n:'5', x:2, y:1, type:'small'},
        {n:'6', x:2, y:2, type:'small'},
      ],
      cols:3, rows:3,
    },

    'Нижній зал №3': {
      note: '',
      tables: [
        // 4 великих праворуч
        {n:'1', x:2, y:0, type:'big'},
        {n:'2', x:2, y:1, type:'big'},
        {n:'3', x:2, y:2, type:'big'},
        {n:'4', x:2, y:3, type:'big'},
        // 5 ліворуч, чергуються великий/маленький
        {n:'5', x:0, y:0,   type:'big'},
        {n:'6', x:0, y:1,   type:'small'},
        {n:'7', x:0, y:2,   type:'big'},
        {n:'8', x:0, y:3,   type:'small'},
        {n:'9', x:0, y:4,   type:'big'},
      ],
      cols:3, rows:5,
    },

    'Кабінки': {
      note: 'Всі кабінки однакового розміру (6 ос.)',
      tables: [
        {n:'8.5 VIP', x:0,    y:0, type:'cabin'},
        {n:'8.4',     x:1.15, y:0, type:'cabin'},
        {n:'8.3',     x:2.3,  y:0, type:'cabin'},
        {n:'8.2',     x:3.45, y:0, type:'cabin'},
        {n:'8.1',     x:4.6,  y:0, type:'cabin'},
      ],
      cols:5.6, rows:1,
    },

    'Літня тераса': {
      note: 'Столики 5.13–5.16 круглі, без накриття. Великі: 6 ос., малі: 4 ос.',
      cellH: 0.88,
      tables: [
        // ── Рядок 1: 5.1–5.6 ─────────────────────────────────────────
        {n:'5.1', x:0, y:0, type:'big'},
        {n:'5.2', x:1, y:0, type:'small'},
        {n:'5.3', x:2, y:0, type:'big'},
        {n:'5.4', x:3, y:0, type:'big'},
        {n:'5.5', x:4, y:0, type:'small'},
        {n:'5.6', x:5, y:0, type:'big'},

        // ── Рядок 2: 5.7–5.12 ────────────────────────────────────────
        {n:'5.7',  x:0, y:1, type:'small'},
        {n:'5.8',  x:1, y:1, type:'big'},
        {n:'5.9',  x:2, y:1, type:'small'},
        {n:'5.10', x:3, y:1, type:'big'},
        {n:'5.11', x:4, y:1, type:'small'},
        {n:'5.12', x:5, y:1, type:'big'},

        // ── Рядок 3: круглі 5.13–5.16 (без накриття) ─────────────────
        {type:'divider', x:0, y:2.05, label:'без накриття'},
        {n:'5.13', x:0, y:2.45, type:'round'},
        {n:'5.14', x:1, y:2.45, type:'round'},
        {n:'5.15', x:2, y:2.45, type:'round'},
        {n:'5.16', x:3, y:2.45, type:'round'},
      ],
      cols:6, rows:3.6,
    },
  },

  TYPE_INFO: {
    'big':         { label: 'Великий стіл',  seats: 6, w:74,  h:64,  bg:'linear-gradient(135deg,#3a3530,#2a2620)', radius:'12px' },
    'big-8':       { label: 'Великий стіл',  seats: 8, w:84,  h:64,  bg:'linear-gradient(135deg,#3a3530,#2a2620)', radius:'12px' },
    'small':       { label: 'Малий стіл',    seats: 4, w:54,  h:64,  bg:'linear-gradient(135deg,#33302a,#252220)', radius:'10px' },
    'round':       { label: 'Круглий стіл (без накриття)', seats: 4, w:64, h:64, bg:'linear-gradient(135deg,#2f3a33,#222a25)', radius:'50%' },
    'round-big':   { label: 'Круглий великий стіл', seats: 10, w:64, h:64, bg:'linear-gradient(135deg,#3a3530,#2a2620)', radius:'50%' },
    'cabin':       { label: 'Кабінка',       seats: 6, w:96,  h:64,  bg:'linear-gradient(135deg,#3a3530,#2a2620)', radius:'14px' },
    'fireplace':   { label: 'Камін',         seats: 0, w:64,  h:64, bg:'radial-gradient(circle,#5a2c12,#2a1308)', radius:'50%', textColor:'#ffb35c' },
  },

  selectHall(hall) {
    Reserve._active = hall;
    Reserve.renderTabs();
    Reserve.renderContent();
    Reserve.renderTablesList();
  },

  // ── Бронювання — зберігання/доступ ────────────────────────
  BOOKING_TTL_MS: 2 * 24 * 60 * 60 * 1000, // 2 дні з моменту створення

  getAllBookings() {
    return DB.get(LS_KEYS.RESERVE_BOOKINGS, {});
  },

  // Прибирає бронювання старші за 2 дні з моменту створення
  _pruneExpired(all) {
    const now = Date.now();
    let changed = false;
    for (const key in all) {
      const before = all[key].length;
      all[key] = all[key].filter(b => {
        const created = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (now - created) < Reserve.BOOKING_TTL_MS;
      });
      if (all[key].length !== before) changed = true;
      if (!all[key].length) { delete all[key]; changed = true; }
    }
    return changed;
  },

  getBookingsFor(hall, tableNum, date) {
    const all = Reserve.getAllBookings();
    const dk = date || Reserve._selectedDate || todayKey();
    return (all[`${hall}::${tableNum}`] || []).filter(b => b.date === dk);
  },

  // Бронювання, що "накривають" цей стіл — або власні, або через об'єднання
  // (коли цей стіл вказано в mergedWith іншого бронювання)
  getEffectiveBookingsFor(hall, tableNum, date) {
    const own = Reserve.getBookingsFor(hall, tableNum, date);
    const dk = date || Reserve._selectedDate || todayKey();
    const all = Reserve.getAllBookings();
    const fromOthers = [];
    for (const key in all) {
      const [h] = key.split('::');
      if (h !== hall) continue;
      for (const b of all[key]) {
        if (b.date !== dk) continue;
        if (Array.isArray(b.mergedWith) && b.mergedWith.includes(tableNum)) {
          fromOthers.push(b);
        }
      }
    }
    return [...own, ...fromOthers];
  },

  getTableStatus(hall, tableNum, date) {
    const bookings = Reserve.getEffectiveBookingsFor(hall, tableNum, date);
    if (bookings.some(b => b.status === 'occupied')) return 'occupied';
    if (bookings.length) return 'booked';
    return 'free';
  },

  async saveAllBookings(all) {
    Reserve._pruneExpired(all);
    DB.set(LS_KEYS.RESERVE_BOOKINGS, all);
    try {
      await sb.upsert('settings', { key: LS_KEYS.RESERVE_BOOKINGS, value: JSON.stringify(all) }, 'key');
    } catch(e) { console.error('reserve bookings save error:', e); }
  },

  // Список усіх бронювань на вибрану дату (всі зали)
  // Список усіх столів активного залу — вільні (з +) і заброньовані
  // Список усіх столів активного залу — вільні (з +) і заброньовані
  renderTablesList() {
    const el = $('reserve-bookings-list');
    if (!el) return;

    const hall = Reserve._active;
    const layout = Reserve.LAYOUTS[hall];
    if (!layout) { el.innerHTML = ''; return; }

    const dk = Reserve._selectedDate || todayKey();
    const tables = layout.tables.filter(t => Reserve.TYPE_INFO[t.type]?.seats > 0);

    // Природне сортування за номером столика
    const tableNumParts = (s) => {
      const m = String(s).match(/(\d+)\.(\d+)/);
      if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
      const n = parseFloat(s);
      return [Number.isNaN(n) ? 0 : n, 0];
    };
    const sorted = [...tables].sort((a, b) => {
      const [a1, a2] = tableNumParts(a.n);
      const [b1, b2] = tableNumParts(b.n);
      if (a1 !== b1) return a1 - b1;
      if (a2 !== b2) return a2 - b2;
      return String(a.n).localeCompare(String(b.n));
    });

    // ── Збираємо групи об'єднань для поточної дати ─────────────────
    const allBk = Reserve.getAllBookings();
    const MERGE_COLORS = ['#d4a843','#e07070','#70b8e0','#a0d070','#c080d0'];
    const mergeGroups = [];
    let colorIdx2 = 0;
    for (const key in allBk) {
      const [bHall, bTable] = key.split('::');
      if (bHall !== hall) continue;
      for (const b of allBk[key]) {
        if (b.date !== dk) continue;
        if (Array.isArray(b.mergedWith) && b.mergedWith.length) {
          mergeGroups.push({
            masterNum: bTable,
            slaves: b.mergedWith,
            allNums: [bTable, ...b.mergedWith],
            color: MERGE_COLORS[colorIdx2 % MERGE_COLORS.length],
          });
          colorIdx2++;
        }
      }
    }
    const slaveSet = new Set(mergeGroups.flatMap(g => g.slaves));
    const renderedMasters = new Set();

    const renderSingleTable = (t) => {
      const info = Reserve.TYPE_INFO[t.type];
      const bookings = Reserve.getEffectiveBookingsFor(hall, t.n, dk);
      const status = Reserve.getTableStatus(hall, t.n, dk);
      const statusColor = status === 'occupied' ? 'var(--danger)' : status === 'booked' ? 'var(--warning)' : 'var(--success)';
      const statusLabel = status === 'occupied' ? 'Зайнято' : status === 'booked' ? 'Резерв' : 'Вільний';
      const statusBg = status === 'occupied' ? 'rgba(224,90,90,.12)' : status === 'booked' ? 'rgba(224,160,80,.12)' : 'rgba(110,200,140,.10)';
      const bookingsSummary = bookings.length
        ? bookings.map(b => {
            const isMerged = Array.isArray(b.mergedWith) && b.mergedWith.includes(t.n);
            const tag = isMerged ? ` <span style="opacity:.6;font-weight:400">(об'єднано)</span>` : '';
            return `<div style="font-weight:700;font-size:15px;margin-bottom:2px">${esc(b.time || '—')} · ${esc(b.name)}${tag}</div>
                    <div style="font-size:12px;color:var(--text-dim)">👥 ${b.guests} ос.${b.phone ? ' · 📞 ' + esc(b.phone) : ''}${b.menu ? ' · 🍽️ ' + esc(b.menu) : ''}</div>`;
          }).join('<div style="height:6px"></div>')
        : '';
      return `
        <div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:14px;cursor:pointer;
          border-left:4px solid ${statusColor};background:${statusBg}"
          onclick="Reserve.onTableClick('${esc(hall)}','${esc(t.n)}','${t.type}')">
          <div style="min-width:54px;text-align:center">
            <div style="font-size:24px;font-weight:800;line-height:1">${esc(t.n)}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:2px">${info?.seats || '?'} ос.</div>
          </div>
          <div style="width:1px;align-self:stretch;background:rgba(255,255,255,.08)"></div>
          <div style="flex:1;min-width:0">
            ${bookingsSummary || `<div style="font-size:14px;color:var(--text-muted)">Немає бронювань</div>`}
          </div>
          <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;
            color:${statusColor};white-space:nowrap;margin-right:2px">${statusLabel}</div>
          ${status === 'free'
            ? `<button class="btn btn-gold" style="padding:8px 16px;font-size:18px;line-height:1;font-weight:800"
                 onclick="event.stopPropagation();Reserve.onTableClick('${esc(hall)}','${esc(t.n)}','${t.type}')">+</button>`
            : ''}
        </div>`;
    };

    const renderMergeGroup = (g) => {
      const color = g.color;
      const tableRows = g.allNums.map(num => {
        const tObj = sorted.find(x => x.n === num);
        if (!tObj) return '';
        const info = Reserve.TYPE_INFO[tObj.type];
        const bookings = Reserve.getEffectiveBookingsFor(hall, num, dk);
        const status = Reserve.getTableStatus(hall, num, dk);
        const statusColor = status === 'occupied' ? 'var(--danger)' : status === 'booked' ? 'var(--warning)' : 'var(--success)';
        const statusLabel = status === 'occupied' ? 'Зайнято' : status === 'booked' ? 'Резерв' : 'Вільний';
        const isMaster = num === g.masterNum;
        const bookingsSummary = bookings.length
          ? bookings.map(b => {
              const tag = !isMaster ? ` <span style="opacity:.6;font-weight:400">(об'єднано)</span>` : '';
              return `<div style="font-weight:700;font-size:14px;margin-bottom:2px">${esc(b.time || '—')} · ${esc(b.name)}${tag}</div>
                      <div style="font-size:11px;color:var(--text-dim)">👥 ${b.guests} ос.${b.phone ? ' · 📞 ' + esc(b.phone) : ''}${b.menu ? ' · 🍽️ ' + esc(b.menu) : ''}</div>`;
            }).join('')
          : `<div style="font-size:13px;color:var(--text-muted)">Немає бронювань</div>`;
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;
            border-radius:8px;background:rgba(255,255,255,.03);
            border-left:3px solid ${isMaster ? color : color + '66'};cursor:pointer"
            onclick="Reserve.onTableClick('${esc(hall)}','${esc(num)}','${tObj.type}')">
            <div style="min-width:46px;text-align:center">
              <div style="font-size:20px;font-weight:800;line-height:1;color:${color}">${esc(num)}</div>
              <div style="font-size:9px;color:var(--text-dim);margin-top:1px">${info?.seats || '?'} ос.</div>
            </div>
            <div style="width:1px;align-self:stretch;background:rgba(255,255,255,.08)"></div>
            <div style="flex:1;min-width:0">${bookingsSummary}</div>
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:${statusColor};white-space:nowrap">${statusLabel}</div>
          </div>`;
      }).join(`<div style="text-align:center;font-size:14px;line-height:1;color:${color};opacity:.45;margin:2px 4px">⋮</div>`);

      const totalSeats = g.allNums.reduce((sum, num) => {
        const tObj = sorted.find(x => x.n === num);
        return sum + (Reserve.TYPE_INFO[tObj?.type]?.seats || 0);
      }, 0);

      return `
        <div style="border:2px solid ${color};border-radius:12px;overflow:hidden;
          background:${color}0d;box-shadow:0 0 12px ${color}33">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
            background:${color}22;border-bottom:1px solid ${color}33">
            <span style="font-size:14px">🔗</span>
            <span style="font-size:12px;font-weight:800;color:${color};letter-spacing:.04em">
              ОБ'ЄДНАНІ СТОЛИ · ${g.allNums.map(esc).join(' + ')}
            </span>
            <span style="margin-left:auto;font-size:11px;color:var(--text-dim)">
              разом ${totalSeats} ос.
            </span>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;padding:8px">
            ${tableRows}
          </div>
        </div>`;
    };

    // ── Рендер списку ───────────────────────────────────────────────
    let listHtml = '';
    for (const t of sorted) {
      if (slaveSet.has(t.n)) continue;
      const g = mergeGroups.find(g2 => g2.masterNum === t.n);
      if (g && !renderedMasters.has(t.n)) {
        listHtml += renderMergeGroup(g);
        renderedMasters.add(t.n);
      } else {
        listHtml += renderSingleTable(t);
      }
    }

    el.innerHTML = `
      <div class="card-title">Столи залу «${esc(hall)}»</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${listHtml}
      </div>`;
  },

  _typeFor(hall, tableNum) {
    const layout = Reserve.LAYOUTS[hall];
    const t = layout?.tables.find(x => x.n === tableNum);
    return t?.type || 'small';
  },

  renderContent() {
    const el = $('reserve-hall-content');
    if (!el) return;
    const hall   = Reserve._active;
    const layout = Reserve.LAYOUTS[hall];

    if (!layout) {
      el.innerHTML = `
        <div class="card" style="padding:32px;text-align:center;color:var(--text-dim)">
          <div style="font-size:32px;margin-bottom:10px">🗓️</div>
          <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">${esc(hall)}</div>
          <div style="font-size:12px">Схема ще не налаштована</div>
        </div>`;
      return;
    }

    const BASE_CELL = 100; // px — базовий крок сітки (для розрахунку пропорцій)

    // Доступна ширина контейнера (з відступом padding картки)
    const containerEl = el.closest('#reserve-hall-content') || el;
    const availWidth = Math.max(containerEl.clientWidth || window.innerWidth - 48 || 320, 240) - 32; // -32 padding картки

    const naturalWidth = layout.cols * BASE_CELL;
    const MIN_SCALE = 0.55;
    const rawScale = availWidth / naturalWidth;
    const scale = layout.fixedScale != null
      ? layout.fixedScale
      : Math.min(1, Math.max(rawScale, MIN_SCALE));
    const needsScroll = layout.fixedScale != null
      ? (naturalWidth * scale > availWidth)
      : rawScale < MIN_SCALE;
    const CELL = BASE_CELL * scale;
    const CELL_Y = CELL * (layout.cellH || 1);

    // ── Збираємо інфо про об'єднані столи для поточної дати ───────────
    const dk2 = Reserve._selectedDate || todayKey();
    const allBk = Reserve.getAllBookings();
    // mergeGroups: масив { masterNum, slaves:[], booking, color }
    const mergeGroups = [];
    const MERGE_COLORS = ['#d4a843','#e07070','#70b8e0','#a0d070','#c080d0'];
    let colorIdx = 0;
    for (const key in allBk) {
      const [bHall, bTable] = key.split('::');
      if (bHall !== hall) continue;
      for (const b of allBk[key]) {
        if (b.date !== dk2) continue;
        if (Array.isArray(b.mergedWith) && b.mergedWith.length) {
          mergeGroups.push({
            masterNum: bTable,
            slaves: b.mergedWith,
            booking: b,
            color: MERGE_COLORS[colorIdx % MERGE_COLORS.length],
          });
          colorIdx++;
        }
      }
    }
    // Функція: чи входить стіл в яку-небудь групу об'єднання
    const getMergeGroup = (tableNum) => {
      for (const g of mergeGroups) {
        if (g.masterNum === tableNum || g.slaves.includes(tableNum)) return g;
      }
      return null;
    };

    // Допоміжна функція: координати центру/меж столика на полотні
    const getTableRect = (tableNum) => {
      const tObj = layout.tables.find(x => x.n === tableNum);
      if (!tObj) return null;
      const tInfo = Reserve.TYPE_INFO[tObj.type] || Reserve.TYPE_INFO['small'];
      const tw = tInfo.w * scale;
      const th = tInfo.h * scale;
      const tl = tObj.x * CELL + (CELL - tw) / 2;
      const tt = tObj.y * CELL_Y + (CELL_Y - th) / 2;
      return { l: tl, t: tt, w: tw, h: th, r: tl + tw, b: tt + th };
    };

    // Будуємо SVG оверлей з групами об'єднань
    let svgOverlay = '';
    if (mergeGroups.length) {
      const totalW = layout.cols * CELL;
      const totalH = layout.rows * CELL_Y;
      let svgPaths = '';
      for (const g of mergeGroups) {
        const allNums = [g.masterNum, ...g.slaves];
        const rects = allNums.map(n => getTableRect(n)).filter(Boolean);
        if (rects.length < 2) continue;
        // Bounding box усіх столів групи
        const PAD = 8 * scale;
        const bx1 = Math.min(...rects.map(r => r.l)) - PAD;
        const by1 = Math.min(...rects.map(r => r.t)) - PAD;
        const bx2 = Math.max(...rects.map(r => r.r)) + PAD;
        const by2 = Math.max(...rects.map(r => r.b)) + PAD;
        const bw = bx2 - bx1;
        const bh = by2 - by1;
        const br = 14 * scale;
        // Заливка-бокс між столами
        svgPaths += `<rect x="${bx1}" y="${by1}" width="${bw}" height="${bh}" rx="${br}" ry="${br}"
          fill="${g.color}22" stroke="${g.color}" stroke-width="${Math.max(1.5, 2*scale)}"
          stroke-dasharray="${Math.max(4,6*scale)} ${Math.max(3,4*scale)}" opacity="0.85"/>`;
        // Лінія-з'єднувач між столами
        for (let i = 0; i < rects.length - 1; i++) {
          const ra = rects[i], rb = rects[i+1];
          const cx1 = ra.l + ra.w/2, cy1 = ra.t + ra.h/2;
          const cx2 = rb.l + rb.w/2, cy2 = rb.t + rb.h/2;
          svgPaths += `<line x1="${cx1}" y1="${cy1}" x2="${cx2}" y2="${cy2}"
            stroke="${g.color}" stroke-width="${Math.max(2, 3*scale)}" opacity="0.45" stroke-linecap="round"/>`;
        }
        // Підпис групи
        const labelX = bx1 + bw / 2;
        const labelY = by1 - 4 * scale;
        const fsize = Math.max(8, 9 * scale);
        svgPaths += `<text x="${labelX}" y="${labelY}" text-anchor="middle"
          fill="${g.color}" font-size="${fsize}" font-weight="700" font-family="sans-serif"
          opacity="0.9">🔗 об'єднані столи</text>`;
      }
      svgOverlay = `<svg style="position:absolute;inset:0;width:${totalW}px;height:${totalH}px;pointer-events:none;overflow:visible" viewBox="0 0 ${totalW} ${totalH}">${svgPaths}</svg>`;
    }

    const tablesHtml = layout.tables.map(t => {
      // ── Роздільник / підпис зони ───────────────────────────────────
      if (t.type === 'divider') {
        const dw = (layout.cols - (t.x || 0)) * CELL;
        const dh = CELL_Y * (t.h || 0.4);
        const dleft = (t.x || 0) * CELL;
        const dtop  = t.y * CELL_Y + CELL_Y * 0.1;
        return `<div style="position:absolute;left:${dleft}px;top:${dtop}px;width:${dw}px;height:${dh}px;
          display:flex;align-items:center;gap:8px;pointer-events:none">
          <div style="flex:1;height:1px;background:rgba(255,255,255,.12)"></div>
          ${t.label ? `<span style="font-size:${Math.max(8,9*scale)}px;font-weight:700;color:rgba(255,255,255,.35);white-space:nowrap;text-transform:uppercase;letter-spacing:.06em">${esc(t.label)}</span>` : ''}
          <div style="flex:1;height:1px;background:rgba(255,255,255,.12)"></div>
        </div>`;
      }
      const info = Reserve.TYPE_INFO[t.type] || Reserve.TYPE_INFO['small'];
      const w = info.w * scale;
      const h = info.h * scale;
      const left = t.x * CELL + (CELL - w) / 2;
      const top  = t.y * CELL_Y + (CELL_Y - h) / 2;
      const isFireplace = t.type === 'fireplace';
      const fontSize = Math.max(9, 13 * scale);
      const seatsFontSize = Math.max(7, 9 * scale);
      const sizeLabel = hall === 'Літня тераса'
        ? (t.type === 'big' ? 'вел.' : t.type === 'small' ? 'мал.' : null)
        : null;
      const freeLine = `<div style="font-size:${seatsFontSize}px;opacity:.6;margin-top:2px">${sizeLabel ? sizeLabel + ' · ' : ''}вільно</div>`;
      const effBookings = isFireplace ? [] : Reserve.getEffectiveBookingsFor(hall, t.n);
      const seatsLine = effBookings.length
        ? `<div style="font-size:${seatsFontSize}px;opacity:.85;margin-top:2px;line-height:1.25">
             ${effBookings.map(b => `${b.guests} ос.<br>${esc(b.time || '—')}`).join('<hr style="border:none;border-top:1px solid rgba(255,255,255,.15);margin:2px 0">')}
           </div>`
        : freeLine;
      const status = isFireplace ? null : Reserve.getTableStatus(hall, t.n);
      const statusColor = status === 'occupied' ? 'var(--danger)' : status === 'booked' ? 'var(--warning)' : null;
      const statusDot = statusColor
        ? `<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;border:2px solid var(--eden-dark);background:${statusColor}"></div>`
        : '';

      // ── Стиль рамки: якщо стіл у групі об'єднання — кольорова рамка ──
      const mg = isFireplace ? null : getMergeGroup(t.n);
      const ring = mg
        ? `0 0 0 3px ${mg.color}, 0 0 14px ${mg.color}55, 0 2px 8px rgba(0,0,0,.25)`
        : status === 'occupied' ? '0 0 0 2px var(--danger), 0 2px 8px rgba(0,0,0,.25)'
        : status === 'booked'   ? '0 0 0 2px var(--warning), 0 2px 8px rgba(0,0,0,.25)'
        : '0 2px 8px rgba(0,0,0,.25)';
      const extraBorder = mg ? `border:2px solid ${mg.color}88;` : 'border:1px solid rgba(255,255,255,.08);';

      return `
        <div class="reserve-table" data-table="${esc(t.n)}" data-hall="${esc(hall)}"
          onclick="${isFireplace ? '' : `Reserve.onTableClick('${esc(hall)}','${esc(t.n)}','${t.type}')`}"
          style="position:absolute; left:${left}px; top:${top}px; width:${w}px; height:${h}px;
                 background:${info.bg}; border-radius:${info.radius};
                 ${extraBorder}
                 display:flex; flex-direction:column; align-items:center; justify-content:center;
                 color:${info.textColor || 'var(--text)'};
                 font-size:${fontSize}px; font-weight:700; text-align:center;
                 cursor:${isFireplace ? 'default' : 'pointer'};
                 box-shadow:${ring};
                 transition:.15s; user-select:none;"
          ${!isFireplace ? `onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"` : ''}
        >
          <div>${esc(t.n)}</div>
          ${seatsLine}
          ${statusDot}
        </div>`;
    }).join('');

    const width  = layout.cols * CELL;
    const height = layout.rows * CELL_Y;

    el.innerHTML = `
      ${layout.note ? `<div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;padding:8px 12px;
        background:var(--surface);border-radius:8px;border:1px solid var(--border)">
        ℹ️ ${esc(layout.note)}
      </div>` : ''}

      <div class="card" style="padding:16px${needsScroll ? ';overflow-x:auto' : ''}">
        <div style="position:relative; width:${width}px; height:${height}px; ${needsScroll ? '' : 'margin:0 auto'}">
          ${svgOverlay}
          ${tablesHtml}
        </div>
      </div>

      <!-- Легенда -->
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;font-size:11px;color:var(--text-dim)">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:16px;height:16px;border-radius:4px;background:linear-gradient(135deg,#3a3530,#2a2620)"></div> Великий стіл (6 ос.)
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,#33302a,#252220)"></div> Малий стіл (4 ос.)
        </div>
        ${hall === 'Літня тераса' ? `
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#2f3a33,#222a25)"></div> Круглий (без накриття, 4 ос.)
        </div>` : ''}
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
          <div style="width:10px;height:10px;border-radius:50%;background:var(--success)"></div> Вільний
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:10px;height:10px;border-radius:50%;background:var(--warning)"></div> Заброньовано
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:10px;height:10px;border-radius:50%;background:var(--danger)"></div> Зайнятий
        </div>
        ${mergeGroups.length ? `
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:14px;height:14px;border-radius:3px;border:2px dashed #d4a843;background:#d4a84322"></div> Об'єднані столи
        </div>` : ''}
      </div>
    `;
  },

  onTableClick(hall, tableNum, type) {
    const dk = Reserve._selectedDate || todayKey();
    const all = Reserve.getAllBookings();

    // Перевіряємо чи цей стіл є slave в чужому бронюванні (об'єднаний)
    let masterHall = null, masterTable = null, masterType = null;
    for (const key in all) {
      const [bHall, bTable] = key.split('::');
      if (bHall !== hall) continue;
      for (const b of all[key]) {
        if (b.date === dk && Array.isArray(b.mergedWith) && b.mergedWith.includes(tableNum)) {
          masterHall  = bHall;
          masterTable = bTable;
          const tObj  = Reserve.LAYOUTS[bHall]?.tables.find(t => t.n === bTable);
          masterType  = tObj?.type || 'small';
          break;
        }
      }
      if (masterTable) break;
    }

    if (masterTable) {
      // Клік на slave → показуємо модалку master-столу
      Reserve._modalHall  = masterHall;
      Reserve._modalTable = masterTable;
      Reserve._lastType   = masterType;
      const masterInfo = Reserve.TYPE_INFO[masterType] || Reserve.TYPE_INFO['small'];
      Reserve._renderModal(masterInfo);
      return;
    }

    // Власне бронювання або вільний стіл
    const info = Reserve.TYPE_INFO[type];
    Reserve._modalHall  = hall;
    Reserve._modalTable = tableNum;
    Reserve._lastType   = type;
    Reserve._renderModal(info);
  },

  // Зали де дозволено об'єднання столиків
  MERGE_HALLS: ['Загальний зал', 'Літня тераса'],

  _showNewBookingForm() {
    const el = document.getElementById('rb-new-form');
    if (!el) return;
    el.style.display = 'block';
    // Ховаємо кнопку
    const btn = el.previousElementSibling;
    if (btn) btn.style.display = 'none';
    // Скролимо до форми
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  _toggleMergeBtn(lblId, inputId) {
    const lbl = document.getElementById(lblId);
    const inp = document.getElementById(inputId);
    if (!lbl || !inp) return;
    inp.checked = !inp.checked;
    const tag = lbl.querySelector('.merge-tag');
    if (inp.checked) {
      lbl.style.border = '2px solid var(--gold)';
      lbl.style.background = 'rgba(212,175,55,.18)';
      lbl.style.boxShadow = '0 0 12px rgba(212,175,55,.35)';
      if (tag) { tag.textContent = '✓ ДОДАНО'; tag.style.color = 'var(--gold)'; }
    } else {
      lbl.style.border = '2px solid rgba(212,175,55,.25)';
      lbl.style.background = 'rgba(212,175,55,.05)';
      lbl.style.boxShadow = '';
      if (tag) { tag.textContent = '＋ ДОДАТИ'; tag.style.color = 'rgba(212,175,55,.45)'; }
    }
  },

  _renderMergeOptions(hall, tableNum) {
    if (!Reserve.MERGE_HALLS.includes(hall)) return '';

    const dk = Reserve._selectedDate || todayKey();
    const layout = Reserve.LAYOUTS[hall];
    if (!layout) return '';

    const tableNumVal = (s) => {
      const m = String(s).match(/[\d.]+/);
      return m ? parseFloat(m[0]) : 0;
    };

    const others = layout.tables
      .filter(t => Reserve.TYPE_INFO[t.type]?.seats > 0 && t.n !== tableNum)
      .filter(t => Reserve.getTableStatus(hall, t.n, dk) === 'free')
      .sort((a, b) => tableNumVal(a.n) - tableNumVal(b.n));

    if (!others.length) return '';

    return `
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:15px">🔗</span>
          <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--gold)">Об'єднати столи</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">
          ${others.map(t => {
            const seats = Reserve.TYPE_INFO[t.type]?.seats || 0;
            const typeLabel = (t.type === 'big' || t.type === 'big-8') ? 'великий' : (t.type === 'round' || t.type === 'round-big') ? 'круглий' : 'малий';
            const btnId = 'merge-' + String(t.n).replace(/[^a-z0-9]/gi,'-');
            return `
              <label id="lbl-${btnId}" for="${btnId}"
                style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  gap:4px;padding:12px 8px;border-radius:12px;cursor:pointer;user-select:none;
                  border:2px solid rgba(212,175,55,.25);background:rgba(212,175,55,.05);
                  transition:all .15s;min-height:72px"
                onclick="Reserve._toggleMergeBtn('lbl-${btnId}','${btnId}')">
                <input type="checkbox" class="rb-merge" id="${btnId}" value="${esc(t.n)}" style="display:none">
                <span style="font-size:22px;font-weight:800;color:var(--gold);line-height:1">${esc(t.n)}</span>
                <span style="font-size:10px;color:var(--text-dim);margin-top:2px">${typeLabel} · ${seats} ос.</span>
                <span class="merge-tag" style="font-size:10px;font-weight:700;color:rgba(212,175,55,.45);letter-spacing:.04em;margin-top:2px">＋ ДОДАТИ</span>
              </label>`;
          }).join('')}
        </div>
      </div>`;
  },

  _renderModal(info) {
    const hall = Reserve._modalHall;
    const tableNum = Reserve._modalTable;
    const bookings = Reserve.getBookingsFor(hall, tableNum);
    const dk = Reserve._selectedDate || todayKey();
    const hasBookings = bookings.length > 0;

    const bookingsHtml = bookings.length
      ? bookings.map((b, i) => {
          const statusColor = b.status === 'occupied' ? 'var(--danger)' : 'var(--warning)';
          const statusLabel = b.status === 'occupied' ? 'Зайнято' : 'Резерв';
          return `
          <div id="bview-${i}" style="border-radius:12px;overflow:hidden;margin-bottom:10px;
            border:1px solid rgba(255,255,255,.08);background:var(--surface)">

            <!-- Режим перегляду -->
            <div id="bview-view-${i}">
              ${b.photo ? `
              <div id="photo-wrap-${i}" style="overflow:hidden;position:relative;border-radius:12px 12px 0 0;
                background:#000;touch-action:pinch-zoom">
                <img src="${b.photo}" id="photo-img-${i}"
                  style="width:100%;max-height:60vh;object-fit:contain;display:block;
                    transform-origin:center center;transition:transform .1s;user-select:none"
                  onload="Reserve._initPhotoZoom('photo-wrap-${i}','photo-img-${i}')">
              </div>` : ''}
              <div style="padding:12px 14px">
                <div style="display:flex;align-items:flex-start;gap:10px">
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                      <span style="font-size:20px;font-weight:800;color:var(--gold)">${esc(b.time || '—')}</span>
                      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                        color:${statusColor};border:1px solid ${statusColor};
                        border-radius:4px;padding:1px 6px">${statusLabel}</span>
                    </div>
                    <div style="font-size:16px;font-weight:700;margin-bottom:4px">${esc(b.name)}</div>
                    <div style="font-size:12px;color:var(--text-dim);line-height:1.6">
                      👥 ${b.guests} ос.
                      ${b.phone ? `<br>📞 ${esc(b.phone)}` : ''}
                      ${b.menu ? `<br>🍽️ ${esc(b.menu)}` : ''}
                      ${Array.isArray(b.mergedWith) && b.mergedWith.length
                        ? `<br><span style="color:var(--gold)">🔗 + столи: ${b.mergedWith.map(esc).join(', ')}</span>` : ''}
                    </div>
                  </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                  <button class="btn btn-ghost" style="flex:1;padding:10px;font-size:13px;min-width:120px"
                    onclick="Reserve._switchToEdit(${i})">✏️ Редагувати</button>
                  <button class="btn btn-ghost" style="flex:1;padding:10px;font-size:13px;min-width:120px;
                    color:var(--success);border-color:rgba(90,175,122,.4)"
                    onclick="Reserve.tableFreed(${i})">✅ Стіл вільний</button>
                  <button class="btn btn-ghost" style="padding:10px 14px;color:var(--danger)"
                    onclick="Reserve.deleteBooking(${i})">🗑</button>
                </div>
              </div>
            </div>

            <!-- Режим редагування (прихований) -->
            <div id="bview-edit-${i}" style="display:none;padding:14px">
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;
                color:var(--gold);margin-bottom:12px">✏️ Редагування</div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                <div class="form-group">
                  <label class="lbl">Час</label>
                  <input type="time" class="field" id="re-time-${i}" value="${esc(b.time || '19:00')}">
                </div>
                <div class="form-group">
                  <label class="lbl">Гостей</label>
                  <input type="number" class="field" id="re-guests-${i}" value="${b.guests || 1}" min="1" max="30">
                </div>
              </div>
              <div class="form-group" style="margin-bottom:10px">
                <label class="lbl">Ім'я замовника</label>
                <input type="text" class="field" id="re-name-${i}" value="${esc(b.name || '')}">
              </div>
              <div class="form-group" style="margin-bottom:10px">
                <label class="lbl">Телефон</label>
                <input type="tel" class="field" id="re-phone-${i}" value="${esc(b.phone || '')}">
              </div>
              <div class="form-group" style="margin-bottom:10px">
                <label class="lbl">Меню</label>
                <input type="text" class="field" id="re-menu-${i}" value="${esc(b.menu || '')}">
              </div>
              <div class="form-group" style="margin-bottom:10px">
                <label class="lbl">Статус</label>
                <select class="field" id="re-status-${i}">
                  <option value="booked" ${b.status === 'booked' ? 'selected' : ''}>Резерв</option>
                  <option value="occupied" ${b.status === 'occupied' ? 'selected' : ''}>Зайнято</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="lbl">Фото</label>
                <input type="file" id="re-photo-file-${i}" accept="image/*" style="display:none"
                  onchange="Reserve._onPhotoSelectedFor(this, ${i})">
                <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
                  <button type="button" class="btn btn-ghost" style="padding:8px 14px;font-size:12px;border:1px dashed rgba(255,255,255,.2)"
                    onclick="document.getElementById('re-photo-file-${i}').click()">
                    📷 ${b.photo ? 'Змінити' : 'Додати фото'}
                  </button>
                  <div id="re-photo-preview-${i}" style="${b.photo ? '' : 'display:none;'}position:relative">
                    <img id="re-photo-img-${i}" src="${b.photo || ''}"
                      style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid var(--gold-border)">
                    <button type="button" onclick="Reserve._clearPhotoFor(${i})"
                      style="position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;
                        background:var(--danger);border:none;color:#fff;font-size:9px;cursor:pointer;padding:0;line-height:1">✕</button>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-gold" style="flex:1;padding:12px"
                  onclick="Reserve.saveEditBookingInline(${i})">💾 Зберегти</button>
                <button class="btn btn-ghost" style="padding:12px"
                  onclick="Reserve._switchToView(${i})">Скасувати</button>
              </div>
            </div>
          </div>`;
        }).join('')
      : `<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:12px">
           Немає бронювань на цю дату
         </div>`;

    showModal(`
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:21px;color:var(--gold);font-weight:700">
            Стіл ${esc(tableNum)}
          </div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">
            ${esc(hall)} · ${info?.label || ''} · ${info?.seats || '?'} місць
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:6px 10px">✕</button>
      </div>

      <div style="margin:16px 0">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
          color:var(--text-dim);margin-bottom:8px">Бронювання на вибрану дату</div>
        ${bookingsHtml}
      </div>

      ${hasBookings ? `
      <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:14px;text-align:center">
        <button class="btn btn-ghost" style="width:100%;padding:12px;font-size:13px;border:1px dashed rgba(255,255,255,.15)"
          onclick="Reserve._showNewBookingForm()">
          ＋ Додати ще бронювання на цей стіл
        </button>
      </div>
      <div id="rb-new-form" style="display:none;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;margin-top:12px">` : `
      <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:16px">`}
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
          color:var(--text-dim);margin-bottom:10px">${hasBookings ? 'Нове бронювання' : 'Нове бронювання'}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div class="form-group">
            <label class="lbl">Час</label>
            <input type="time" class="field" id="rb-time" value="19:00">
          </div>
          <div class="form-group">
            <label class="lbl">Кількість гостей</label>
            <input type="number" class="field" id="rb-guests" value="${info?.seats || 4}" min="1" max="30">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px">
          <label class="lbl">Ім'я замовника</label>
          <input type="text" class="field" id="rb-name" placeholder="Ім'я та прізвище">
        </div>

        <div class="form-group" style="margin-bottom:10px">
          <label class="lbl">Телефон</label>
          <input type="tel" class="field" id="rb-phone" placeholder="+380 XX XXX XXXX">
        </div>

        <div class="form-group" style="margin-bottom:16px">
          <label class="lbl">Меню (якщо замовлено заздалегідь)</label>
          <input type="text" class="field" id="rb-menu" placeholder="Напр.: банкетне меню №2 — залиште пустим якщо немає">
        </div>

        <div class="form-group" style="margin-bottom:16px">
          <label class="lbl">Фото (підтвердження, побажання гостя)</label>
          <input type="file" id="rb-photo-input" accept="image/*" capture="environment" style="display:none"
            onchange="Reserve._onPhotoSelected(this)">
          <div id="rb-photo-wrap" style="display:flex;align-items:center;gap:10px;margin-top:6px">
            <button type="button" class="btn btn-ghost" style="padding:10px 16px;font-size:13px;border:1px dashed rgba(255,255,255,.2)"
              onclick="document.getElementById('rb-photo-input').click()">
              📷 Додати фото
            </button>
            <div id="rb-photo-preview" style="display:none;position:relative">
              <img id="rb-photo-img" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--gold-border)">
              <button type="button" onclick="Reserve._clearPhoto()"
                style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;
                  background:var(--danger);border:none;color:#fff;font-size:10px;cursor:pointer;
                  display:flex;align-items:center;justify-content:center;padding:0;line-height:1">✕</button>
            </div>
          </div>
        </div>

        ${Reserve._renderMergeOptions(hall, tableNum)}

        <div style="display:flex;gap:10px">
          <button class="btn btn-gold" style="flex:1" onclick="Reserve.saveBooking()">
            ✅ Забронювати
          </button>
          <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
        </div>
      </div>
    `);
  },

  // Мапінг назв залів модуля "Резерв" на назви зон з DAILY_ZONES
  // (трохи відрізняються написанням — №2 vs 2)
  HALL_TO_ZONE: {
    'Загальний зал':  'Загальний зал',
    'Кабінки':        'Кабінки',
    'Нижній зал №2':  'Нижній зал 2',
    'Нижній зал №3':  'Нижній зал 3',
    'Камінний зал':   'Камінний зал',
    'Літня тераса':   'Літня тераса',
  },

  // Надсилає сповіщення про нове бронювання офіціантам,
  // призначеним на відповідну зону в обраний день
  // Знаходить chat_id/tg_id офіціантів призначених на зону залу в обраний день
  async _getZoneWaiterDestIds(hall, date) {
    const zoneName = Reserve.HALL_TO_ZONE[hall];
    if (!zoneName) return [];
    const zoneIdx = DAILY_ZONES.indexOf(zoneName);
    if (zoneIdx === -1) return [];

    const zonesKey = `duties_daily_zones_${date}`;

    let zones = DB.get(zonesKey, null);
    if (!zones) {
      try {
        const rows = await sb.query('settings', { filter:{ key: zonesKey }, select:'value', limit:1 });
        if (rows?.[0]?.value) {
          zones = JSON.parse(rows[0].value);
          DB.set(zonesKey, zones);
        }
      } catch(e) {}
    }
    zones = zones || {};

    const rawSaved = zones[String(zoneIdx)] !== undefined ? zones[String(zoneIdx)] : zones[zoneIdx];
    const assignedIds = Array.isArray(rawSaved) ? rawSaved.filter(Boolean) : (rawSaved ? [rawSaved] : []);
    if (!assignedIds.length) return [];

    const allUsers = getUsers();
    return assignedIds
      .map(uid => allUsers.find(x => x.id === uid))
      .filter(Boolean)
      .map(u => u.chat_id || u.tg_id)
      .filter(Boolean);
  },

  async tableFreed(idx) {
    const hall = Reserve._modalHall;
    const tableNum = Reserve._modalTable;
    const dk = Reserve._selectedDate || todayKey();
    const all = Reserve.getAllBookings();
    const key = `${hall}::${tableNum}`;
    if (!all[key]) return;

    // Знаходимо realIdx
    let seen = -1, realIdx = -1;
    for (let i = 0; i < all[key].length; i++) {
      if (all[key][i].date === dk) { seen++; if (seen === idx) { realIdx = i; break; } }
    }
    if (realIdx === -1) return;
    const booking = all[key][realIdx];

    showConfirm(
      `Позначити стіл ${esc(tableNum)} як вільний і повідомити офіціантів?`,
      async () => {
        // Видаляємо бронювання
        const [removed] = all[key].splice(realIdx, 1);
        await Reserve.saveAllBookings(all);

        toast('✅ Стіл звільнено', 'success-t');
        Reserve.renderContent();
        Reserve.renderTablesList();
        Reserve.renderStrip();

        // Повідомлення офіціантам зони
        await Reserve.notifyZoneWaitersFreed(removed, hall, tableNum);

        closeModal();
      },
      { okLabel: '✅ Стіл вільний', okClass: 'btn-gold', cancelLabel: 'Скасувати' }
    );
  },

  async notifyZoneWaitersFreed(booking, hall, tableNum) {
    try {
      const destIds = await Reserve._getZoneWaiterDestIds(hall, booking.date);
      if (!destIds.length) return;

      const MONTHS_UA = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
      const [yy, mm, dd] = booking.date.split('-').map(Number);
      const dateLabel = `${dd} ${MONTHS_UA[mm-1]}`;

      const tablesLabel = Array.isArray(booking.mergedWith) && booking.mergedWith.length
        ? `${esc(tableNum)} + ${booking.mergedWith.map(esc).join(', ')}`
        : esc(tableNum);

      const msg = [
        `🟢 <b>Стіл звільнився</b>`,
        `📍 ${esc(hall)} · стіл ${tablesLabel}`,
        `📅 ${dateLabel} · 🕐 ${esc(booking.time || '—')}`,
        `👤 ${esc(booking.name)} · 👥 ${booking.guests} ос.`,
        ``,
        `<i>Стіл готовий до прийому нових гостей</i>`,
      ].filter(Boolean).join('\n');

      for (const destId of destIds) await tgSendPersonal(destId, msg);
    } catch(e) { console.error('Reserve.notifyZoneWaitersFreed error:', e); }
  },

  async notifyZoneWaiters(booking, hall, tableNum) {
    try {
      const destIds = await Reserve._getZoneWaiterDestIds(hall, booking.date);
      if (!destIds.length) return;

      const MONTHS_UA = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
      const [yy, mm, dd] = booking.date.split('-').map(Number);
      const dateLabel = `${dd} ${MONTHS_UA[mm-1]}`;

      const tablesLabel = Array.isArray(booking.mergedWith) && booking.mergedWith.length
        ? `${esc(tableNum)} + ${booking.mergedWith.map(esc).join(', ')}`
        : esc(tableNum);

      const msg = [
        `🔔 <b>Нове бронювання</b>`,
        `📍 ${esc(hall)} · стіл ${tablesLabel}`,
        `📅 ${dateLabel} · 🕐 ${esc(booking.time || '—')}`,
        `👤 ${esc(booking.name)}`,
        `👥 ${booking.guests} ос.`,
        booking.phone ? `📞 ${esc(booking.phone)}` : '',
        booking.menu  ? `🍽️ ${esc(booking.menu)}` : '',
        booking.status === 'occupied' ? `⚠️ <b>Зал/стіл закрито для гостей</b>` : '',
      ].filter(Boolean).join('\n');

      for (const destId of destIds) {
        if (booking.photo) {
          // Відправляємо фото з підписом через Edge Function
          try {
            await fetch(EDGE_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
              body: JSON.stringify({
                action: 'send_photo_personal',
                chat_id: destId,
                photoBase64: booking.photo,
                caption: msg,
              })
            });
          } catch(e) {
            // Fallback — текст без фото
            await tgSendPersonal(destId, msg + '\n📷 <i>Фото є в порталі</i>');
          }
        } else {
          await tgSendPersonal(destId, msg);
        }
      }
    } catch(e) { console.error('Reserve.notifyZoneWaiters error:', e); }
  },

  async notifyZoneWaitersCancel(booking, hall, tableNum) {
    try {
      const destIds = await Reserve._getZoneWaiterDestIds(hall, booking.date);
      if (!destIds.length) return;

      const MONTHS_UA = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
      const [yy, mm, dd] = booking.date.split('-').map(Number);
      const dateLabel = `${dd} ${MONTHS_UA[mm-1]}`;

      const tablesLabel = Array.isArray(booking.mergedWith) && booking.mergedWith.length
        ? `${esc(tableNum)} + ${booking.mergedWith.map(esc).join(', ')}`
        : esc(tableNum);

      const msg = [
        `❌ <b>Бронювання скасовано</b>`,
        `📍 ${esc(hall)} · стіл ${tablesLabel}`,
        `📅 ${dateLabel} · 🕐 ${esc(booking.time || '—')}`,
        `👤 ${esc(booking.name)}`,
      ].filter(Boolean).join('\n');

      for (const destId of destIds) await tgSendPersonal(destId, msg);
    } catch(e) { console.error('Reserve.notifyZoneWaitersCancel error:', e); }
  },

  _pendingPhoto: '',

  _onPhotoSelected(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      // Стискаємо через canvas до макс 800px і якість 0.7
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        Reserve._pendingPhoto = compressed;
        const imgEl = document.getElementById('rb-photo-img');
        const preview = document.getElementById('rb-photo-preview');
        const wrap = document.getElementById('rb-photo-wrap');
        if (imgEl) imgEl.src = compressed;
        if (preview) preview.style.display = 'block';
        // Міняємо кнопку
        const btn = wrap?.querySelector('button:first-child');
        if (btn) btn.textContent = '📷 Змінити фото';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  _clearPhoto() {
    Reserve._pendingPhoto = '';
    const inp = document.getElementById('rb-photo-input');
    const preview = document.getElementById('rb-photo-preview');
    const wrap = document.getElementById('rb-photo-wrap');
    if (inp) inp.value = '';
    if (preview) preview.style.display = 'none';
    const btn = wrap?.querySelector('button:first-child');
    if (btn) btn.textContent = '📷 Додати фото';
  },

  _initPhotoZoom(wrapId, imgId) {
    const wrap = document.getElementById(wrapId);
    const img  = document.getElementById(imgId);
    if (!wrap || !img) return;
    let scale = 1, lastScale = 1;
    let originX = 0, originY = 0;
    let startDist = 0;

    const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));
    const apply = () => { img.style.transform = `scale(${scale})`; };

    // Pinch zoom
    wrap.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist = Math.hypot(dx, dy);
        lastScale = scale;
        e.preventDefault();
      }
    }, { passive: false });

    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        scale = clamp(lastScale * (dist / startDist), 1, 4);
        apply();
        e.preventDefault();
      }
    }, { passive: false });

    // Подвійний тап — скидання
    let lastTap = 0;
    wrap.addEventListener('touchend', e => {
      if (e.touches.length === 0) {
        const now = Date.now();
        if (now - lastTap < 280) { scale = scale > 1 ? 1 : 2.5; apply(); }
        lastTap = now;
      }
    });

    // Мишка (desktop)
    wrap.addEventListener('wheel', e => {
      scale = clamp(scale + (e.deltaY < 0 ? 0.2 : -0.2), 1, 4);
      apply();
      e.preventDefault();
    }, { passive: false });
  },

  // ── Перемикання view/edit inline ────────────────────────────────────
  _switchToEdit(i) {
    const view = document.getElementById('bview-view-' + i);
    const edit = document.getElementById('bview-edit-' + i);
    if (view) view.style.display = 'none';
    if (edit) { edit.style.display = 'block'; edit.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
  },

  _switchToView(i) {
    const view = document.getElementById('bview-view-' + i);
    const edit = document.getElementById('bview-edit-' + i);
    if (edit) edit.style.display = 'none';
    if (view) view.style.display = 'block';
    Reserve._pendingPhotoFor = {};
  },

  _pendingPhotoFor: {},

  _onPhotoSelectedFor(input, i) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        Reserve._pendingPhotoFor[i] = compressed;
        const imgEl = document.getElementById('re-photo-img-' + i);
        const preview = document.getElementById('re-photo-preview-' + i);
        if (imgEl) imgEl.src = compressed;
        if (preview) preview.style.display = 'block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  _clearPhotoFor(i) {
    Reserve._pendingPhotoFor[i] = null; // null = видалити
    const inp = document.getElementById('re-photo-file-' + i);
    const preview = document.getElementById('re-photo-preview-' + i);
    if (inp) inp.value = '';
    if (preview) preview.style.display = 'none';
  },

  async saveEditBookingInline(idx) {
    const hall = Reserve._modalHall;
    const tableNum = Reserve._modalTable;
    const key = `${hall}::${tableNum}`;
    const dk = Reserve._selectedDate || todayKey();

    // Знаходимо realIdx
    const all = Reserve.getAllBookings();
    if (!all[key]) return;
    let seen = -1, realIdx = -1;
    for (let i = 0; i < all[key].length; i++) {
      if (all[key][i].date === dk) { seen++; if (seen === idx) { realIdx = i; break; } }
    }
    if (realIdx === -1) return;

    const time   = document.getElementById('re-time-' + idx)?.value || '';
    const guests = Number(document.getElementById('re-guests-' + idx)?.value) || 1;
    const name   = document.getElementById('re-name-' + idx)?.value.trim() || '';
    const phone  = document.getElementById('re-phone-' + idx)?.value.trim() || '';
    const menu   = document.getElementById('re-menu-' + idx)?.value.trim() || '';
    const status = document.getElementById('re-status-' + idx)?.value || 'booked';

    if (!name) { toast("Вкажіть ім'я замовника", 'error-t'); return; }

    const existing = all[key][realIdx];
    all[key][realIdx] = {
      ...existing,
      time, guests, name, phone, menu, status,
      updatedBy: currentUser?.displayName || currentUser?.login || '',
      updatedAt: new Date().toISOString(),
    };

    // Фото
    const pendingPhoto = Reserve._pendingPhotoFor[idx];
    if (pendingPhoto === null) {
      delete all[key][realIdx].photo; // видалено
    } else if (pendingPhoto) {
      all[key][realIdx].photo = pendingPhoto;
    }

    await Reserve.saveAllBookings(all);
    Reserve._pendingPhotoFor = {};

    toast('✅ Резерв оновлено', 'success-t');
    Reserve.renderContent();
    Reserve.renderTablesList();
    Reserve.renderStrip();

    // Перерендер модалки
    const info = Reserve.TYPE_INFO[Reserve._lastType] || {};
    Reserve._renderModal(info);
  },

  // Залишаємо editBooking тільки як аліас (для сумісності)
  editBooking(idx) { Reserve._switchToEdit(idx); },

    async saveBooking() {
    const time   = $('rb-time').value;
    const guests = Number($('rb-guests').value) || 1;
    const name   = $('rb-name').value.trim();
    const phone  = $('rb-phone').value.trim();
    const menu   = $('rb-menu').value.trim();
    const mergedWith = Array.from(document.querySelectorAll('.rb-merge:checked')).map(el => el.value);
    const photo = Reserve._pendingPhoto || '';

    if (!name) { toast("Вкажіть ім'я замовника", 'error-t'); return; }

    const hall = Reserve._modalHall;
    const tableNum = Reserve._modalTable;
    const key = `${hall}::${tableNum}`;

    const all = Reserve.getAllBookings();
    if (!all[key]) all[key] = [];
    const newBooking = {
      date: Reserve._selectedDate || todayKey(),
      time, guests, name, phone, menu,
      status: 'booked',
      createdBy: currentUser?.displayName || currentUser?.login || '',
      createdAt: new Date().toISOString(),
    };
    if (mergedWith.length) newBooking.mergedWith = mergedWith;
    if (photo) newBooking.photo = photo;
    Reserve._pendingPhoto = '';
    all[key].push(newBooking);

    await Reserve.saveAllBookings(all);
    closeModal();
    toast(`✅ Стіл ${tableNum} заброньовано на ${time}`, 'success-t');
    Reserve.renderContent();
    Reserve.renderTablesList();
    Reserve.renderStrip();

    // Сповіщаємо офіціантів призначених на цю зону
    Reserve.notifyZoneWaiters(newBooking, hall, tableNum);
  },

  // Спільна логіка видалення бронювання за реальним індексом у all[key]
  async _removeBooking(hall, tableNum, realIdx) {
    const key = `${hall}::${tableNum}`;
    const all = Reserve.getAllBookings();
    if (!all[key] || !all[key][realIdx]) return null;

    const removed = all[key][realIdx];
    all[key].splice(realIdx, 1);
    if (!all[key].length) delete all[key];

    await Reserve.saveAllBookings(all);
    return removed;
  },

  async deleteBooking(idx) {
    const hall = Reserve._modalHall;
    const tableNum = Reserve._modalTable;
    const key = `${hall}::${tableNum}`;
    const dk = Reserve._selectedDate || todayKey();

    const all = Reserve.getAllBookings();
    if (!all[key]) return;

    // idx — індекс у відфільтрованому за датою списку; знаходимо реальний індекс
    let seen = -1, realIdx = -1;
    for (let i = 0; i < all[key].length; i++) {
      if (all[key][i].date === dk) {
        seen++;
        if (seen === idx) { realIdx = i; break; }
      }
    }
    if (realIdx === -1) return;

    const removed = await Reserve._removeBooking(hall, tableNum, realIdx);
    if (!removed) return;

    toast('Бронювання видалено', 'success-t');
    Reserve.renderContent();
    Reserve.renderTablesList();
    Reserve.renderStrip();
    Reserve.notifyZoneWaitersCancel(removed, hall, tableNum);

    // Перерендерити модалку з оновленим списком
    const info = Reserve.TYPE_INFO[Reserve._lastType] || {};
    Reserve._renderModal(info);
  },

  // Видалення прямо зі списку бронювань (✕)
  async deleteBookingFromList(hall, tableNum, realIdx) {
    showConfirm('Скасувати це бронювання?', async () => {
      const removed = await Reserve._removeBooking(hall, tableNum, realIdx);
      if (!removed) return;
      toast('Бронювання скасовано', 'success-t');
      Reserve.renderContent();
      Reserve.renderTablesList();
      Reserve.renderStrip();
      Reserve.notifyZoneWaitersCancel(removed, hall, tableNum);
    }, { okLabel: '🗑 Скасувати', okClass: 'btn-danger', cancelLabel: 'Ні' });
  },


  // ── Drag & drop для перепорядкування залів ────────────────
  _dragIdx: null,

  _onDragStart(e) {
    Reserve._dragIdx = Number(e.currentTarget.dataset.idx);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
  },

  _onDragOver(e) {
    e.preventDefault();
  },

  _onDrop(e) {
    e.preventDefault();
    const dropIdx = Number(e.currentTarget.dataset.idx);
    const dragIdx = Reserve._dragIdx;
    if (dragIdx === null || dragIdx === dropIdx) return;

    const halls = Reserve.getHalls();
    const [moved] = halls.splice(dragIdx, 1);
    halls.splice(dropIdx, 0, moved);
    Reserve.setHalls(halls);
    Reserve.renderTabs();
  },

  _onDragEnd(e) {
    e.currentTarget.style.opacity = '';
    Reserve._dragIdx = null;
  },
};

