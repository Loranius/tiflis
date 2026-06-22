// ╔═══════════════════════════════════════════════════════════════╗
// ║  [6/13]  APP + СЕСІЯ (навігація, логін, ініціалізація)        ║
// ╚═══════════════════════════════════════════════════════════════╝
let currentUser = null;
// Генерує випадковий session token
function _genToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

// Cookie helpers (для Telegram In-App Browser)
function _setCookie(name, value, days=365) {
  const exp = new Date(Date.now() + days*864e5).toUTCString();
  // SameSite=None;Secure потрібен для Telegram WebApp (cross-site webview)
  const secure = location.protocol === 'https:' ? ';Secure' : '';
  const sameSite = secure ? ';SameSite=None' : '';
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp};path=/${sameSite}${secure}`;
}
function _getCookie(name) {
  const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
  return m ? decodeURIComponent(m[1]) : null;
}

const App = {
  async login() {
    const login = $('li').value.trim();
    const pass  = $('lp').value;
    const errEl = $('login-err');
    if (!login || !pass) { errEl.textContent='Введіть логін та пароль'; errEl.classList.remove('hidden'); return; }

    const btn = document.querySelector('#login-screen .btn-gold');
    btnLock(btn);

    try {
      const users = await sb.query('users', { filter: { login } });
      const user = users.find(u => u.password === pass);
      if (!user) { errEl.textContent='Невірний логін або пароль'; errEl.classList.remove('hidden'); btnUnlock(btn); return; }
      if (user.fired) { errEl.textContent='Акаунт заблоковано'; errEl.classList.remove('hidden'); btnUnlock(btn); return; }

      // Зберегти сесію: localStorage + cookie + Supabase sessions
      const _sessionData = JSON.stringify({ login, password: pass });
      try { localStorage.setItem('tiflis_session', _sessionData); } catch(e) {}
      try { sessionStorage.setItem('tiflis_session', _sessionData); } catch(e) {}
      // Токен для Telegram (cookie зберігається навіть у In-App Browser)
      try {
        const _tok = _genToken();
        _setCookie('tiflis_tok', _tok);
        // Зберігаємо токен → login:password в Supabase (TTL = 365 днів)
        const _expiry = new Date(Date.now() + 365*864e5).toISOString();
        sb.upsert('sessions', { token: _tok, login, password: pass, expires_at: _expiry }, 'token').catch(()=>{});
      } catch(e) {}

      await App.loadCache();
      currentUser = { ...user, displayName: user.display_name, tg: user.tg_username || user.tg || '' };
      errEl.classList.add('hidden');
      $('login-screen').remove();
      $('app').classList.remove('hidden');
      App.initUI();
      const _loginLastPage = localStorage.getItem('tiflis_last_page') || 'home';
      App.navigate(_loginLastPage);
      App.startPolling();
      setTimeout(() => logEvent('auth', 'Вхід в систему'), 500);
    } catch(e) {
      errEl.textContent = 'Помилка з\'єднання з сервером';
      errEl.classList.remove('hidden');
      btnUnlock(btn);
      console.error(e);
    }
  },

  async restoreSession() {
    try {
      // Читаємо сесію: localStorage → sessionStorage → URL hash (для Telegram)
      let saved = null;
      try { saved = localStorage.getItem('tiflis_session'); } catch(e) {}
      if (!saved) { try { saved = sessionStorage.getItem('tiflis_session'); } catch(e) {} }
      if (!saved) {
        // Пробуємо відновити через cookie → Supabase session token (для Telegram)
        try {
          const _tok = _getCookie('tiflis_tok');
          if (_tok) {
            const rows = await sb.query('sessions', {
              filter: { token: _tok },
              select: 'login,password,expires_at',
              limit: 1,
            });
            if (rows?.[0]) {
              const row = rows[0];
              // Перевіряємо TTL
              if (!row.expires_at || new Date(row.expires_at) > new Date()) {
                saved = JSON.stringify({ login: row.login, password: row.password });
                try { localStorage.setItem('tiflis_session', saved); } catch(e) {}
                try { sessionStorage.setItem('tiflis_session', saved); } catch(e) {}
              } else {
                // Токен прострочений — видаляємо
                _setCookie('tiflis_tok', '', -1);
              }
            }
          }
        } catch(e) { console.warn('Token restore error:', e); }
      }
      if (!saved) return false;
      const { login, password } = JSON.parse(saved);
      const users = await sb.query('users', { filter: { login } });
      const user = users.find(u => u.password === password);
      if (!user || user.fired) { localStorage.removeItem('tiflis_session'); return false; }
      await App.loadCache();
      currentUser = { ...user, displayName: user.display_name, tg: user.tg_username || user.tg || '' };
      $('login-screen').remove();
      $('app').classList.remove('hidden');
      App.initUI();
      const _restoreLastPage = localStorage.getItem('tiflis_last_page')
        || sessionStorage.getItem('tiflis_last_page') || 'home';
      App.navigate(_restoreLastPage);
      App.startPolling();
      return true;
    } catch(e) { console.error('[restoreSession] FAILED:', e); return false; }
  },

  showAuthTab(tab) {
    const isLogin = tab === 'login';
    $('auth-panel-login').classList.toggle('hidden', !isLogin);
    $('auth-panel-register').classList.toggle('hidden', isLogin);
    const baseStyle = 'flex:1;padding:8px;border:none;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;transition:all .18s;';
    const activeStyle = baseStyle + 'background:var(--gold);color:var(--eden-dark)';
    const inactiveStyle = baseStyle + 'background:transparent;color:rgba(255,255,255,.5)';
    $('tab-login-btn').style.cssText = isLogin  ? activeStyle : inactiveStyle;
    $('tab-reg-btn').style.cssText   = !isLogin ? activeStyle : inactiveStyle;
  },

  async register() {
    const login = $('reg-login').value.trim();
    const pass  = $('reg-pass').value;
    const pass2 = $('reg-pass2').value;
    const role  = $('reg-role').value;
    const errEl = $('reg-err');
    const okEl  = $('reg-ok');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');

    if (!login) { errEl.textContent="Введіть ім'я"; errEl.classList.remove('hidden'); return; }
    if (pass.length < 4) { errEl.textContent='Пароль мінімум 4 символи'; errEl.classList.remove('hidden'); return; }
    if (pass !== pass2) { errEl.textContent='Паролі не співпадають'; errEl.classList.remove('hidden'); return; }

    const btn = $('auth-panel-register').querySelector('.btn-gold');
    btn.textContent = 'Надсилання...'; btn.disabled = true;
    try {
      const existing = await sb.query('users', { filter: { login } });
      if (existing.length) { errEl.textContent='Це ім\'я вже зайняте'; errEl.classList.remove('hidden'); btn.textContent='Подати заявку'; btn.disabled=false; return; }
      const existingReq = await sb.query('registration_requests', { filter: { login } });
      if (existingReq.length) { errEl.textContent='Заявка з таким іменем вже існує'; errEl.classList.remove('hidden'); btn.textContent='Подати заявку'; btn.disabled=false; return; }
      await sb.insert('registration_requests', { login, password: pass, role, status: 'pending', created_at: new Date().toISOString() });
      okEl.textContent = '✅ Заявку подано! Очікуйте підтвердження від адміністратора.';
      okEl.classList.remove('hidden');
      $('reg-login').value=''; $('reg-pass').value=''; $('reg-pass2').value='';
    } catch(e) { errEl.textContent='Помилка сервера. Спробуйте ще раз.'; errEl.classList.remove('hidden'); console.error(e); }
    btn.textContent='Подати заявку'; btn.disabled=false;
  },

  logout() {
    showConfirm('Вийти з акаунту?', () => {
      App.stopPolling();
      localStorage.removeItem('tiflis_session');
      localStorage.removeItem('tiflis_last_page');
      try { sessionStorage.removeItem('tiflis_session'); } catch(e) {}
      // Видаляємо cookie і Supabase session token
      try {
        const _tok = _getCookie('tiflis_tok');
        if (_tok) {
          sb.delete('sessions', { token: _tok }).catch(()=>{});
          _setCookie('tiflis_tok', '', -1);
        }
      } catch(e) {}
      currentUser = null;
      location.reload();
    }, { okLabel: '🚪 Вийти', okClass: 'btn-danger' });
  },

  async loadCache() {
    // ── Показати прогрес завантаження ──────────────────────────────
    const setStatus = (msg) => {
      const el = $('login-loading-status');
      if (el) el.textContent = msg;
    };
    setStatus('Завантаження даних...');

    // ── Все паралельно в одному запиті ─────────────────────────────
    const [
      users, roles, schedule, ratings, ratingComments,
      notifications, duties, settings, cash, extraWages
    ] = await Promise.all([
      sb.query('users',            { order: 'created_at' }).catch(() => []),
      sb.query('roles',            { order: 'key' }).catch(() => []),
      // Завантажуємо schedule лише за ±2 місяці (зменшує payload при великій БД)
      sb.query('schedule', { _raw: (() => {
        const _n=new Date();
        const _f=new Date(_n.getFullYear(),_n.getMonth()-1,1).toISOString().slice(0,10);
        const _t=new Date(_n.getFullYear(),_n.getMonth()+3,0).toISOString().slice(0,10);
        return `date=gte.${_f}&date=lte.${_t}`;
      })() }),
      sb.query('ratings').catch(() => []),
      sb.query('rating_comments',  { order: 'created_at' }).catch(() => []),
      sb.query('notifications',    { order: 'created_at.desc' }).catch(() => []),
      sb.query('duties').catch(() => []),
      sb.query('settings').catch(() => []),
      sb.query('cash').catch(() => []),
      sb.query('extra_wages').catch(() => []),
    ]);

    setStatus('Обробка даних...');

    // ── Users / Roles ───────────────────────────────────────────────
    DB.set('users', users.map(u => { const {password, ...safe} = u; return { ...safe, displayName: u.display_name, tg: u.tg_username || u.tg || '' }; }));
    DB.set('roles', roles);

    // ── Графік ─────────────────────────────────────────────────────
    const scheduleMap = {};
    schedule.forEach(s => { scheduleMap[`${s.user_id}_${s.date}`] = s.shift; });
    DB.set('schedule', scheduleMap);

    // ── Рейтинги ───────────────────────────────────────────────────
    DB.set('ratings', App._buildRatingsMap(ratings, ratingComments));

    // ── Сповіщення (фільтруємо протерміновані одразу при завантаженні) ──
    const _freshNotifs = notifications.filter(n => App._isNotifFresh(n));
    DB.set('notifications', _freshNotifs);
    // Тихо видаляємо протерміновані з Supabase
    notifications.filter(n => !_freshNotifs.includes(n)).forEach(n => {
      sb.delete('notifications', { id: n.id }).catch(() => {});
    });

    // ── Settings (меню, стоп-меню, обкладинки, порядок вкладок) ───
    settings.forEach(s => {
      try {
        const parsed = JSON.parse(s.value);
        // menu_items: мержимо з DEFAULT_MENU_ITEMS щоб lunch::* не зникали
        if (s.key === 'menu_items') {
          const merged = { ...parsed };
          Object.keys(DEFAULT_MENU_ITEMS).forEach(k => {
            if (!merged[k] || merged[k].length === 0) merged[k] = DEFAULT_MENU_ITEMS[k];
          });
          DB.set('menu_items', merged);
        } else if (s.key === 'tg_bot_token') {
          // Токен бота — зберігаємо і в localStorage для швидкого доступу
          DB.set('tg_bot_token', parsed);
          try { localStorage.setItem('tiflis_tg_token', parsed); } catch(e) {}
        } else {
          DB.set(s.key, parsed);
        }
        if (s.key === LS_KEYS.NAV_ORDER)
          try { localStorage.setItem(LS_KEYS.NAV_ORDER, s.value); } catch(e) {}
        if (s.key === LS_KEYS.MENU_CUSTOM_CATS)
          try { localStorage.setItem(LS_KEYS.MENU_CUSTOM_CATS, s.value); } catch(e) {}
      } catch(e) { DB.set(s.key, s.value); }
    });

    // ── Duties ─────────────────────────────────────────────────────
    duties.forEach(r => {
      const key = r.type === 'daily-zones'
        ? `duties_daily_zones_${r.date}`
        : `duties_${r.type}_${r.date}`;
      // r.data може бути рядком JSON або вже об'єктом залежно від типу колонки
      let data;
      try { data = (typeof r.data === 'string') ? JSON.parse(r.data) : (r.data || {}); }
      catch(e) { data = {}; }
      DB.set(key, data);
      const pubLSKey = `duties_${r.type}_pub_${r.date}`;
      const pubTs = r.published_at
        ? new Date(r.published_at).getTime()
        : Date.now();
      DB.set(pubLSKey, pubTs);
    });

    // ── Каса (всі записи одразу) ───────────────────────────────────
    const cashDB = {};
    const cacheTs = {};
    cash.forEach(r => {
      if (!cashDB[r.user_id]) cashDB[r.user_id] = {};
      const _c1 = parseFloat(r.cash)||0, _t1 = parseFloat(r.tips)||0;
      cashDB[r.user_id][r.date] = {
        cash:      _c1,
        tips:      _t1,
        firstCash: r.first_cash != null ? parseFloat(r.first_cash) : _c1,
      };
      cacheTs[r.user_id] = Date.now();
    });
    DB.set('cash', cashDB);
    DB.set('cash_ts', cacheTs);

    // ── Доплати ────────────────────────────────────────────────────
    const extraMap = {};
    extraWages.forEach(r => {
      if (!extraMap[r.user_id]) extraMap[r.user_id] = {};
      extraMap[r.user_id][r.date] = { amount: parseFloat(r.amount), description: r.description || '' };
    });
    DB.set('extra_wages', extraMap);

    setStatus('');
  },

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  REALTIME POLLING — синхронізація між вкладками/пристроями    ║
  // ╚═══════════════════════════════════════════════════════════════╝

  // ── Спільні хелпери для роботи з нотифікаціями і рейтингами ──
  // Чи не протермінована нотифікація (єдине місце визначення логіки)
  _isNotifFresh(n) {
    const exp = n.expires_at
      ? new Date(n.expires_at).getTime()
      : new Date(n.created_at).getTime() + 3 * 24 * 60 * 60 * 1000;
    return exp > Date.now();
  },

  // Будує ratingsMap з масивів ratings + comments (єдине місце логіки)
  _buildRatingsMap(ratings, comments) {
    const map = {};
    ratings.forEach(r => { map[r.user_id] = { score: r.score, comments: [] }; });
    comments.forEach(c => {
      if (map[c.user_id]) map[c.user_id].comments.push({
        date: new Date(c.created_at).toLocaleDateString('uk'),
        by: c.author, delta: c.delta, text: c.comment,
        ts: new Date(c.created_at).getTime(),
      });
    });
    return map;
  },

  _pollInterval: null,
  _lastPollTs: {},      // { tableName: timestamp }
  _SETTINGS_TTL: 60000, // settings (меню) — не частіше 1 разу на хвилину

  startPolling() {
    if (App._pollInterval) clearInterval(App._pollInterval);
    App._pollInterval = setInterval(App._poll, 20000);
    setTimeout(App._poll, 5000);
  },

  stopPolling() {
    if (App._pollInterval) { clearInterval(App._pollInterval); App._pollInterval = null; }
  },

  _updateOfflineQueueBadge(count) {
    let badge = document.getElementById('offline-queue-badge');
    if (!count) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offline-queue-badge';
      badge.style.cssText = 'position:fixed;bottom:80px;right:14px;z-index:99997;background:var(--warning);color:var(--eden-dark);font-size:11px;font-weight:800;padding:6px 12px;border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,.3);letter-spacing:.04em';
      document.body.appendChild(badge);
    }
    badge.textContent = `⏳ Очікує синхр.: ${count}`;
  },

  _setSyncStatus(status) {
    // status: 'ok' | 'syncing' | 'error'
    const dot = $('sync-status-dot');
    const lbl = $('sync-status-label');
    if (!dot || !lbl) return;
    if (status === 'syncing') {
      dot.style.background = 'var(--gold)';
      dot.style.animation = 'syncPulse .8s ease-in-out infinite';
      lbl.textContent = 'Синхронізація...';
    } else if (status === 'ok') {
      dot.style.background = 'var(--success)';
      dot.style.animation = 'none';
      lbl.textContent = 'Синхронізовано';
      setTimeout(() => { if (lbl) lbl.textContent = 'Онлайн'; }, 3000);
    } else {
      dot.style.background = 'var(--danger)';
      dot.style.animation = 'none';
      lbl.textContent = 'Помилка синхр.';
    }
  },

  async _poll() {
    if (!currentUser) return;
    App._setSyncStatus('syncing');
    try {
      const active = document.querySelector('.page.active')?.id || '';
      const now = Date.now();

      // ── Завжди паралельно: notifications + settings (з throttle) ──
      const _noop = () => {};
      const alwaysPolls = [App._pollNotifications().catch(_noop)];

      const settingsStale = !App._lastPollTs.settings
        || (now - App._lastPollTs.settings) > App._SETTINGS_TTL;
      if (settingsStale) {
        alwaysPolls.push(App._pollSettings().then(() => { App._lastPollTs.settings = Date.now(); }).catch(_noop));
      }

      // ── Lazy: залежно від активної сторінки ───────────────────────
      const needsSchedule = active === 'page-schedule' || active === 'page-handover' || active === 'page-daily';
      if (needsSchedule)         alwaysPolls.push(App._pollSchedule().catch(_noop));
      if (active === 'page-rating') alwaysPolls.push(App._pollRatings().catch(_noop));
      if (active === 'page-cash')   alwaysPolls.push(App._pollCash().catch(_noop));
      if (active === 'page-handover' || active === 'page-daily')
                                    alwaysPolls.push(App._pollDuties().catch(_noop));
      if (active === 'page-reserve') alwaysPolls.push(App._pollReserve().catch(_noop));

      await Promise.all(alwaysPolls);
      sb._setOffline(false);
      App._setSyncStatus('ok');
      sb.flushQueue().catch(()=>{});
    } catch(e) {
      if (e?.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('net::') || e.message.includes('Load failed'))) {
        sb._setOffline(true);
      }
      App._setSyncStatus('error');
    }
  },

  async _pollSchedule() {
    // Завантажуємо графік за ±2 місяці (той самий діапазон що й при логіні)
    const _n=new Date();
    const _f=new Date(_n.getFullYear(),_n.getMonth()-1,1).toISOString().slice(0,10);
    const _t=new Date(_n.getFullYear(),_n.getMonth()+3,0).toISOString().slice(0,10);
    const rows = await sb.query('schedule', { _raw: `date=gte.${_f}&date=lte.${_t}` });
    const scheduleMap = {};
    rows.forEach(s => { scheduleMap[`${s.user_id}_${s.date}`] = s.shift; });
    const old = JSON.stringify(DB.get('schedule', {}));
    const fresh = JSON.stringify(scheduleMap);
    if (old !== fresh) {
      DB.set('schedule', scheduleMap);
      // Оновити активну сторінку якщо це графік
      if ($('page-schedule')?.classList.contains('active')) {
        Schedule.renderTable(scheduleActiveRole, Schedule.calYear, Schedule.calMonth);
      }
      // Оновити duties якщо відкриті
      ['handover','daily'].forEach(type => {
        const pg = $('page-' + (type === 'handover' ? 'handover' : 'daily'));
        if (pg?.classList.contains('active')) Duties.initFromCal(type);
      });
    }
  },

  // ── Спільна логіка застосування одного рядка settings ──────────
  // Повертає об'єкт { menuChanged } якщо значення змінилось
  _applyOneSetting(s) {
    try {
      const parsed = JSON.parse(s.value);

      // Для menu_items — мержимо з DEFAULT_MENU_ITEMS щоб не втрачати
      // локальні ключі (lunch::*, bar::*) яких може не бути в Supabase
      if (s.key === 'menu_items') {
        const current = DB.get('menu_items', {});
        // Додаємо всі дефолтні ключі яких немає в Supabase
        let merged = { ...parsed };
        Object.keys(DEFAULT_MENU_ITEMS).forEach(k => {
          if (!merged[k] || merged[k].length === 0) merged[k] = DEFAULT_MENU_ITEMS[k];
        });
        const changed = JSON.stringify(current) !== JSON.stringify(merged);
        if (!changed) return { menuChanged: false };
        DB.set('menu_items', merged);
        return { menuChanged: true };
      }

      const changed = JSON.stringify(DB.get(s.key)) !== JSON.stringify(parsed);
      if (!changed) return { menuChanged: false };

      DB.set(s.key, parsed);

      if (s.key === LS_KEYS.NAV_ORDER)
        try { localStorage.setItem(LS_KEYS.NAV_ORDER, s.value); } catch(e) {}
      if (s.key === LS_KEYS.MENU_CUSTOM_CATS)
        try { localStorage.setItem(LS_KEYS.MENU_CUSTOM_CATS, s.value); } catch(e) {}

      const menuChanged = ['menu_items','menu_wine_cats','menu_section_covers', LS_KEYS.MENU_CUSTOM_CATS].includes(s.key);
      return { menuChanged };
    } catch(e) {
      DB.set(s.key, s.value);
      return { menuChanged: false };
    }
  },

  async _pollSettings() {
    const settings = await sb.query('settings');
    let menuChanged = false;
    let reserveChanged = false;
    settings.forEach(s => {
      const result = App._applyOneSetting(s);
      if (result.menuChanged)     menuChanged     = true;
      if (s.key === LS_KEYS.RESERVE_BOOKINGS) reserveChanged = true;
      // Sync shift_swaps
      if (s.key === SWAPS_KEY) {
        try {
          const parsed = JSON.parse(s.value || '[]');
          DB.set(SWAPS_KEY, parsed);
          ShiftSwap._updateMySwapsBtn();
        } catch(e) { console.warn('SwapKey parse error:', e); }
      }
    });
    if (menuChanged && $('page-menu')?.classList.contains('active')) {
      Menu.renderSection(menuActiveSection);
    }
    if (reserveChanged && $('page-reserve')?.classList.contains('active')) {
      Reserve.renderContent();
      Reserve.renderTablesList();
      Reserve.renderStrip();
    }
  },

  async _pollNotifications() {
    const allNotifications = await sb.query('notifications', { order: 'created_at.desc' });
    // Фільтруємо протерміновані через загальний хелпер
    const notifications = allNotifications.filter(n => App._isNotifFresh(n));
    // Автовидалення протермінованих з Supabase (тихо, в фоні)
    allNotifications.filter(n => !notifications.includes(n)).forEach(n => {
      sb.delete('notifications', { id: n.id }).catch(() => {});
    });
    const old = JSON.stringify(DB.get('notifications', []));
    const fresh = JSON.stringify(notifications);
    if (old !== fresh) {
      DB.set('notifications', notifications);
      if ($('page-notifications')?.classList.contains('active')) Notify.init();
    }
  },

  async _pollDuties() {
    const dutiesRows = await sb.query('duties');
    let dutiesChanged = false;
    dutiesRows.forEach(r => {
      const key = r.type === 'daily-zones'
        ? `duties_daily_zones_${r.date}`
        : `duties_${r.type}_${r.date}`;
      // Захист 1: ключ активно зберігається прямо зараз
      if (Duties._savingKeys.has(key)) return;
      // Захист 2: локальна зміна новіша за дані з сервера
      const localTs = Duties._localEditTs[key] || 0;
      const serverTs = r.published_at ? new Date(r.published_at).getTime() : 0;
      if (localTs > serverTs) return;
      // r.data може бути рядком JSON або вже об'єктом залежно від типу колонки
      let freshData;
      try {
        freshData = (typeof r.data === 'string') ? JSON.parse(r.data) : (r.data || {});
      } catch(e) {
        freshData = {};
      }
      const old = JSON.stringify(DB.get(key) || {});
      const fresh = JSON.stringify(freshData);
      if (old !== fresh) {
        DB.set(key, freshData);
        dutiesChanged = true;
      }
    });
    if (dutiesChanged) {
      ['handover','daily'].forEach(type => {
        const pg = $('page-' + (type === 'handover' ? 'handover' : 'daily'));
        if (pg?.classList.contains('active')) Duties.initFromCal(type);
      });
    }
  },


  async _pollReserve() {
    // Підтягуємо тільки ключ бронювань — без завантаження всіх settings
    const rows = await sb.query('settings', { filter: { key: LS_KEYS.RESERVE_BOOKINGS } });
    if (!rows.length) return;
    const fresh = rows[0];
    const result = App._applyOneSetting(fresh);
    if (result.menuChanged || fresh.key === LS_KEYS.RESERVE_BOOKINGS) {
      if ($('page-reserve')?.classList.contains('active')) {
        Reserve.renderContent();
        Reserve.renderTablesList();
        Reserve.renderStrip();
      }
    }
  },

  async _pollRatings() {
    const [ratings, ratingComments] = await Promise.all([
      sb.query('ratings'),
      sb.query('rating_comments', { order: 'created_at' }),
    ]);
    const ratingsMap = App._buildRatingsMap(ratings, ratingComments);
    const old = JSON.stringify(DB.get('ratings', {}));
    const fresh = JSON.stringify(ratingsMap);
    if (old !== fresh) {
      DB.set('ratings', ratingsMap);
      if ($('page-rating')?.classList.contains('active')) Rating.init();
    }
  },

  async _pollCash() {
    // Завантажуємо касу для всіх офіціантів та користувачів з role2=waiter
    const waiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');
    if (!waiters.length) return;
    // Пропускаємо poll під час активного збереження — уникаємо гонки
    if (Cash._saving) return;

    const rows = await sb.query('cash');
    if (Cash._saving) return; // перевіряємо ще раз після await

    // Перебудувати касу зі свіжих даних — тільки для юзерів яких не редагуємо
    const freshCash = {};
    rows.forEach(r => {
      if (!freshCash[r.user_id]) freshCash[r.user_id] = {};
      const _c2 = parseFloat(r.cash)||0, _t2 = parseFloat(r.tips)||0;
      freshCash[r.user_id][r.date] = {
        cash:      _c2,
        tips:      _t2,
        firstCash: r.first_cash != null ? parseFloat(r.first_cash) : _c2,
      };
    });

    // Мержимо — НЕ перезаписуємо весь cashDB, лише оновлюємо рядки чужих юзерів
    // Так уникаємо затирання щойно збережених даних поточного юзера
    const cashDB = DB.get('cash', {});
    const cacheTs = DB.get('cash_ts', {});
    let cashChanged = false;

    waiters.forEach(u => {
      // Якщо це поточний юзер і він щойно зберігав — пропускаємо
      if (u.id === Cash.viewUserId && Cash._saving) return;
      const oldStr   = JSON.stringify(cashDB[u.id] || {});
      const freshStr = JSON.stringify(freshCash[u.id] || {});
      if (oldStr !== freshStr) {
        cashDB[u.id] = freshCash[u.id] || {};
        cacheTs[u.id] = Date.now();
        cashChanged = true;
      }
    });

    if (cashChanged) {
      DB.set('cash', cashDB);
      DB.set('cash_ts', cacheTs);
      // Оновити рейтинг каси якщо відкритий
      if ($('page-rating')?.classList.contains('active') && ratingTab === 'cashTop') {
        Rating.renderCashTop();
      }
      // Оновити сторінку каси якщо відкрита (для всіх хто на сторінці каси)
      if ($('page-cash')?.classList.contains('active')) {
        Cash.renderCalendar();
        Cash.loadDayEntry();
      }
    }
  },

  initUI() {
    const u = currentUser;
    $('sidebar-user-block').innerHTML = `
      ${avatarHTML(u,36,14)}
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${u.displayName||u.login}</div>
        <div class="sidebar-user-role">${getRoleLabel(u.role)}</div>
      </div>`;

    App.renderSidebarNav();

    // Ранер — приховуємо нижню навігацію крім "Головна"
    if (u.role === 'runner' || u.role2 === 'runner') {
      document.querySelectorAll('.bn-btn:not(.bn-home)').forEach(b => b.style.display = 'none');
    }
    // Кухар — замінюємо «Каса» на «Резерв» в нижній панелі
    if ((u.role === 'cook' || u.role2 === 'cook') && !isAdmin(u)) {
      const cashBtn = document.querySelector('.bn-btn[data-bnpage="cash"]');
      if (cashBtn) {
        cashBtn.setAttribute('data-bnpage', 'reserve');
        cashBtn.querySelector('.bn-icon').textContent = '🗓️';
        cashBtn.querySelector('span:last-child').textContent = 'Резерв';
        cashBtn.onclick = () => { App.navigate('reserve'); App.closeBnDrawer(); };
      }
    }
  },

  renderSidebarNav() {
    const u = currentUser;
    const order = App.getNavOrder();

    const nav = $('sidebar-nav');
    nav.innerHTML = '';

    // ── Головна (завжди перша) ──────────────────────────────────────
    const homeBtn = document.createElement('button');
    homeBtn.className = 'nav-btn';
    homeBtn.setAttribute('data-page','home');
    homeBtn.innerHTML = '<span class="icon">🏠</span>Головна';
    homeBtn.addEventListener('click', () => { App.navigate('home'); App.closeSidebar(); });
    nav.appendChild(homeBtn);

    // ── Ранер — лише головна, нічого більше ──────────────────────────
    if (u.role === 'runner' || u.role2 === 'runner') {
      App.renderBnDrawer(u);
      return;
    }

    // ── Акордеон-групи для десктопу ────────────────────────────────
    const GROUPS = [
      {
        id: 'grp-work', label: 'Робота',
        pages: ['schedule','cash','handover','daily'],
      },
      {
        id: 'grp-team', label: 'Команда',
        pages: ['staff','rating'],
      },
      {
        id: 'grp-content', label: 'Контент',
        pages: ['menu','interactive','notifications'],
      },
    ];

    // Фільтруємо items по ролі
    const allItems = App.getNavItems().filter(item => {
      if (item.page === 'cash' && u.role !== 'waiter' && !isSysadmin(u)) return false;
      if (item.adminOnly) return false; // адмін окремо нижче
      return true;
    });

    // Будуємо акордеони
    GROUPS.forEach(grp => {
      const grpItems = allItems.filter(i => grp.pages.includes(i.page));
      if (!grpItems.length) return;

      const grpEl = document.createElement('div');
      grpEl.className = 'nav-group open';
      grpEl.id = grp.id;

      const header = document.createElement('div');
      header.className = 'nav-group-header';
      header.innerHTML = `<span>${grp.label}</span><span class="nav-group-arrow">▾</span>`;
      header.addEventListener('click', () => {
        grpEl.classList.toggle('open');
      });

      const body = document.createElement('div');
      body.className = 'nav-group-body';

      grpItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.setAttribute('data-page', item.page);
        if (item.page === 'cash') btn.id = 'nav-cash';
        btn.innerHTML = `<span class="icon">${item.icon}</span>${item.label}`;
        btn.addEventListener('click', () => { App.navigate(item.page); App.closeSidebar(); });
        body.appendChild(btn);
      });

      grpEl.appendChild(header);
      grpEl.appendChild(body);
      nav.appendChild(grpEl);
    });

    // ── Адміністрування (одне місце, без дублювання) ───────────────
    if (isAdmin(u)) {
      const adminTitle = document.createElement('div');
      adminTitle.className = 'nav-section-title';
      adminTitle.textContent = 'Адміністрування';
      nav.appendChild(adminTitle);

      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.setAttribute('data-page', 'admin');
      btn.innerHTML = `<span class="icon">⚙️</span>Управління`;
      btn.addEventListener('click', () => { App.navigate('admin'); App.closeSidebar(); });
      nav.appendChild(btn);

      const btnJ = document.createElement('button');
      btnJ.className = 'nav-btn';
      btnJ.setAttribute('data-page', 'journal');
      btnJ.innerHTML = `<span class="icon">📋</span>Журнал подій`;
      btnJ.addEventListener('click', () => { App.navigate('journal'); App.closeSidebar(); });
      nav.appendChild(btnJ);
    }

    // ── Синхронізувати bottom nav drawer ──────────────────────────
    App.renderBnDrawer(u);
  },

  getNavItems() {
    return [
      { page:'schedule',  icon:'📅', label:'Графік змін',       section:'Основне' },
      { page:'cash',      icon:'💰', label:'Каса',               section:'Основне' },
      { page:'rating',    icon:'🏆', label:'Рейтинг',            section:'Основне' },
      { page:'staff',     icon:'👥', label:'Персонал',           section:'Основне' },
      { page:'menu',      icon:'🍽️', label:'Меню',               section:'Основне' },
      { page:'reserve',   icon:'🗓️', label:'Резерв',             section:'Основне' },
      { page:'handover',  icon:'🧹', label:'Здача зміни',        section:'Основне' },
      { page:'daily',     icon:'📋', label:"Щоденні обов'язки", section:'Основне' },
      { page:'notifications', icon:'🔔', label:'Сповіщення', section:'Основне' },
      { page:'interactive',   icon:'🎮', label:'Інтерактив',        section:'Основне' },
      { page:'admin',     icon:'⚙️', label:'Управління',        section:'Адміністрування', adminOnly:true },
    ];
  },

  getNavOrder() {
    try {
      const saved = localStorage.getItem(LS_KEYS.NAV_ORDER);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return ['schedule','cash','rating','staff','menu','reserve','handover','daily','notifications'];
  },

  setNavOrder(order) {
    localStorage.setItem(LS_KEYS.NAV_ORDER, JSON.stringify(order));
  },

  navigate(page) {
    // Ранер бачить лише головну сторінку
    if ((currentUser?.role === 'runner' || currentUser?.role2 === 'runner') && page !== 'home') {
      page = 'home';
    }

    // Якщо офіціант покидає графік з незбереженими змінами — попереджаємо
    if (page !== 'schedule' && !isAdmin(currentUser) &&
        Object.keys(Schedule._pendingChanges).length > 0) {
      showConfirm('У вас є незбережені зміни в графіку. Покинути без збереження?', () => {
        Schedule._pendingChanges = {};
        App.navigate(page);
      }, { okLabel: '⚠️ Покинути', okClass: 'btn-danger', cancelLabel: 'Залишитись' });
      return; // showConfirm асинхронний — навігація відбудеться в callback
    }

    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    const el = $('page-'+page);
    if (el) el.classList.add('active');
    // Скидаємо scroll при кожному переході (window + element fallback)
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const _mc = document.getElementById('main-content');
    if (_mc) _mc.scrollTop = 0;
    const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (btn) {
      btn.classList.add('active');
      // Відкрити акордеон-групу якщо кнопка всередині
      const grp = btn.closest('.nav-group');
      if (grp) {
        grp.classList.add('open');
        const hdr = grp.querySelector('.nav-group-header');
        if (hdr) hdr.classList.add('has-active');
      }
    }

    // Синхронізувати bottom nav
    document.querySelectorAll('.bn-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.bn-drawer-item').forEach(b=>b.classList.remove('active'));
    const bnBtn = document.querySelector(`.bn-btn[data-bnpage="${page}"]`);
    if (bnBtn) bnBtn.classList.add('active');
    const bnDrItem = document.querySelector(`.bn-drawer-item[data-bnpage="${page}"]`);
    if (bnDrItem) bnDrItem.classList.add('active');

    // Зберігаємо поточну сторінку щоб відновити після reload
    try { localStorage.setItem('tiflis_last_page', page); } catch(e) {}
    try { sessionStorage.setItem('tiflis_last_page', page); } catch(e) {}

    if (page==='home')     { Home.init(); }
    if (page==='schedule') Schedule.init();
    if (page==='cash')     { Cash.init(); }
    if (page==='rating')   Rating.init();
    if (page==='staff')    Staff.init();
    if (page==='admin')    Admin.init();
    if (page==='handover') Duties.init('handover');
    if (page==='daily')    Duties.init('daily');
    if (page==='menu')     Menu.init();
    if (page==='reserve')  Reserve.init();
    if (page==='notifications') Notify.init();
    if (page==='interactive') Interactive.init();
    if (page==='journal')     EventLog.init();

    // Lazy poll: одразу підтягуємо свіжі дані для сторінок що не в постійному циклі
    const lazyPages = { schedule: '_pollSchedule', rating: '_pollRatings', cash: '_pollCash', handover: '_pollDuties', daily: '_pollDuties', reserve: '_pollReserve' };
    if (lazyPages[page]) App[lazyPages[page]]().catch(() => {});
  },
  toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      $('sidebar').classList.toggle('open');
      $('sidebar-overlay').classList.toggle('visible');
    } else {
      // Desktop: toggle collapsed state
      const collapsed = $('sidebar').classList.toggle('collapsed');
      $('main-content').classList.toggle('sidebar-collapsed', collapsed);
    }
  },
  closeSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      $('sidebar').classList.remove('open');
      $('sidebar-overlay').classList.remove('visible');
    } else {
      $('sidebar').classList.add('collapsed');
      $('main-content').classList.add('sidebar-collapsed');
      const btn = $('sidebar-open-btn');
      if (btn) btn.style.display = 'flex';
    }
  },
  openSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      $('sidebar').classList.add('open');
      $('sidebar-overlay').classList.add('visible');
    } else {
      $('sidebar').classList.remove('collapsed');
      $('main-content').classList.remove('sidebar-collapsed');
      const btn = $('sidebar-open-btn');
      if (btn) btn.style.display = 'none';
    }
  },

  // ── Bottom Nav Drawer ("Ще") ───────────────────────────────────
  renderBnDrawer(u) {
    const grid = $('bn-drawer-grid');
    if (!grid) return;
    if (u.role === 'runner' || u.role2 === 'runner') { grid.innerHTML = ''; return; }
    // Усі сторінки крім тих що вже в bottom nav + адмін окремо
    const BN_MAIN = ['schedule','cash','menu','home'];
    const _bnCookPages = ['schedule','staff','menu','interactive','reserve'];
    const items = App.getNavItems().filter(item => {
      if (BN_MAIN.includes(item.page)) return false;
      if (item.page === 'cash' && u.role !== 'waiter' && !isSysadmin(u)) return false;
      if (item.adminOnly) return false;
      if ((u.role === 'cook' || u.role2 === 'cook') && !isAdmin(u) && !_bnCookPages.includes(item.page)) return false;
      return true;
    });
    if (isAdmin(u)) {
      items.push({ page:'admin',   icon:'⚙️', label:'Управління' });
      items.push({ page:'journal', icon:'📋', label:'Журнал подій' });
    }

    grid.innerHTML = items.map(item => `
      <button class="bn-drawer-item" data-bnpage="${item.page}"
        onclick="App.navigate('${item.page}');App.closeBnDrawer()">
        <span class="bn-d-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>`).join('');
  },

  toggleBnDrawer() {
    const drawer = $('bn-more-drawer');
    const overlay = $('bn-drawer-overlay');
    if (!drawer) return;
    const isOpen = drawer.classList.toggle('open');
    overlay.classList.toggle('open', isOpen);
  },

  closeBnDrawer() {
    $('bn-more-drawer')?.classList.remove('open');
    $('bn-drawer-overlay')?.classList.remove('open');
  },
};

