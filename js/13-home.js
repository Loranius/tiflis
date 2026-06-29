// ── Головна сторінка ──────────────────────────────────────────
// SVG іконки для головної сторінки
const HOME_ICONS = {
  schedule:      `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><rect x="6" y="8" width="28" height="26" rx="3"/><line x1="6" y1="15" x2="34" y2="15"/><line x1="14" y1="5" x2="14" y2="11"/><line x1="26" y1="5" x2="26" y2="11"/><rect x="11" y="20" width="4" height="4" rx="1"/><rect x="18" y="20" width="4" height="4" rx="1"/><rect x="25" y="20" width="4" height="4" rx="1"/><rect x="11" y="27" width="4" height="4" rx="1"/><rect x="18" y="27" width="4" height="4" rx="1"/></svg>`,
  cash:          `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M20 6c-5 0-9 5-9 11s4 9 9 9 9-3 9-9-4-11-9-11z"/><path d="M20 10v2m0 8v2"/><path d="M17 14.5c0-1.1.9-2 2-2h2.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H21c1.1 0 2-.9 2-2"/><path d="M11 28c-3 1-5 3-5 5h28c0-2-2-4-5-5"/></svg>`,
  rating:        `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><polygon points="20,5 24,15 35,15 26,22 29,33 20,27 11,33 14,22 5,15 16,15"/></svg>`,
  staff:         `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><circle cx="14" cy="13" r="5"/><circle cx="26" cy="13" r="5"/><path d="M4 34c0-5.5 4.5-9 10-9"/><path d="M36 34c0-5.5-4.5-9-10-9"/><path d="M14 25c0-5.5 2.7-9 6-9s6 3.5 6 9v9H14v-9z"/></svg>`,
  menu:          `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M10 6h20v28H10z"/><line x1="15" y1="12" x2="25" y2="12"/><line x1="15" y1="18" x2="25" y2="18"/><line x1="15" y1="24" x2="22" y2="24"/><path d="M25 22l3 3-6 6-3-3 6-6z"/></svg>`,
  handover:      `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M10 8h14l6 6v18H10V8z"/><polyline points="24,8 24,14 30,14"/><line x1="15" y1="20" x2="25" y2="20"/><line x1="15" y1="26" x2="21" y2="26"/><path d="M24 29l4-4 4 4"/></svg>`,
  daily:         `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><rect x="8" y="6" width="24" height="28" rx="2"/><line x1="13" y1="13" x2="27" y2="13"/><polyline points="13,19 16,22 20,17"/><line x1="22" y1="19" x2="27" y2="19"/><polyline points="13,27 16,30 20,25"/><line x1="22" y1="27" x2="27" y2="27"/></svg>`,
  notifications: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M20 6a10 10 0 0 1 10 10v8l3 4H7l3-4v-8A10 10 0 0 1 20 6z"/><path d="M17 32a3 3 0 0 0 6 0"/></svg>`,
  proiob:        `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M4 18c1-1 3-1 4 0l3 3c1 1 3 1 4 0"/><path d="M4 18c0-2 1-4 3-4 1 0 2 1 2 2v5"/><path d="M36 18c-1-1-3-1-4 0l-3 3c-1 1-3 1-4 0"/><path d="M36 18c0-2-1-4-3-4-1 0-2 1-2 2v5"/><path d="M17 24c1 1 3 2 3 4v4"/><path d="M23 24c-1 1-3 2-3 4"/><line x1="17" y1="10" x2="23" y2="10"/><path d="M21 7v6"/><path d="M19 8.5c0-.8.6-1.5 1.5-1.5H22a1 1 0 0 1 0 2h-2a1 1 0 0 0 0 2h1.5a1 1 0 0 1 0 2H19"/></svg>`,
  proiob:        `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M4 18c1-1 3-1 4 0l3 3c1 1 3 1 4 0"/><path d="M4 18c0-2 1-4 3-4 1 0 2 1 2 2v5"/><path d="M36 18c-1-1-3-1-4 0l-3 3c-1 1-3 1-4 0"/><path d="M36 18c0-2-1-4-3-4-1 0-2 1-2 2v5"/><path d="M17 24c1 1 3 2 3 4v4"/><path d="M23 24c-1 1-3 2-3 4"/><line x1="17" y1="10" x2="23" y2="10"/><path d="M21 7v6"/><path d="M19 8.5c0-.8.6-1.5 1.5-1.5H22a1 1 0 0 1 0 2h-2a1 1 0 0 0 0 2h1.5a1 1 0 0 1 0 2H19"/></svg>`,
  interactive:   `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><rect x="5" y="12" width="30" height="20" rx="4"/><line x1="20" y1="6" x2="20" y2="12"/><circle cx="13" cy="22" r="2"/><line x1="13" y1="18" x2="13" y2="20"/><line x1="13" y1="24" x2="13" y2="26"/><line x1="11" y1="22" x2="9" y2="22"/><line x1="17" y1="22" x2="15" y2="22"/><circle cx="27" cy="20" r="1.5" fill="currentColor"/><circle cx="27" cy="26" r="1.5" fill="currentColor"/></svg>`,
  admin:         `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><circle cx="20" cy="20" r="4"/><path d="M20 6v4M20 30v4M6 20h4M30 20h4M9.4 9.4l2.8 2.8M27.8 27.8l2.8 2.8M30.6 9.4l-2.8 2.8M12.2 27.8l-2.8 2.8"/><circle cx="20" cy="20" r="10" stroke-dasharray="2 3"/></svg>`,
  reserve:       `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><rect x="6" y="8" width="28" height="26" rx="3"/><line x1="6" y1="15" x2="34" y2="15"/><line x1="14" y1="5" x2="14" y2="11"/><line x1="26" y1="5" x2="26" y2="11"/><polyline points="14,24 18,28 27,19"/></svg>`,
};

const Home = {
  init() {
    const u = currentUser;

    // ── Роль "Ранер" — окремий спрощений інтерфейс ──────────────
    if (u.role === 'runner' || u.role2 === 'runner') {
      Home.renderRunner();
      return;
    }

    const allItems = App.getNavItems();
    const order = App.getNavOrder();

    const sorted = [...allItems].sort((a, b) => {
      const ia = order.indexOf(a.page);
      const ib = order.indexOf(b.page);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const visible = sorted.filter(item => {
      if (item.page === 'cash' && u.role !== 'waiter' && !isSysadmin(u)) return false;
      if (item.adminOnly && !isAdmin(u)) return false;
      if (item.proiobOnly && !canAccessProiob(u)) return false;
      if (!isSysadmin(u) && !App.isPageVisible(item.page, u.id)) return false;
      return true;
    });

    // Розбиваємо на: сіткові плитки (2 колонки) і широкі кнопки (повна ширина)
    const WIDE_PAGES = ['notifications', 'admin'];
    const HERO_PAGES = ['schedule']; // герой — на весь рядок зверху
    const heroItems  = visible.filter(i => HERO_PAGES.includes(i.page));
    const gridItems  = visible.filter(i => !WIDE_PAGES.includes(i.page) && !HERO_PAGES.includes(i.page));
    const wideItems  = visible.filter(i => WIDE_PAGES.includes(i.page));

    // Підписи під плитками — короткий контекст
    const HOME_SUBS = {
      schedule:      'графік місяця',
      cash:          'мої надходження',
      rating:        'оцінки команди',
      staff:         'команда ресторану',
      menu:          'страви та напої',
      handover:      'здача зміни',
      daily:         'чек-лист дня',
      notifications: 'сповіщення',
    };

    // Динамічний підпис для каси — місце в рейтингу за поточний період
    const cashRankSub = (() => {
      if (currentUser.role !== 'waiter' && !isSysadmin(currentUser)) return HOME_SUBS.cash;
      const n = NOW();
      const y = n.getFullYear(), mo = n.getMonth(), day = n.getDate();
      let from, to;
      if (day <= 14) {
        from = new Date(y, mo, 1);
        to   = new Date(y, mo, 14, 23, 59, 59);
      } else {
        to   = new Date(y, mo + 1, 0, 23, 59, 59);
        from = new Date(y, mo, 15);
      }
      const cashDB = DB.get('cash', {});
      const waiters = getUsers().filter(u => u.role === 'waiter');
      const ranked = waiters.map(u => {
        const entries = cashDB[u.id] || {};
        const total = Object.entries(entries)
          .filter(([dk]) => { const d = parseDateKey(dk); return d >= from && d <= to; })
          .reduce((s, [, v]) => s + ((v.firstCash != null) ? v.firstCash : (v.cash || 0)), 0);
        return { uid: u.id, total };
      }).sort((a, b) => b.total - a.total);
      const myId = isSysadmin(currentUser) ? (Cash.viewUserId || currentUser.id) : currentUser.id;
      const pos = ranked.findIndex(r => r.uid === myId);
      if (pos < 0 || ranked.every(r => r.total === 0)) return 'мої надходження';
      return `#${pos+1} місце в рейтингу`;
    })();

    // ── Герой-плитка: Графік — проста широка кнопка ──
    const heroHTML = heroItems.map(item => `
      <div onclick="App.navigate('${item.page}')" class="home-hero-tile">
        <div class="home-hero-tile-icon">${HOME_ICONS[item.page]||'📅'}</div>
        <div class="home-hero-tile-body">
          <div class="home-hero-tile-label">${item.label.toUpperCase()}</div>
        </div>
        <div style="font-size:18px;color:rgba(212,175,55,.4)">›</div>
      </div>`).join('');

    const gridHTML = gridItems.length ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        ${gridItems.map(item => {
          const sub = item.page === 'cash' ? cashRankSub : (HOME_SUBS[item.page] || '');
          return `
          <div onclick="App.navigate('${item.page}')" class="home-icon-tile">
            <div class="home-icon-tile-icon">${HOME_ICONS[item.page] || '<span style="font-size:32px">'+item.icon+'</span>'}</div>
            <div class="home-icon-tile-label">${item.label.toUpperCase()}</div>
            ${sub ? `<div class="home-icon-tile-sub">${sub}</div>` : ''}
          </div>`;
        }).join('')}
      </div>` : '';

    // Для не-адмінів: замінюємо плитку "Управління" на "Налаштування"
    const wideHTML = wideItems.map(item => {
      // Якщо це admin-плитка — вона вже відфільтрована через adminOnly для не-адмінів
      return `
      <div onclick="App.navigate('${item.page}')" class="home-wide-tile">
        <div class="home-icon-tile-icon" style="width:28px;height:28px">${HOME_ICONS[item.page] || '<span style="font-size:20px">'+item.icon+'</span>'}</div>
        <span class="home-icon-tile-label" style="font-size:11px;letter-spacing:.15em">${item.label.toUpperCase()}</span>
      </div>`;
    }).join('');

    // Не-адміни: плитка "Налаштування" замість "Управління"
    const settingsHTML = !isAdmin(currentUser) ? `
      <div onclick="App.navigate('admin')" class="home-wide-tile">
        <div class="home-icon-tile-icon" style="width:28px;height:28px">${HOME_ICONS['admin']}</div>
        <span class="home-icon-tile-label" style="font-size:11px;letter-spacing:.15em">НАЛАШТУВАННЯ</span>
      </div>` : '';

    $('home-tiles').innerHTML = heroHTML + gridHTML + wideHTML + settingsHTML;

    // Вітання за київським часом
    const kyivHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' })).getHours();
    let greetWord;
    if (kyivHour >= 5 && kyivHour < 12)       greetWord = 'Добрий ранок';
    else if (kyivHour >= 12 && kyivHour < 18)  greetWord = 'Добрий день';
    else if (kyivHour >= 18 && kyivHour < 23)  greetWord = 'Добрий вечір';
    else                                        greetWord = 'Доброї ночі';

    const greetName = currentUser?.displayName || currentUser?.login || '';
    const greetEl = $('home-greeting');
    const greetNameEl = $('home-greeting-name');
    if (greetEl) greetEl.textContent = greetWord + ',';
    if (greetNameEl) greetNameEl.textContent = greetName;
  },

  // ── Інтерфейс ранера: список офіціантів що працюють сьогодні ──
  renderRunner() {
    const greetEl = $('home-greeting');
    const greetNameEl = $('home-greeting-name');
    const kyivHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' })).getHours();
    let greetWord;
    if (kyivHour >= 5 && kyivHour < 12)       greetWord = 'Добрий ранок';
    else if (kyivHour >= 12 && kyivHour < 18)  greetWord = 'Добрий день';
    else if (kyivHour >= 18 && kyivHour < 23)  greetWord = 'Добрий вечір';
    else                                        greetWord = 'Доброї ночі';
    if (greetEl) greetEl.textContent = greetWord + ',';
    if (greetNameEl) greetNameEl.textContent = currentUser?.displayName || currentUser?.login || '';

    const dk = todayKey();
    const schedule = DB.get('schedule', {});
    const OFF_SHIFTS = new Set(['Х', 'О', 'С']);
    const waiters = getUsers().filter(u => {
      if (u.role !== 'waiter' && u.role2 !== 'waiter') return false;
      const shift = schedule[`${u.id}_${dk}`];
      if (!shift || shift.trim() === '') return false;
      return !OFF_SHIFTS.has(shift);
    });

    if (!waiters.length) {
      $('home-tiles').innerHTML = `
        <div class="card" style="padding:24px;text-align:center;color:var(--text-dim);font-size:13px">
          Сьогодні немає офіціантів у графіку
        </div>`;
      return;
    }

    $('home-tiles').innerHTML = `
      <div class="card-title">Офіціанти на зміні сьогодні</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${waiters.map(w => {
          const shift = schedule[`${w.id}_${dk}`] || '';
          return `
            <button class="btn btn-gold" style="width:100%;padding:16px;font-size:16px;
              display:flex;align-items:center;justify-content:space-between;text-align:left"
              onclick="Home.notifyWaiterPickup('${w.id}')">
              <span>${esc(w.displayName || w.login)}</span>
              <span style="font-size:11px;opacity:.7;font-weight:600">${esc(shift)}</span>
            </button>`;
        }).join('')}
      </div>`;
  },

  // Сповіщає офіціанта що страву винесли і треба підійти забрати
  async notifyWaiterPickup(waiterId) {
    const allUsers = getUsers();
    const w = allUsers.find(u => u.id === waiterId);
    if (!w) return;
    const destId = w.chat_id || w.tg_id;
    if (!destId) {
      toast(`У ${w.displayName || w.login} не підʼєднано Telegram`, 'error-t');
      return;
    }
    const msg = `🍽️ <b>Страву винесли!</b>\nПідійдіть, будь ласка, забрати.`;
    try {
      await tgSendPersonal(destId, msg);
      toast(`✅ Сповіщено: ${w.displayName || w.login}`, 'success-t');
    } catch(e) {
      toast('Помилка надсилання', 'error-t');
    }
  },
};

