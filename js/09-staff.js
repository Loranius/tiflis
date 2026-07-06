// ╔═══════════════════════════════════════════════════════════════╗
// ║  [10/13] ПЕРСОНАЛ (список, профілі, додавання)                ║
// ╚═══════════════════════════════════════════════════════════════╝
const Staff = {
  section: 'active',
  filterRole: 'all', // поточний фільтр ролі
  viewMode: 'tiles', // 'tiles' | 'list' — вигляд списку персоналу

  init() {
    Staff.filterRole = 'all';
    Staff.viewMode = DB.get('staffViewMode', 'tiles');
    Staff.renderFilters();
    Staff.renderViewToggle();
    Staff.renderActive();
    // Кнопка додати — тільки адміну
    const adminBtns = $('staff-admin-btns');
    if (isAdmin(currentUser)) {
      adminBtns.innerHTML = `<button class="btn btn-gold" onclick="Staff.openAddUser()" style="display:flex;align-items:center;gap:6px;white-space:nowrap">＋ Додати</button>`;
    }
  },

  renderViewToggle() {
    const el = $('staff-view-toggle');
    if (!el) return;
    el.innerHTML = `
      <button class="staff-view-btn ${Staff.viewMode==='tiles'?'active':''}" onclick="Staff.setViewMode('tiles')">▦ Плитки</button>
      <button class="staff-view-btn ${Staff.viewMode==='list'?'active':''}" onclick="Staff.setViewMode('list')">☰ Список</button>
    `;
  },

  setViewMode(mode) {
    if (mode === Staff.viewMode) return;
    Staff.viewMode = mode;
    DB.set('staffViewMode', mode);
    Staff.renderViewToggle();
    if (Staff.section === 'active') Staff.renderActive();
  },

  showSection(sec) {
    Staff.section = sec;
    $('staff-active-section').classList.toggle('hidden', sec !== 'active');
    $('staff-fired-section').classList.toggle('hidden',  sec !== 'fired');
    if (sec === 'active') { Staff.renderFilters(); Staff.renderActive(); }
    else Staff.renderFired();
  },

  renderFilters() {
    const el = $('staff-role-filters');
    if (!el) return;
    const allUsers = getUsers(false);
    const total    = allUsers.length;
    const fired    = getUsers(true).length;
    const roles    = DB.get('roles', []).filter(r => r.key !== 'sysadmin');

    // Підрахунок по ролях
    const counts = {};
    allUsers.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });

    // Іконки ролей
    const roleIcons = {
      admin:'🛡️', waiter:'👨‍🍳', barman:'🍺', hostess:'✨',
      chef:'👨‍🍳', sommelier:'🍷', trainee:'🎓', runner:'🏃',
    };

    const makeFilter = (key, label, icon, count, active) =>
      `<button class="staff-role-filter ${active?'active':''}" onclick="Staff.setFilter('${key}')">
        ${icon} ${label} <span class="srf-count">${count}</span>
      </button>`;

    let html = makeFilter('all', 'Всі', '👥', total, Staff.filterRole === 'all');
    roles.forEach(r => {
      const cnt = counts[r.key] || 0;
      const icon = roleIcons[r.key] || '👤';
      html += makeFilter(r.key, r.label, icon, cnt, Staff.filterRole === r.key);
    });
    html += makeFilter('fired', 'Звільнені', '🚪', fired, Staff.filterRole === 'fired');

    el.innerHTML = html;

    // Оновити лейбл
    const lbl = $('staff-total-label');
    if (lbl) lbl.textContent = `Всього активних: ${total}`;
  },

  setFilter(roleKey) {
    if (roleKey === 'fired') {
      Staff.filterRole = 'fired';
      Staff.renderFilters();
      Staff.showSection('fired');
      return;
    }
    Staff.filterRole = roleKey;
    Staff.section = 'active';
    $('staff-active-section').classList.remove('hidden');
    $('staff-fired-section').classList.add('hidden');
    Staff.renderFilters();
    Staff.renderActive();
  },

  _formatDate(ts) {
    if (!ts) return '';
    const d = new Date(typeof ts === 'number' ? ts : ts);
    if (isNaN(d)) return '';
    const months = ['січня','лютого','березня','квітня','травня','червня',
                    'липня','серпня','вересня','жовтня','листопада','грудня'];
    return `З ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} р.`;
  },

  _formatTenure(ts) {
    if (!ts) return '';
    const d = new Date(typeof ts === 'number' ? ts : ts);
    if (isNaN(d)) return '';
    const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
    if (days < 30) return `${days} ${days===1?'день':days<5?'дні':'днів'}`;
    if (days < 365) { const m=Math.floor(days/30); return `${m} ${m===1?'міс.':m<5?'міс.':'міс.'}`; }
    const yrs=Math.floor(days/365), mths=Math.floor((days%365)/30);
    const yl=`${yrs} ${yrs===1?'рік':yrs<5?'роки':'р.'}`;
    return mths>0 ? `${yl} ${mths} міс.` : yl;
  },

  renderActive() {
    const roles = DB.get('roles', []).filter(r => r.key !== 'sysadmin');
    const allUsers = getUsers(false);

    // Відфільтровані юзери
    const users = Staff.filterRole === 'all'
      ? allUsers
      : allUsers.filter(u => u.role === Staff.filterRole);

    if (!users.length) {
      $('staff-active-section').innerHTML = `<p class="muted" style="padding:20px;text-align:center">Немає персоналу</p>`;
      return;
    }

    // Групуємо по ролях (якщо фільтр all) або показуємо просто список
    const groups = Staff.filterRole === 'all'
      ? roles.map(r => ({ role: r, members: users.filter(u => u.role === r.key) })).filter(g => g.members.length)
      : [{ role: null, members: users }];

    let html = '';
    groups.forEach(({ role, members }) => {
      if (role) {
        html += `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin:16px 0 8px;padding-left:2px">${role.label} · ${members.length}</div>`;
      }
      html += Staff.viewMode === 'tiles'
        ? `<div class="staff-tile-grid">${members.map(Staff._tileCard).join('')}</div>`
        : `<div class="staff-grid">${members.map(Staff._listCard).join('')}</div>`;
    });

    $('staff-active-section').innerHTML = html;
  },

  // ── Картка-плитка (вигляд "плитками") ────────────────────────────
  _tileCard(user) {
    const raw = getUserById(user.id);
    const dateStr = Staff._formatTenure(user.createdAt || raw?.created_at);
    const avatarContent = user.avatar
      ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
      : `<span>${(user.displayName||user.login)[0].toUpperCase()}</span>`;
    const hasIg = raw?.ig;
    const hasTgUser = raw?.tg;
    const name = (user.displayName||user.login).replace(/'/g,"\\'");
    return `<div class="staff-tile" data-role="${user.role||''}" onclick="Staff.showProfile('${user.id}')">
      <div class="staff-tile-top">
        <div class="staff-tile-avatar" onclick="event.stopPropagation();Staff.openAvatarFull('${user.id}')">${avatarContent}</div>
        <div style="display:flex;align-items:center;gap:5px;justify-content:center;flex-wrap:wrap">
          <div class="staff-tile-name">${esc(user.displayName||user.login)}</div>
          ${currentUser.id===user.id?'<span style="font-size:8.5px;font-weight:800;background:rgba(212,175,55,.2);border:1px solid rgba(212,175,55,.3);color:var(--gold);padding:1px 5px;border-radius:5px;flex-shrink:0">Я</span>':''}
        </div>
        ${user.nick?`<div class="staff-tile-nick">✨ ${esc(user.nick)}</div>`:''}
        ${dateStr?`<div class="staff-tile-date">⏳ ${dateStr}</div>`:''}
        <span class="staff-tile-role">${getRoleLabel(user.role)}</span>
      </div>
      ${(hasIg||hasTgUser)?`<div class="staff-tile-socials" onclick="event.stopPropagation()">
        ${hasTgUser?`<a class="staff-tile-soc tg" href="https://t.me/${hasTgUser}" target="_blank" onclick="event.stopPropagation()">✈️ @${esc(hasTgUser)}</a>`:''}
        ${hasIg?`<a class="staff-tile-soc ig" href="https://instagram.com/${hasIg}" target="_blank" onclick="event.stopPropagation()">📸 @${esc(hasIg)}</a>`:''}
      </div>`:''}
    </div>`;
  },

  // ── Картка-рядок (старий вигляд "списком") ──────────────────────
  _listCard(user) {
    const raw = getUserById(user.id);
    const dateStr = Staff._formatTenure(user.createdAt || raw?.created_at);
    const avatarContent = user.avatar
      ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
      : `<span>${(user.displayName||user.login)[0].toUpperCase()}</span>`;
    const hasIg = raw?.ig;
    const hasTgUser = raw?.tg;
    return `<div class="staff-card" data-role="${user.role||''}" onclick="Staff.showProfile('${user.id}')">
      <!-- Верхній рядок: аватар + ім'я + бейдж ролі -->
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div class="staff-card-avatar" style="flex-shrink:0" onclick="event.stopPropagation();Staff.openAvatarFull('${user.id}')">${avatarContent}</div>
        <div style="flex:1;min-width:0;overflow:hidden">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
            <div class="staff-card-name" style="min-width:0">${esc(user.displayName||user.login)}</div>
            ${currentUser.id===user.id?'<span style="font-size:9px;font-weight:800;background:rgba(212,175,55,.2);border:1px solid rgba(212,175,55,.3);color:var(--gold);padding:1px 5px;border-radius:5px;flex-shrink:0">Я</span>':''}
          </div>
          ${user.nick?`<div style="font-size:11px;color:var(--gold);font-style:italic;line-height:1.3">✨ ${esc(user.nick)}</div>`:''}
          ${dateStr?`<div class="staff-card-date">⏳ ${dateStr}</div>`:''}
        </div>
        <!-- Бейдж ролі — праворуч, flex-shrink:0 -->
        <div style="flex-shrink:0" onclick="event.stopPropagation()">
          <span class="badge badge-gold" style="font-size:10px;white-space:nowrap">${getRoleLabel(user.role)}</span>
        </div>
      </div>
      <!-- Соцмережі — окремий рядок знизу, завжди вміщаються -->
      ${(hasIg||hasTgUser)?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06)" onclick="event.stopPropagation()">
        ${hasTgUser?`<a href="https://t.me/${hasTgUser}" target="_blank" onclick="event.stopPropagation()"
          style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#7ec8e3;text-decoration:none;background:rgba(126,200,227,.08);border:1px solid rgba(126,200,227,.2);padding:4px 10px;border-radius:10px;overflow:hidden;max-width:100%;box-sizing:border-box">
          <span style="flex-shrink:0">✈️</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">@${esc(hasTgUser)}</span>
        </a>`:''}
        ${hasIg?`<a href="https://instagram.com/${hasIg}" target="_blank" onclick="event.stopPropagation()"
          style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#f472b6;text-decoration:none;background:rgba(244,114,182,.08);border:1px solid rgba(244,114,182,.2);padding:4px 10px;border-radius:10px;overflow:hidden;max-width:100%;box-sizing:border-box">
          <span style="flex-shrink:0">📸</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">@${esc(hasIg)}</span>
        </a>`:''}
      </div>`:''}
    </div>`;
  },

  renderFired() {
    const users = getUsers(true);
    if (!users.length) { $('fired-list').innerHTML = `<p class="muted" style="padding:12px">Немає звільнених</p>`; return; }
    $('fired-list').innerHTML = users.map(user=>`
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid rgba(255,255,255,.06)">
        ${avatarHTML(user,36,14)}
        <div style="flex:1">
          <div style="font-weight:700;font-size:12px">${user.displayName||user.login}</div>
          <div style="font-size:10px;color:var(--text-dim)">${getRoleLabel(user.role)}</div>
        </div>
        ${isAdmin(currentUser)?`
          <button class="btn btn-ghost btn-sm" onclick="Staff.rehire('${user.id}')">Відновити</button>
          <button class="btn btn-danger btn-sm" onclick="Staff.deleteUser('${user.id}')">Видалити</button>
        `:''}
      </div>`).join('');
  },

  showProfile(userId) {
    // Всі можуть дивитись картку. Адмін бачить сирі дані (з роллю), решта — display версію
    const user = isAdmin(currentUser)
      ? getDisplayUser(userId)   // показуємо display_role навіть адміну — Діма виглядає офіціантом
      : getDisplayUser(userId);
    if (!user) return;
    const ratings = DB.get('ratings',{})[userId]||{score:0};
    const isSelf = currentUser.id === userId;
    const rawUser = getUserById(userId);
    const targetIsSysadmin = rawUser && rawUser.id === SYSADMIN_ID;
    // Редагування: тільки свій профіль або адмін (не профіль сисадміна крім нього самого)
    const canEdit = isSelf || (isAdmin(currentUser) && !targetIsSysadmin);
    const canFire = isAdmin(currentUser) && !isSelf && !targetIsSysadmin;

    // Аватарка
    const avatarContent = user.avatar
      ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
      : (user.displayName||user.login)[0].toUpperCase();

    // ── Стаж (від дати вступу до сьогодні) ─────────────────────────
    const hireDate = user.createdAt || rawUser?.created_at;
    let tenureDays = 0, tenureLabel = '';
    if (hireDate) {
      const start = new Date(hireDate);
      tenureDays = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
      const yrs = Math.floor(tenureDays / 365);
      const mths = Math.floor((tenureDays % 365) / 30);
      if (tenureDays < 30) tenureLabel = `${tenureDays} ${tenureDays===1?'день':tenureDays<5?'дні':'днів'}`;
      else if (tenureDays < 365) { const m=Math.floor(tenureDays/30); tenureLabel=`${m} ${m===1?'місяць':m<5?'місяці':'місяців'}`; }
      else { const yl=`${yrs} ${yrs===1?'рік':yrs<5?'роки':'років'}`; tenureLabel=mths>0?`${yl} ${mths} ${mths===1?'місяць':mths<5?'місяці':'місяців'}`:yl; }
    }
    // ── Дні стажування (окреме поле trainee_days) ───────────────────
    const traineeDays = rawUser?.trainee_days || null;
    // ── День народження ──────────────────────────────────────────────
    const MONTHS_UA2 = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
    let bdayStr = '', bdayDays = null, isBdayToday = false;
    if (user.birthday) {
      const bd = new Date(user.birthday + 'T00:00:00');
      bdayStr = `${bd.getDate()} ${MONTHS_UA2[bd.getMonth()]}`;
      const today = new Date(); today.setHours(0,0,0,0);
      let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      bdayDays = Math.round((next - today) / 86400000);
      isBdayToday = bdayDays === 0;
    }

    showModal(`
      <!-- Кнопка закриття — поза hero, завжди зверху -->
      <button onclick="closeModal()" style="position:sticky;top:0;float:right;z-index:20;background:rgba(255,255,255,.12);border:none;color:rgba(255,255,255,.8);padding:0;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;width:30px;height:30px;font-size:16px;margin-bottom:-30px;margin-right:-4px;backdrop-filter:blur(4px)">✕</button>
      <!-- Hero секція з градієнтом -->
      <div class="profile-hero" style="text-align:center">
        ${isSelf?'<span style="position:absolute;top:14px;left:14px;font-size:10px;font-weight:700;background:rgba(212,175,55,.2);border:1px solid rgba(212,175,55,.3);color:var(--gold);padding:3px 10px;border-radius:8px">Мій профіль</span>':''}
        <div style="margin-top:${isSelf?'28':'8'}px">
          <div class="profile-hero-name">${user.displayName||user.login}</div>
          ${user.nick?`<div class="profile-hero-nick">✨ ${user.nick}</div>`:''}
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;flex-wrap:wrap">
            <span class="badge badge-gold">${getRoleLabel(user.role)}</span>
            ${user.role==='waiter'?`<span style="font-size:12px;font-weight:800;color:${ratings.score>=0?'var(--success)':'var(--danger)'}">${ratings.score>0?'+':''}${ratings.score}</span>`:''}
            ${isBdayToday?'<span style="font-size:16px;animation:bounce 1s infinite">🎂</span>':''}
          </div>
        </div>
        <!-- Аватар що "звисає" -->
        <div class="profile-avatar-hanging" id="pav-${userId}"
          onclick="Staff.openAvatarFull('${userId}');event.stopPropagation()" style="cursor:zoom-in"
          data-init="${(user.displayName||user.login)[0].toUpperCase()}">
          ${avatarContent}
          ${isBdayToday?'<div style="position:absolute;top:-4px;right:-4px;font-size:16px">🎂</div>':''}
        </div>
      </div>

      <!-- Тіло профілю з відступом для аватарки -->
      <div style="padding-top:64px">

        ${isBdayToday?`<div style="background:linear-gradient(135deg,rgba(236,72,153,.15),rgba(239,68,68,.08));border:1px solid rgba(236,72,153,.3);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="font-size:24px">🎉</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:#f9a8d4">Сьогодні День народження!</div>
            <div style="font-size:11px;color:rgba(249,168,212,.7)">Привітайте ${(user.displayName||user.login).split(' ')[0]} 🥳</div>
          </div>
        </div>`:''}

        ${tenureDays>0||traineeDays||canEdit?`<div class="profile-stats-grid" style="margin-bottom:8px">
          <!-- Днів у Тифліс — від created_at до сьогодні -->
          <div class="profile-stat-card gold" style="position:relative${canEdit?';cursor:pointer':''}"
            ${canEdit?`onclick="var w=document.getElementById('hired-inline-wrap');w.style.display=w.style.display==='none'?'block':'none'"`:''}>
            <div class="profile-stat-num">${tenureDays>0?tenureDays.toLocaleString('uk-UA'):'—'}</div>
            <div class="profile-stat-label">Днів у Тифліс</div>
            ${canEdit?`<div style="position:absolute;top:6px;right:8px;font-size:10px;opacity:.45">✏️</div>`:''}
          </div>
          <!-- Днів стажування — окреме поле trainee_days -->
          <div class="profile-stat-card muted" style="position:relative${canEdit?';cursor:pointer':''}"
            ${canEdit?`onclick="var w=document.getElementById('trainee-inline-wrap');w.style.display=w.style.display==='none'?'block':'none'"`:''}>
            <div class="profile-stat-num" style="font-size:${traineeDays?'28':'20'}px;color:var(--text-dim)">${traineeDays?traineeDays:'—'}</div>
            <div class="profile-stat-label">Днів стажування</div>
            ${canEdit?`<div style="position:absolute;top:6px;right:8px;font-size:10px;opacity:.45">✏️</div>`:''}
          </div>
        </div>

        <!-- Редагування дати вступу -->
        ${canEdit?`
        <div id="hired-inline-wrap" style="display:none;margin-bottom:8px;background:rgba(212,175,55,.06);border:1px solid var(--gold-border);border-radius:12px;padding:12px 14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:8px">📅 Дата першого дня у Тифліс</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="date" id="edit-hired-inline" class="field" style="flex:1;min-width:140px"
              value="${hireDate ? new Date(hireDate).toISOString().slice(0,10) : ''}">
            <button class="btn btn-gold btn-sm" onclick="Staff._saveHireDate('${userId}')">Зберегти</button>
          </div>
        </div>

        <!-- Редагування днів стажування -->
        <div id="trainee-inline-wrap" style="display:none;margin-bottom:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:8px">🎓 Кількість днів стажування (1–30)</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="number" id="edit-trainee-days" class="field" style="flex:1;min-width:80px"
              min="1" max="30" placeholder="напр. 14" value="${traineeDays||''}">
            <button class="btn btn-gold btn-sm" onclick="Staff._saveTraineeDays('${userId}')">Зберегти</button>
          </div>
        </div>`:''}

        <!-- Стаж словами (тільки якщо є дата вступу) -->
        ${tenureLabel?`<div style="text-align:center;font-size:11px;color:var(--text-dim);margin-bottom:12px">Загальний стаж: <span style="color:var(--text);font-weight:600">${tenureLabel}</span></div>`:''}
        `:''}

        <!-- Соцмережі та д.н. -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${user.tg?`<a href="https://t.me/${user.tg}" target="_blank" class="profile-info-row" style="text-decoration:none;color:inherit">
            <div class="profile-info-icon" style="background:rgba(59,130,246,.1);border-color:rgba(59,130,246,.2)">✈️</div>
            <div><div class="profile-info-label">Telegram</div><div class="profile-info-value" style="color:#60a5fa">@${user.tg}</div></div>
          </a>`:''}
          ${user.ig?`<a href="https://instagram.com/${user.ig}" target="_blank" class="profile-info-row" style="text-decoration:none;color:inherit">
            <div class="profile-info-icon" style="background:rgba(236,72,153,.1);border-color:rgba(236,72,153,.2)">📸</div>
            <div><div class="profile-info-label">Instagram</div><div class="profile-info-value" style="color:#f472b6">@${user.ig}</div></div>
          </a>`:''}
          ${user.zodiac?`<div class="profile-info-row">
            <div class="profile-info-icon" style="background:rgba(212,175,55,.08);border-color:rgba(212,175,55,.2)">🔮</div>
            <div style="flex:1">
              <div class="profile-info-label">Знак зодіаку</div>
              <div class="profile-info-value">${user.zodiac}</div>
            </div>
          </div>`:''}
          ${user.birthday?`<div class="profile-info-row">
            <div class="profile-info-icon" style="background:rgba(236,72,153,.1);border-color:rgba(236,72,153,.2)">🎂</div>
            <div style="flex:1">
              <div class="profile-info-label">День народження</div>
              <div class="profile-info-value">${bdayStr}</div>
            </div>
            ${bdayDays!==null&&bdayDays<=30&&!isBdayToday?`<span style="font-size:10px;font-weight:700;color:#f9a8d4;background:rgba(236,72,153,.15);border:1px solid rgba(236,72,153,.25);padding:2px 8px;border-radius:8px">${bdayDays===1?'завтра':bdayDays+' дн.'}</span>`:''}
          </div>`:''}
        </div>
      ${canEdit ? `
      <div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--gold-border);padding-top:16px">
        <div class="form-group">
          <label class="lbl">Аватарка</label>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input type="hidden" id="edit-avatar" value="${user.avatar||''}">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <div id="pav-preview-${userId}" style="width:52px;height:52px;border-radius:50%;background:var(--eden-light);border:2px solid var(--gold-border);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:var(--gold);flex-shrink:0">
                ${user.avatar?`<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`:(user.displayName||user.login)[0].toUpperCase()}
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <label class="btn btn-outline btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                  <input type="file" id="avatar-file-${userId}" accept="image/*" style="display:none"
                    onchange="Staff._uploadAvatar(this,'${userId}')">
                  📁 Завантажити фото
                </label>
                <span id="avatar-upload-status" style="font-size:11px;color:var(--text-dim)"></span>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group"><label class="lbl">Ім'я (відображається в системі)</label>
          <input type="text" id="edit-display-name" class="field" value="${user.displayName||user.login||''}" placeholder="Як відображати ім'я">
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Логін для входу: <b style="color:var(--text-dim)">${user.login||''}</b></div>
        </div>
        <div class="form-group"><label class="lbl">Псевдонім</label>
          <input type="text" id="edit-nick" class="field" value="${user.nick||''}"></div>
        ${isSelf?`<div class="form-group"><label class="lbl">Життєве кредо / статус</label>
          <textarea id="edit-credo" class="field" rows="2" placeholder="Наприклад: жити легко, любити міцно..."
            style="resize:none;font-family:'Cormorant Garamond',serif;font-style:italic">${esc(user.credo||'')}</textarea>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Показується під фото на весь екран</div></div>`:''}
        <div class="form-group"><label class="lbl">Telegram (@)</label>
          <input type="text" id="edit-tg" class="field" value="${user.tg_username||user.tg||''}"></div>
        <div class="form-group"><label class="lbl">Instagram (@)</label>
          <input type="text" id="edit-ig" class="field" value="${user.ig||''}"></div>
        <div class="form-group"><label class="lbl">Дата народження</label>
          <input type="date" id="edit-birthday" class="field" value="${user.birthday||''}"></div>
        <div class="form-group"><label class="lbl">Знак зодіаку 🔮</label>
          <select id="edit-zodiac" class="field">
            <option value="">— Не вказано —</option>
            ${['♈ Овен','♉ Телець','♊ Близнюки','♋ Рак','♌ Лев','♍ Діва','♎ Терези','♏ Скорпіон','♐ Стрілець','♑ Козеріг','♒ Водолій','♓ Риби'].map(z=>`<option value="${z}" ${(user.zodiac||'')=== z?'selected':''} >${z}</option>`).join('')}
          </select></div>
        ${(isSelf || isSysadmin(currentUser)) && rawUser?.password ? `
        <div class="form-group">
          <label class="lbl">Поточний пароль</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="password" id="current-pass-view" class="field" value="" placeholder="••••••••" readonly
              style="flex:1;cursor:default;background:rgba(0,0,0,.35);color:var(--gold);font-weight:700;letter-spacing:.1em">
            <button type="button" onclick="
              const f=document.getElementById('current-pass-view');
              f.type=f.type==='password'?'text':'password';
              this.textContent=f.type==='password'?'👁':'🙈';
            " style="background:rgba(255,255,255,.06);border:1px solid var(--gold-border);border-radius:6px;padding:8px 12px;cursor:pointer;font-size:15px;flex-shrink:0">👁</button>
          </div>
        </div>` : ''}
        ${isAdmin(currentUser) && !targetIsSysadmin ?`
        <div class="form-group"><label class="lbl">Новий пароль</label>
          <input type="password" id="edit-pass" class="field" placeholder="Залиште порожнім щоб не змінювати"></div>
        <div class="form-group"><label class="lbl">Основна роль</label>
          <select id="edit-role" class="field">
            ${DB.get('roles',[]).filter(r=>r.key!=='sysadmin').map(r=>`<option value="${r.key}" ${user.role===r.key?'selected':''}>${r.label}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="lbl">Додаткова роль (необов'язково)</label>
          <select id="edit-role2" class="field">
            <option value="">— Немає —</option>
            ${DB.get('roles',[]).filter(r=>r.key!=='sysadmin').map(r=>`<option value="${r.key}" ${user.role2===r.key?'selected':''}>${r.label}</option>`).join('')}
          </select></div>
        `:''}
        ${isSelf ? `
        <div class="form-group"><label class="lbl">Змінити пароль</label>
          <input type="password" id="edit-pass-self" class="field" placeholder="Залиште порожнім щоб не змінювати"></div>
        ` : ''}
      </div>` : ''}
      </div><!-- /тіло профілю -->
      <div class="modal-footer" style="margin-top:0">
        ${canFire?`<button class="btn btn-danger" onclick="Staff.fire('${user.id}')">Звільнити</button>`:''}
        ${canEdit?`<button class="btn btn-gold" onclick="Staff.saveProfile('${user.id}')">Зберегти</button>`:''}
        <button class="btn btn-ghost" onclick="closeModal()">Закрити</button>
      </div>`);
  },

  _previewAvatar(url, userId) {
    const el = $('pav-' + userId);
    if (el) {
      if (url) el.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent=this.parentElement.dataset.init">`;
      else el.textContent = el.dataset.init || '?';
    }
    const prev = $('pav-preview-' + userId);
    if (prev) {
      if (url) prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`;
    }
  },

  async _uploadAvatar(input, userId) {
    const file = input.files[0];
    if (!file) return;
    const status = $('avatar-upload-status');
    const label = input.closest('label');
    if (status) status.textContent = '⏳ Завантаження...';
    if (label) { label.style.opacity = '.5'; label.style.pointerEvents = 'none'; }
    try {
      const url = await uploadImageFile(file, 'images', 'avatars');
      const avatarInput = $('edit-avatar');
      if (avatarInput) { avatarInput.value = url; Staff._previewAvatar(url, userId); }
      if (status) status.textContent = '✓ Завантажено';
    } catch(e) {
      console.error(e);
      toast('Помилка завантаження: ' + e.message, 'error');
      if (status) status.textContent = '';
    } finally {
      if (label) { label.style.opacity = ''; label.style.pointerEvents = ''; }
    }
  },

  async saveProfile(userId) {
    const saveBtn = document.querySelector(`[onclick="Staff.saveProfile('${userId}')"]`);
    btnLock(saveBtn);
    const users = DB.get('users',[]);
    const i = users.findIndex(u=>u.id===userId);
    if (i<0) { btnUnlock(saveBtn); return; }
    const targetIsSysadmin = userId === SYSADMIN_ID;
    const isSelf = currentUser.id === userId;
    users[i].avatar      = $('edit-avatar')?.value.trim()||users[i].avatar;
    const newDisplayName = $('edit-display-name')?.value.trim();
    if (newDisplayName) { users[i].display_name = newDisplayName; users[i].displayName = newDisplayName; users[i].login = newDisplayName; }
    users[i].nick        = $('edit-nick')?.value.trim()||'';
    if ($('edit-credo')) users[i].credo = $('edit-credo').value.trim();
    users[i].tg_username = $('edit-tg')?.value.trim().replace('@','')||'';
    users[i].ig          = $('edit-ig')?.value.trim().replace('@','')||'';
    users[i].birthday    = $('edit-birthday')?.value||'';
    users[i].zodiac      = $('edit-zodiac')?.value||'';
    const newPass  = ($('edit-pass') || $('edit-pass-self'))?.value;
    const newRole  = $('edit-role')?.value;
    const newRole2 = $('edit-role2')?.value;

    // Підтвердження зміни пароля
    const doSave = async () => {
      if (newPass && (isAdmin(currentUser) || isSelf)) users[i].password = newPass;
      if (newRole && isAdmin(currentUser) && !targetIsSysadmin) users[i].role = newRole;
      if (isAdmin(currentUser) && !targetIsSysadmin) users[i].role2 = newRole2 || null;
      // Не зберігаємо пароль у кеші localStorage
      const {password: _sp2, ...safeUser} = users[i];
      const usersForCache = users.map(u => { if (u.id === userId) return safeUser; const {password: _p, ...s} = u; return s; });
      DB.set('users', usersForCache);
      try {
        const upd = { avatar: users[i].avatar, nick: users[i].nick, credo: users[i].credo, tg_username: users[i].tg_username, ig: users[i].ig, birthday: users[i].birthday||null, zodiac: users[i].zodiac||null };
        if (newDisplayName) { upd.display_name = newDisplayName; upd.login = newDisplayName; }
        if (newPass && (isAdmin(currentUser) || isSelf)) upd.password = newPass;
        if (newRole  && isAdmin(currentUser) && !targetIsSysadmin) upd.role = newRole;
        if (isAdmin(currentUser) && !targetIsSysadmin) upd.role2 = newRole2 || null;
        await sb.update('users', upd, { id: userId });
        if (userId===currentUser.id) {
          const {password: _sp, ...safeCurrent} = users[i];
          currentUser = { ...safeCurrent, displayName: users[i].display_name || users[i].login, tg: users[i].tg_username || users[i].tg || '' };
          App.initUI();
        }
        logEvent('staff', 'Редагування профілю', users[i].displayName || users[i].login);
        toast('Профіль збережено', 'success-t');
        closeModal();
        Staff.renderActive();
      } catch(e) {
        toast('Помилка збереження', 'error');
        console.error(e);
        btnUnlock(saveBtn);
      }
    };

    if (newPass && (isAdmin(currentUser) || isSelf)) {
      btnUnlock(saveBtn);
      const target = isAdmin(currentUser) && !isSelf ? ` для "${users[i].displayName || users[i].login}"` : '';
      showConfirm(`Змінити пароль${target}?`, doSave, { okLabel: '🔑 Змінити пароль', okClass: 'btn-gold' });
    } else {
      await doSave();
    }
  },

  async fire(userId) {
    showConfirm('Звільнити цього співробітника?', async () => {
      const users = DB.get('users',[]);
      const i = users.findIndex(u=>u.id===userId);
      if (i<0) return;
      users[i].fired = true;
      DB.set('users', users);
      try {
        await sb.update('users', { fired: true }, { id: userId });
        toast('Співробітника звільнено', 'success-t');
        closeModal();
        Staff.renderActive();
      } catch(e) { toast('Помилка', 'error'); console.error(e); }
    }, { okLabel: '🔴 Звільнити' });
  },

  async rehire(userId) {
    const users = DB.get('users',[]);
    const i = users.findIndex(u=>u.id===userId);
    if (i<0) return;
    users[i].fired = false;
    DB.set('users', users);
    try {
      await sb.update('users', { fired: false }, { id: userId });
      toast('Відновлено', 'success-t');
      Staff.renderFired();
      Staff.renderActive();
    } catch(e) { toast('Помилка', 'error'); console.error(e); }
  },

  async deleteUser(userId) {
    showConfirm('Назавжди видалити всі дані користувача? Це незворотна дія.', async () => {
      let users = DB.get('users',[]);
      users = users.filter(u=>u.id!==userId);
      DB.set('users', users);
      const cashDB = DB.get('cash',{}); delete cashDB[userId]; DB.set('cash', cashDB);
      const ratings = DB.get('ratings',{}); delete ratings[userId]; DB.set('ratings', ratings);
      try {
        await sb.delete('users', { id: userId });
        logEvent('staff', 'Звільнено/видалено співробітника'); toast('Користувача видалено', 'success-t');
        Staff.renderFired();
      } catch(e) { toast('Помилка', 'error'); console.error(e); }
    }, { okLabel: '🗑 Видалити назавжди' });
  },

  async _saveTraineeDays(userId) {
    const input = document.getElementById('edit-trainee-days');
    if (!input) return;
    const val = parseInt(input.value);
    if (!val || val < 1 || val > 30) { toast('Введіть число від 1 до 30', 'error'); return; }
    const users = DB.get('users', []);
    const i = users.findIndex(u => u.id === userId);
    if (i < 0) return;
    users[i].trainee_days = val;
    DB.set('users', users);
    try {
      await sb.update('users', { trainee_days: val }, { id: userId });
      toast('Збережено', 'success-t');
      closeModal();
      Staff.renderActive();
      Staff.showProfile(userId);
    } catch(e) { toast('Помилка збереження', 'error'); console.error(e); }
  },

  async _saveHireDate(userId) {
    const input = document.getElementById('edit-hired-inline');
    if (!input || !input.value) { toast('Оберіть дату', 'error'); return; }
    const newDate = input.value;
    const users = DB.get('users', []);
    const i = users.findIndex(u => u.id === userId);
    if (i < 0) return;
    users[i].created_at = newDate;
    users[i].createdAt  = newDate;
    DB.set('users', users);
    try {
      await sb.update('users', { created_at: newDate }, { id: userId });
      toast('Дату стажування збережено', 'success-t');
      closeModal();
      Staff.renderActive();
      // Повторно відкрити профіль з оновленими даними
      Staff.showProfile(userId);
    } catch(e) { toast('Помилка збереження', 'error'); console.error(e); }
  },

  openAddUser() {
    App.navigate('admin');
    // Скролимо до форми і фокусуємо поле логіну
    setTimeout(() => {
      const loginInput = $('new-login');
      if (loginInput) {
        loginInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        loginInput.focus();
      }
    }, 100);
  },

  openAvatarFull(userId) {
    // Відкриває фото користувача на весь екран + життєве кредо під ним
    const user = getDisplayUser(userId);
    if (!user) return;
    const name = user.displayName || user.login;
    const isSelf = currentUser.id === userId;
    const canEditCredo = isSelf; // кредо редагує лише власник акаунту

    const overlay = document.createElement('div');
    overlay.id = 'avatar-full-overlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:9999',
      'background:rgba(0,0,0,.92)','backdrop-filter:blur(6px)',
      'display:flex','align-items:center','justify-content:center',
      'flex-direction:column','gap:14px','padding:20px','overflow-y:auto',
    ].join(';');

    const photoHtml = user.avatar
      ? `<img src="${user.avatar}" alt="${esc(name)}"
          style="max-width:min(420px,86vw);max-height:52vh;object-fit:cover;
                 border-radius:18px;border:2px solid var(--gold-border);
                 box-shadow:0 12px 50px rgba(0,0,0,.6)">`
      : `<div style="width:160px;height:160px;border-radius:50%;background:var(--eden-light);
                border:2px solid var(--gold-border);display:flex;align-items:center;justify-content:center;
                font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:700;color:var(--gold)">
          ${name[0].toUpperCase()}
        </div>`;

    overlay.innerHTML = `
      <div style="cursor:zoom-out" onclick="if(event.target===this)Staff._closeAvatarOverlay()">${photoHtml}</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:20px;
                  color:var(--gold);letter-spacing:.06em;font-weight:600;text-align:center">${esc(name)}</div>
      <div class="avatar-full-credo" id="avatar-full-credo-${userId}">
        ${Staff._credoBoxHTML(userId, user.credo, canEditCredo)}
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,.35);letter-spacing:.1em;text-transform:uppercase;cursor:pointer" onclick="Staff._closeAvatarOverlay()">
        Натисніть щоб закрити
      </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) Staff._closeAvatarOverlay(); });
    document.body.appendChild(overlay);
  },

  _closeAvatarOverlay() {
    const el = $('avatar-full-overlay');
    if (el) el.remove();
  },

  _credoBoxHTML(userId, credo, canEdit) {
    return `
      <div class="avatar-full-credo-label">Життєве кредо</div>
      <div class="avatar-full-credo-text ${credo?'':'avatar-full-credo-empty'}">${credo ? '«'+esc(credo)+'»' : (canEdit ? 'Ви ще не додали свій статус' : 'Статус не вказано')}</div>
      ${canEdit?`<button class="avatar-full-credo-edit-btn" onclick="event.stopPropagation();Staff._editCredoInline('${userId}')">✏️ ${credo?'Змінити':'Додати'}</button>`:''}
    `;
  },

  _editCredoInline(userId) {
    const box = $('avatar-full-credo-' + userId);
    if (!box) return;
    const user = getDisplayUser(userId);
    box.innerHTML = `
      <div class="avatar-full-credo-label">Життєве кредо</div>
      <textarea class="avatar-full-credo-textarea" id="avatar-full-credo-input-${userId}"
        placeholder="Наприклад: жити легко, любити міцно...">${esc(user.credo||'')}</textarea>
      <div class="avatar-full-credo-save-row">
        <button class="btn btn-gold btn-sm" onclick="event.stopPropagation();Staff._saveCredoInline('${userId}')">Зберегти</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Staff._closeAvatarOverlay();Staff.openAvatarFull('${userId}')">Скасувати</button>
      </div>`;
    $('avatar-full-credo-input-' + userId)?.focus();
  },

  async _saveCredoInline(userId) {
    if (currentUser.id !== userId) return; // лише власник акаунту редагує своє кредо
    const input = $('avatar-full-credo-input-' + userId);
    if (!input) return;
    const val = input.value.trim();
    const users = DB.get('users', []);
    const i = users.findIndex(u => u.id === userId);
    if (i < 0) return;
    users[i].credo = val;
    DB.set('users', users);
    const box = $('avatar-full-credo-' + userId);
    if (box) box.innerHTML = Staff._credoBoxHTML(userId, val, true);
    try {
      await sb.update('users', { credo: val }, { id: userId });
      toast('Кредо збережено', 'success-t');
      if (Staff.section === 'active') Staff.renderActive();
    } catch(e) {
      toast('Помилка збереження', 'error');
      console.error(e);
    }
  }
};

