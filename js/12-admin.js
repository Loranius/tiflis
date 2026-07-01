// ╔═══════════════════════════════════════════════════════════════╗
// ║  [12/13] АДМІН + ГОЛОВНА + СПОВІЩЕННЯ + СТОП-МЕНЮ            ║
// ╚═══════════════════════════════════════════════════════════════╝
const Admin = {
  init() {
    const bg = DB.get('bg','');
    if ($('bg-url-input')) $('bg-url-input').value = bg;
    Admin.renderCustomRoles();
    Admin.loadPendingTg();
    Admin.renderTgManual();
    Admin.loadRegistrations();
    Admin.renderNavOrder();
    Admin.renderPageVisibility();
  },

  async loadRegistrations() {
    const el = $('reg-requests-list');
    if (!el) return;
    try {
      const rows = await sb.query('registration_requests', { filter: { status: 'pending' }, order: 'created_at' });
      const allRoles = DB.get('roles',[]);
      if (!rows.length) {
        el.innerHTML = `<p style="font-size:12px;color:var(--text-muted);padding:8px 0">Немає нових заявок</p>`;
        return;
      }
      el.innerHTML = rows.map(r => {
        const dt = new Date(r.created_at).toLocaleDateString('uk', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
        const roleLabel = (allRoles.find(x=>x.key===r.role)||{label:r.role}).label;
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(0,0,0,.15);border-radius:8px;margin-bottom:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <div style="font-weight:700;font-size:13px">${r.login}</div>
            <div style="font-size:11px;margin-top:3px">
              <span class="badge badge-gold">${roleLabel}</span>
              <span style="color:var(--text-muted);margin-left:8px">${dt}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gold btn-sm" onclick="Admin.approveReg(${r.id})">✓ Прийняти</button>
            <button class="btn btn-danger btn-sm" onclick="Admin.rejectReg(${r.id},'${esc(r.login)}')">✕ Відхилити</button>
          </div>
        </div>`;
      }).join('');
    } catch(e) { el.innerHTML = `<p style="font-size:11px;color:var(--danger)">Помилка завантаження</p>`; }
  },

  async approveReg(id) {
    // Завантажуємо дані заявки напряму з Supabase — не з HTML-атрибутів
    // (паролі з апострофами/лапками ламали onclick-рядок)
    let req;
    try {
      const rows = await sb.query('registration_requests', { filter: { id } });
      req = rows[0];
    } catch(e) { toast('Помилка завантаження заявки', 'error'); return; }
    if (!req) { toast('Заявку не знайдено', 'error'); return; }

    const { login, password, role } = req;
    showConfirm(`Прийняти "${login}" як ${role}?`, async () => {
      const uid = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      try {
        await sb.insert('users', { id: uid, login, password, role, display_name: login, nick:'', avatar:'', tg_username:'', ig:'', fired: false });
        await sb.update('registration_requests', { status: 'approved' }, { id });
        const users = DB.get('users',[]);
        users.push({ id: uid, login, role, display_name: login, displayName: login, nick:'', avatar:'', fired: false });
        DB.set('users', users);
        toast(`${login} прийнятий в команду! 🎉`, 'success-t');
        Admin.loadRegistrations();
      } catch(e) { toast('Помилка', 'error'); console.error(e); }
    }, { okLabel: '✅ Прийняти', okClass: 'btn-gold' });
  },

  async rejectReg(id, login) {
    showConfirm(`Відхилити заявку від "${login}"?`, async () => {
      try {
        await sb.delete('registration_requests', { id });
        toast('Заявку відхилено', 'success-t');
        Admin.loadRegistrations();
      } catch(e) { toast('Помилка', 'error'); console.error(e); }
    }, { okLabel: '❌ Відхилити' });
  },

  renderNavOrder() {
    const el = $('nav-order-list');
    if (!el) return;
    // Only main nav items (not admin-only)
    const mainItems = App.getNavItems().filter(i => !i.adminOnly);
    const order = App.getNavOrder();
    const sorted = [...mainItems].sort((a, b) => {
      const ia = order.indexOf(a.page);
      const ib = order.indexOf(b.page);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    el.innerHTML = sorted.map((item, idx) => `
      <div class="nav-order-item" draggable="true" data-page="${item.page}"
        ondragstart="Admin._dragStart(event)"
        ondragover="Admin._dragOver(event)"
        ondrop="Admin._drop(event)"
        ondragend="Admin._dragEnd(event)">
        <span class="drag-handle">⠿</span>
        <span class="item-icon">${item.icon}</span>
        <span class="item-label">${item.label}</span>
        <span class="item-section">${item.section}</span>
      </div>`).join('');
  },

  _dragSrc: null,
  _dragStart(e) {
    Admin._dragSrc = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.page);
    setTimeout(() => e.currentTarget.style.opacity = '0.4', 0);
  },
  _dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.nav-order-item').forEach(i => i.classList.remove('drag-over'));
    e.currentTarget.classList.add('drag-over');
    return false;
  },
  _drop(e) {
    e.preventDefault();
    e.stopPropagation();
    const src = Admin._dragSrc;
    const tgt = e.currentTarget;
    if (src === tgt) return;
    const list = $('nav-order-list');
    const items = [...list.querySelectorAll('.nav-order-item')];
    const srcIdx = items.indexOf(src);
    const tgtIdx = items.indexOf(tgt);
    if (srcIdx < tgtIdx) list.insertBefore(src, tgt.nextSibling);
    else list.insertBefore(src, tgt);
    return false;
  },
  _dragEnd(e) {
    e.currentTarget.style.opacity = '';
    document.querySelectorAll('.nav-order-item').forEach(i => i.classList.remove('drag-over'));
  },

  async saveNavOrder() {
    const items = [...$('nav-order-list').querySelectorAll('.nav-order-item')];
    const order = items.map(i => i.dataset.page);
    App.setNavOrder(order);
    App.renderSidebarNav();
    try {
      await sb.upsert('settings', { key: LS_KEYS.NAV_ORDER, value: JSON.stringify(order) }, 'key');
    } catch(e) { console.warn('Nav order save to DB failed:', e); }
    toast('Порядок збережено', 'success-t');
  },

  async loadPendingTg() {
    const el = $('pending-tg-list');
    if (!el) return;
    try {
      const rows = await sb.query('pending_tg', { order: 'created_at.desc' });
      const users = DB.get('users', []);
      if (!rows.length) {
        el.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Немає очікуючих прив'язок</p>`;
        return;
      }
      el.innerHTML = rows.map(r => `
        <div style="padding:10px;background:rgba(0,0,0,.2);border-radius:8px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700">${r.first_name||''} ${r.tg_username ? '@'+r.tg_username : ''}</div>
          <div style="font-size:10px;color:var(--text-dim);margin:2px 0">ID: <code style="color:var(--gold)">${r.tg_id}</code></div>
          <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
            <select id="bind-user-${r.tg_id}" class="field" style="font-size:11px;padding:5px 8px">
              <option value="">— Оберіть акаунт —</option>
              ${users.filter(u => !u.tg_id && !u.chat_id && !u.fired).map(u=>`<option value="${u.id}">${u.display_name||u.login}</option>`).join('')}
            </select>
            <button class="btn btn-gold btn-sm" onclick="Admin.bindTg('${r.tg_id}',${r.chat_id})">Прив'язати</button>
          </div>
        </div>`).join('');
    } catch(e) { el.innerHTML = `<p style="font-size:11px;color:var(--danger)">Помилка завантаження</p>`; }
  },

  async bindTg(tgId, chatId) {
    const sel = $(`bind-user-${tgId}`);
    if (!sel || !sel.value) { toast('Оберіть акаунт', 'error'); return; }
    const userId = sel.value;
    try {
      await sb.update('users', { tg_id: parseInt(tgId), chat_id: chatId }, { id: userId });
      await sb.delete('pending_tg', { tg_id: tgId });
      // Оновити кеш
      const users = DB.get('users',[]);
      const i = users.findIndex(u=>u.id===userId);
      if (i>=0) { users[i].tg_id = parseInt(tgId); users[i].chat_id = chatId; DB.set('users',users); }
      // Повідомити користувача
      const u = getUserById(userId);
      await tgSendPersonal(chatId,
        `✅ Твій Telegram прив'язано до акаунту <b>${u?.display_name||u?.login||''}</b> в порталі Тифліс!\n\n` +
        `Тепер ти будеш отримувати сповіщення тут.`
      );
      toast('Прив\'язано!', 'success-t');
      Admin.loadPendingTg();
    } catch(e) { toast('Помилка прив\'язки', 'error'); console.error(e); }
  },

  renderTgManual() {
    const el = $('tg-manual-list');
    if (!el) return;
    const users = getUsers(false); // весь активний персонал включно з адмінами
    if (!users.length) { el.innerHTML = '<p style="font-size:11px;color:var(--text-muted)">Немає персоналу</p>'; return; }

    el.innerHTML = users.map(u => {
      const raw = getUserById(u.id); // справжній об'єкт з tg_id
      const hasTg = raw?.chat_id || raw?.tg_id;
      const tgVal = raw?.tg_id || raw?.chat_id || '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;truncate">${u.displayName||u.login}</div>
          <div style="font-size:10px;color:var(--text-dim)">${getRoleLabel(u.role)}</div>
        </div>
        <input type="text" id="tg-manual-${u.id}" class="field"
          style="width:110px;padding:5px 8px;font-size:11px;${hasTg?'border-color:rgba(80,200,120,.4)':''}"
          placeholder="Telegram ID"
          value="${tgVal}">
        <button class="btn btn-sm ${hasTg?'btn-outline':'btn-gold'}"
          style="${hasTg?'':'background:rgba(212,175,55,.2)'}"
          onclick="Admin.saveTgManual('${u.id}')">
          ${hasTg?'✏️':'Зберегти'}
        </button>
        <label title="Може надсилати сповіщення" style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-dim);cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="can-notify-${u.id}" ${raw?.can_notify?'checked':''}
            onchange="Admin.saveCanNotify('${u.id}',this.checked)"
            style="accent-color:var(--gold);width:14px;height:14px">
          🔔
        </label>
      </div>`;
    }).join('');
  },

  async saveTgManual(userId) {
    const input = $(`tg-manual-${userId}`);
    if (!input) return;
    const val = input.value.trim();
    if (val && !/^\d+$/.test(val)) { toast('ID має містити лише цифри', 'error'); return; }
    try {
      const upd = val ? { tg_id: parseInt(val), chat_id: parseInt(val) } : { tg_id: null, chat_id: null };
      await sb.update('users', upd, { id: userId });
      // Оновити кеш
      const users = DB.get('users', []);
      const i = users.findIndex(u => u.id === userId);
      if (i >= 0) { users[i].tg_id = upd.tg_id; users[i].chat_id = upd.chat_id; DB.set('users', users); }
      toast(val ? 'Telegram ID збережено' : 'Telegram ID видалено', 'success-t');
      Admin.renderTgManual();
    } catch(e) { toast('Помилка збереження', 'error'); console.error(e); }
  },

  saveBg() {
    const bgInput = $('bg-url-input');
    if (!bgInput) return;
    const url = bgInput.value.trim();
    DB.set('bg', url);
    const ls = $('login-screen');
    if (ls && url) {
      ls.style.backgroundImage =
        `linear-gradient(135deg,rgba(14,36,32,.95) 0%,rgba(22,56,50,.92) 100%), url('${url}')`;
    }
    toast('Фон збережено', 'success-t');
  },

  async saveCanNotify(userId, value) {
    try {
      await sb.update('users', { can_notify: value }, { id: userId });
      const users = DB.get('users', []);
      const i = users.findIndex(u => u.id === userId);
      if (i >= 0) { users[i].can_notify = value; DB.set('users', users); }
      toast(value ? '🔔 Права на сповіщення надано' : '🔕 Права на сповіщення знято', 'success-t');
    } catch(e) { toast('Помилка збереження', 'error'); console.error(e); }
  },

  async addUser() {
    const login = $('new-login').value.trim();
    const pass  = $('new-pass').value;
    const role  = $('new-role').value;
    if (!login || !pass) { toast('Заповніть логін та пароль', 'error'); return; }
    const users = DB.get('users',[]);
    if (users.find(u=>u.login===login)) { toast('Логін вже існує', 'error'); return; }
    const addBtn = document.querySelector('[onclick="Admin.addUser()"]');
    btnLock(addBtn);
    const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    const newUser = { id, login, password: pass, role, display_name: login, nick:'', avatar:'', tg_username:'', ig:'', fired: false };
    try {
      await sb.insert('users', newUser);
      newUser.displayName = login;
      const {password: _addPw, ...safeNewUser} = newUser;
      users.push(safeNewUser);
      DB.set('users', users);
      $('new-login').value=''; $('new-pass').value='';
      logEvent('admin', 'Додано користувача', login); toast(`Користувача ${login} додано`, 'success-t');
    } catch(e) { toast('Помилка створення: ' + e.message, 'error'); console.error(e); }
    btnUnlock(addBtn);
  },

  async addCustomRole() {
    const label = $('custom-role-input').value.trim();
    const key   = $('custom-role-key').value.trim().toLowerCase();
    if (!label||!key) { toast('Введіть назву і ключ ролі', 'error'); return; }
    const roles = DB.get('roles',[]);
    if (roles.find(r=>r.key===key)) { toast('Роль з таким ключем вже є', 'error'); return; }
    try {
      await sb.insert('roles', { key, label, custom: true });
      roles.push({ key, label, custom: true });
      DB.set('roles', roles);
      $('custom-role-input').value=''; $('custom-role-key').value='';
      logEvent('admin', 'Додано нову роль'); toast('Роль додано', 'success-t');
      Admin.renderCustomRoles();
      const sel = $('new-role');
      const opt = document.createElement('option');
      opt.value=key; opt.textContent=label;
      sel.appendChild(opt);
    } catch(e) { toast('Помилка', 'error'); console.error(e); }
  },

  renderCustomRoles() {
    const roles = DB.get('roles',[]).filter(r=>r.custom);
    $('custom-roles-list').innerHTML = roles.length
      ? roles.map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">
          <span style="font-size:12px">${r.label} <span class="muted">(${r.key})</span></span>
          <button class="btn btn-danger btn-sm" onclick="Admin.deleteRole('${r.key}')">✕</button>
        </div>`).join('')
      : `<p class="muted" style="font-size:11px">Немає кастомних ролей</p>`;
  },

  async deleteRole(key) {
    let roles = DB.get('roles',[]);
    roles = roles.filter(r=>r.key!==key);
    DB.set('roles', roles);
    try {
      await sb.delete('roles', { key });
      logEvent('admin', 'Видалено роль'); toast('Роль видалено', 'success-t');
      Admin.renderCustomRoles();
    } catch(e) { toast('Помилка', 'error'); console.error(e); }
  },
  // ══════════════════════════════════════════════════════════════
  // ДОСТУП ДО ВКЛАДОК — видимість сторінок для конкретного юзера
  // ══════════════════════════════════════════════════════════════

  // Повний список сторінок з мітками (і для яких ролей доступна)
  _allPages() {
    return App.getNavItems().filter(i => !i.adminOnly).map(i => ({
      page: i.page, icon: i.icon, label: i.label,
    }));
  },

  renderPageVisibility() {
    const el = $('page-vis-block');
    if (!el) return;
    const users = getUsers(false).filter(u => !isSysadmin(u));
    if (!users.length) {
      el.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Немає користувачів</p>';
      return;
    }
    const selVal = $('page-vis-user-select')?.value || '';
    el.innerHTML = '<div class="form-group" style="margin-bottom:14px">' +
      '<label class="lbl">Користувач</label>' +
      '<select id="page-vis-user-select" class="field" onchange="Admin.renderPageVisibility()">' +
      '<option value="">— Оберіть користувача —</option>' +
      users.map(u => '<option value="' + u.id + '"' + (u.id === selVal ? ' selected' : '') + '>' +
        esc(u.displayName || u.login) + ' · ' + getRoleLabel(u.role) + '</option>').join('') +
      '</select></div>' +
      '<div id="page-vis-pages"></div>';

    // Якщо юзер вибраний — одразу рендеримо чекбокси
    const uid = $('page-vis-user-select')?.value;
    if (uid) Admin._renderPageCheckboxes(uid);
    // Підвішуємо listener
    const sel = $('page-vis-user-select');
    if (sel) sel.addEventListener('change', () => {
      const id = sel.value;
      if (id) Admin._renderPageCheckboxes(id);
      else { const pp = $('page-vis-pages'); if (pp) pp.innerHTML = ''; }
    });
  },

  async _renderPageCheckboxes(userId) {
    const container = $('page-vis-pages');
    if (!container) return;
    // Завантажуємо актуальний стан напряму з Supabase (не з локального DB)
    let hiddenPages = [];
    try {
      const rows = await sb.query('settings', { filter: { key: LS_KEYS.PAGE_VIS_PREFIX + userId } });
      if (rows && rows[0]) hiddenPages = JSON.parse(rows[0].value || '[]');
      // Синхронізуємо з локальним DB
      DB.set(LS_KEYS.PAGE_VIS_PREFIX + userId, hiddenPages);
    } catch(e) { console.warn('page vis load error:', e); }
    const user = getUsers(false).find(u => u.id === userId);
    const pages = Admin._allPages();

    // Визначаємо які сторінки взагалі доступні цьому юзеру за роллю
    const roleVisible = (p) => true;

    container.innerHTML = '<div style="margin-bottom:10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)">Оберіть вкладки які бачить ' + esc((user?.displayName || user?.login) || 'юзер') + '</div>' +
      '<div id="page-vis-checkboxes" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">' +
      pages.map(p => {
        const roleOk = roleVisible(p);
        const checked = roleOk && !hiddenPages.includes(p.page);
        const disabled = !roleOk;
        return '<label style="display:flex;align-items:center;gap:10px;padding:8px 12px;' +
          'background:rgba(255,255,255,' + (disabled ? '.02' : '.04') + ');' +
          'border:1px solid rgba(255,255,255,' + (disabled ? '.04' : '.08') + ');' +
          'border-radius:8px;cursor:' + (disabled ? 'default' : 'pointer') + ';opacity:' + (disabled ? '.35' : '1') + '">' +
          '<input type="checkbox" data-vis-page="' + p.page + '"' +
            (checked ? ' checked' : '') + (disabled ? ' disabled' : '') +
            ' style="accent-color:var(--gold);width:15px;height:15px;flex-shrink:0">' +
          '<span style="font-size:13px">' + p.icon + '</span>' +
          '<span style="font-size:12px;font-weight:600;color:' + (disabled ? 'var(--text-muted)' : 'var(--text)') + '">' + p.label + '</span>' +
          (disabled ? '<span style="font-size:10px;color:var(--text-muted);margin-left:auto">недоступно для ролі</span>' : '') +
          '</label>';
      }).join('') +
      '</div>' +
      '<button class="btn btn-gold" data-vis-uid="' + userId + '" id="save-page-vis-btn">💾 Зберегти доступ</button>';

    // Прив'язуємо кнопку через addEventListener (уникаємо проблем з лапками в onclick)
    const saveBtn = document.getElementById('save-page-vis-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => Admin.savePageVisibility(userId));
  },

  async savePageVisibility(userId) {
    const btn = document.getElementById('save-page-vis-btn');
    if (btn) btnLock(btn);
    const checkboxes = document.querySelectorAll('[data-vis-page]');
    const hidden = [];
    checkboxes.forEach(cb => {
      if (!cb.checked && !cb.disabled) hidden.push(cb.dataset.visPage);
    });
    const key = LS_KEYS.PAGE_VIS_PREFIX + userId;
    try {
      await sb.upsert('settings', { key, value: JSON.stringify(hidden) }, 'key');
      DB.set(key, hidden);
      const user = getUsers(false).find(u => u.id === userId);
      const name = user?.displayName || user?.login || userId;
      logEvent('admin', 'Оновлено доступ до вкладок', name);
      toast('Доступ збережено для ' + esc(name), 'success-t');
    } catch(e) {
      toast('Помилка збереження', 'error');
      console.error(e);
    }
    if (btn) btnUnlock(btn);
  },
};

