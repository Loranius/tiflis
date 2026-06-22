// ╔═══════════════════════════════════════════════════════════════╗
// ║  [7/13]  ГРАФІК (розклад змін)                                ║
// ╚═══════════════════════════════════════════════════════════════╝
const WAITER_SHIFTS = [
  {val:'',  label:'—'},
  {val:'Р', label:'Р'},
  {val:'Х', label:'Х'},
  {val:'О', label:'О'},
  {val:'СН',label:'СН'},
  {val:'Б', label:'Б'},
  {val:'С', label:'С'},
  {val:'Р/Б',label:'Р/Б'},
  {val:'СН/Б',label:'СН/Б'},
];
const DEFAULT_SHIFTS = [
  {val:'',  label:'—'},
  {val:'Р', label:'Р'},
  {val:'Х', label:'Х'},
  {val:'О', label:'О'},
];

let scheduleActiveRole = '';

const Schedule = {
  calYear: null,
  calMonth: null,

  _initCal() {
    if (Schedule.calYear === null) {
      const n = NOW();
      Schedule.calYear  = n.getFullYear();
      Schedule.calMonth = n.getMonth();
    }
  },

  prevMonth() {
    Schedule._initCal();
    if (Schedule.calMonth === 0) { Schedule.calMonth = 11; Schedule.calYear--; }
    else Schedule.calMonth--;
    Schedule._updateMonthLabel();
    Schedule.renderTable(scheduleActiveRole, Schedule.calYear, Schedule.calMonth);
  },

  nextMonth() {
    Schedule._initCal();
    if (Schedule.calMonth === 11) { Schedule.calMonth = 0; Schedule.calYear++; }
    else Schedule.calMonth++;
    Schedule._updateMonthLabel();
    Schedule.renderTable(scheduleActiveRole, Schedule.calYear, Schedule.calMonth);
  },

  goToday() {
    const n = NOW();
    Schedule.calYear  = n.getFullYear();
    Schedule.calMonth = n.getMonth();
    Schedule._updateMonthLabel();
    Schedule.renderTable(scheduleActiveRole, Schedule.calYear, Schedule.calMonth);
  },

  _updateMonthLabel() {
    const el = $('schedule-nav-month');
    if (el) el.textContent = `${MONTHS_UA[Schedule.calMonth]} ${Schedule.calYear}`;
    const lbl = $('schedule-month-label');
    if (lbl) lbl.textContent = `${MONTHS_UA[Schedule.calMonth]} ${Schedule.calYear}`;
  },

  // Повертає список користувачів для ролі — враховує role2
  _getUsersForRole(role) {
    return getUsers().filter(u => u.role === role || u.role2 === role);
  },

  // ── Накопичення незбережених змін офіціанта ─────────────────────
  _pendingChanges: {}, // { key: { date, oldVal, newVal } }

  _recordChange(key, oldVal, newVal) {
    Schedule._pendingChanges[key] = { date: key.split('_').pop(), oldVal, newVal };
    Schedule._showWaiterSaveBtn();
  },

  _showWaiterSaveBtn() {
    if (isAdmin(currentUser)) return; // адмін має свою кнопку
    const count = Object.keys(Schedule._pendingChanges).length;
    const sa = $('schedule-actions');
    if (!sa) return;
    if (count === 0) { sa.innerHTML = ''; return; }
    sa.innerHTML = `
      <span style="font-size:11px;color:var(--text-dim);align-self:center">${count} зм.</span>
      <button class="btn btn-gold btn-sm" id="waiter-save-btn" onclick="Schedule.waiterSave()">
        💾 Зберегти зміни
      </button>`;
  },

  async waiterSave() {
    const changes = { ...Schedule._pendingChanges };
    const keys = Object.keys(changes);
    if (!keys.length) return;

    const btn = $('waiter-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Збереження...'; }

    try {
      // Зберігаємо кожну зміну в Supabase
      await Promise.all(keys.map(key => {
        const parts = key.split('_');
        const date = parts[parts.length - 1];
        const userId = parts.slice(0, -1).join('_');
        return Schedule._saveToSupabase(userId, date, (DB.get('schedule', {})[key] || ''));
      }));

      // Формуємо текст сповіщення
      const authorName = currentUser.displayName || currentUser.login;
      const authorRole = getRoleLabel(currentUser.role || '');
      const MONTH_NAMES = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
      const DOW_NAMES   = ['нд','пн','вт','ср','чт','пт','сб'];
      const SHIFT_LABELS_TG = {
        'Р':   '🟢 Р — робочий',
        'Х':   '🔴 Х — вихідний',
        'О':   '🟠 О — відпустка',
        'СН':  '🔵 СН — сніданки',
        'Б':   '🟡 Б — бар',
        'С':   '🟣 С',
        'Р/Б': '🟢 Р/Б — робочий+бар',
        'СН/Б':'🔵 СН/Б — сніданки+бар',
        '':    '⬜ — (порожньо)',
      };

      // Сортуємо по даті
      const sortedKeys = keys.slice().sort((a,b) => changes[a].date.localeCompare(changes[b].date));

      const changeLines = sortedKeys.map(key => {
        const { date, oldVal, newVal } = changes[key];
        const [y, m, d] = date.split('-').map(Number);
        const dow = DOW_NAMES[new Date(y, m-1, d).getDay()];
        const dateStr = `${d} ${MONTH_NAMES[m-1]} (${dow})`;
        const from = (SHIFT_LABELS_TG[oldVal] !== undefined ? SHIFT_LABELS_TG[oldVal] : oldVal) || '⬜ —';
        const to   = (SHIFT_LABELS_TG[newVal] !== undefined ? SHIFT_LABELS_TG[newVal] : newVal) || '⬜ —';
        return `📅 <b>${dateStr}</b>\n   ${from} ➜ ${to}`;
      }).join('\n\n');

      const now = new Date();
      const timeStr = `${now.getDate()} ${MONTH_NAMES[now.getMonth()]}, ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const tgText = [
        `╔══════════════════╗`,
        `  ✏️ <b>ЗМІНА ГРАФІКУ</b>`,
        `╚══════════════════╝`,
        ``,
        `👤 <b>${authorName}</b>`,
        `🎯 ${authorRole}`,
        ``,
        `─────────────────────`,
        changeLines,
        `─────────────────────`,
        ``,
        `🕐 ${timeStr}`,
        `<i>Портал персоналу · Тифліс</i>`,
      ].join('\n');

      const notifTitle = `✏️ ${authorName} змінив(ла) графік`;
      const notifBody  = sortedKeys.map(key => {
        const { date, oldVal, newVal } = changes[key];
        const [y, m, d] = date.split('-').map(Number);
        return `${d} ${MONTH_NAMES[m-1]}: ${oldVal||'—'} → ${newVal||'—'}`;
      }).join(', ');

      // Вставляємо в таблицю notifications (побачать всі адміни)
      try {
        const [inserted] = await sb.insert('notifications', {
          title: notifTitle,
          body: notifBody,
          priority: 'medium',
          author: authorName,
        });
        const items = DB.get('notifications', []);
        items.push(inserted);
        DB.set('notifications', items);
      } catch(e) { console.warn('Notify insert error:', e); }

      // Telegram — тільки адмінам, і лише якщо зміну зробив офіціант (не кухар)
      const authorIsCook = currentUser.role === 'cook' || currentUser.role2 === 'cook';
      if (!authorIsCook) {
        const admins = DB.get('users', []).filter(u => !u.fired && isAdmin(u));
        for (const adm of admins) {
          const chatId = adm.chat_id || adm.tg_id;
          if (chatId) await tgSendPersonal(chatId, tgText);
        }
      }

      // Скидаємо pending
      Schedule._pendingChanges = {};
      const sa = $('schedule-actions');
      if (sa) sa.innerHTML = '';
      logEvent('schedule', 'Збережено зміни в графіку'); toast('Зміни збережено ✅', 'success-t');
    } catch(e) {
      console.error('waiterSave error:', e);
      toast('Помилка збереження', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '💾 Зберегти зміни'; }
    }
  },

  init() {
    Schedule._initCal();
    Schedule._updateMonthLabel();

    // Зібрати всі ролі (включаючи role2)
    const allUsers = getUsers();
    const roleSet = new Set();
    allUsers.forEach(u => {
      if (u.role && u.role !== 'sysadmin') roleSet.add(u.role);
      if (u.role2 && u.role2 !== 'sysadmin') roleSet.add(u.role2);
    });
    const usedRoles = [...roleSet];

    // Легенда
    const legendItems = $('schedule-legend-items');
    legendItems.innerHTML = Object.entries(SHIFT_LABELS).map(([k,v])=>`
      <span style="display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;color:${SHIFT_COLORS[k]||'var(--text-dim)'}">
        ${k||'·'} — ${v}
      </span>`).join('');

    // Tabs
    const tabs = $('schedule-role-tabs');
    tabs.innerHTML = '';
    // Роль поточного користувача — щоб відкрити її першою
    const myRole = currentUser.role && currentUser.role !== 'sysadmin' ? currentUser.role : null;
    const defaultRole = (myRole && usedRoles.includes(myRole)) ? myRole : usedRoles[0];
    scheduleActiveRole = defaultRole;

    usedRoles.forEach((rk) => {
      const btn = document.createElement('button');
      btn.className = 'schedule-tab' + (rk === defaultRole ? ' active' : '');
      btn.textContent = getRoleLabel(rk);
      btn.onclick = () => {
        document.querySelectorAll('.schedule-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        scheduleActiveRole = rk;
        Schedule.renderTable(rk, Schedule.calYear, Schedule.calMonth);
      };
      tabs.appendChild(btn);
    });

    Schedule.renderTable(scheduleActiveRole, Schedule.calYear, Schedule.calMonth);

    const sa = $('schedule-actions');
    sa.innerHTML = '';
    if (isAdmin(currentUser)) {
      sa.innerHTML = `
        <button class="btn btn-outline btn-sm" onclick="ShiftSwap.openMySwaps()" id="my-swaps-btn" style="font-size:10px">⇄ Обміни</button>
        <button class="btn btn-ghost btn-sm" id="schedule-photo-btn">📷 Фото</button>
        <button class="btn btn-gold btn-sm" onclick="Schedule.saveAll()">💾 Зберегти</button>`;
      ShiftSwap._updateMySwapsBtn();
      // Кнопка фото — через addEventListener щоб працювала на мобільному
      const _spBtn = document.getElementById('schedule-photo-btn');
      if (_spBtn) _spBtn.addEventListener('click', () => Schedule.readPhoto());
    } else {
      sa.innerHTML = `<button class="btn btn-outline btn-sm" onclick="ShiftSwap.openMySwaps()" id="my-swaps-btn">⇄ Мої обміни</button>`;
      ShiftSwap._updateMySwapsBtn();
    }
  },


  // ── Читання фото графіку через Claude ────────────────────────────
  readPhoto() {
    let inp = document.getElementById('schedule-photo-input');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file';
      inp.id = 'schedule-photo-input';
      inp.accept = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/*';
      inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.value = '';
    inp.onchange = (e) => {
      const file = e.target.files[0];
      if (file) Schedule._processSchedulePhoto(file);
    };
    inp.click();
  },

  async _processSchedulePhoto(file) {
    // Показуємо оверлей-лоадер
    Schedule._showScheduleOverlay(`
      <div style="text-align:center;padding:48px 24px">
        <div style="font-size:44px;margin-bottom:16px">🔍</div>
        <div style="font-size:16px;font-weight:800;color:var(--gold);margin-bottom:6px">Claude читає графік</div>
        <div style="font-size:12px;color:var(--text-dim);line-height:1.5">Розпізнаю таблицю змін<br>Зазвичай займає 10–15 секунд</div>
        <div style="margin-top:24px;width:44px;height:44px;border:3px solid var(--gold-border);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;margin-left:auto;margin-right:auto"></div>
      </div>
    `);

    try {
      // Стискаємо фото (графік велика таблиця — потрібна хороша якість)
      const { base64, mediaType } = await new Promise((res, rej) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const MAX = 2400; // більше ніж для обов'язків — таблиця детальна
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          res({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
        };
        img.onerror = rej;
        img.src = url;
      });

      // Список офіціантів з БД
      const allUsers = getUsers().filter(u => !u.fired);
      const userNames = allUsers.map(u => `${u.displayName || u.login} (id:${u.id})`).join(', ');

      // Поточний місяць і рік з відображення
      const year  = Schedule.calYear  || new Date().getFullYear();
      const month = Schedule.calMonth !== null ? Schedule.calMonth + 1 : new Date().getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();

      const prompt = `Ти — асистент ресторану «Тифліс». На фото — паперовий графік змін офіціантів на ${month}-й місяць ${year} року.

Список офіціантів в системі:
${userNames}

Можливі позначки в клітинках:
- "р" або "Р" → зміна "Р" (робоча)
- "сн" або "СН" → зміна "СН" (сніданки)  
- "б" або "Б" → зміна "Б" (барна)
- "р/б" або "Р/Б" → зміна "Р/Б" (робоча + бар)
- "сн/б" або "СН/Б" → зміна "СН/Б" (сніданки + бар)
- "с" або "С" → зміна "С"
- "о" або "О" → зміна "О" (відпустка)
- порожня клітинка → вихідний (не включати у відповідь)

Твоє завдання:
1. Знайди кожного офіціанта з таблиці — зіставляй імена з моїм списком (Оксана=Оксана, Діма=Діма, Андрій=Андрій Швець тощо)
2. Для кожного офіціанта прочитай усі дні де є позначка (1–${daysInMonth})
3. Порожні клітинки = вихідний — НЕ включай у відповідь

Відповідай ТІЛЬКИ валідним JSON без пояснень:
{
  "month": ${month},
  "year": ${year},
  "schedule": [
    {"userId": "id_з_мого_списку", "name": "Ім'я", "days": {"1": "Р", "2": "Х", "5": "СН"}}
  ]
}

Де userId — це id з дужок в моєму списку (наприклад якщо список містить "Оксана (id:abc123)" то userId="abc123").
days — тільки дні з позначками (не вихідні).`;

      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
        body: JSON.stringify({ action: 'read_duties_photo', imageBase64: base64, mediaType, prompt })
      });

      if (!resp.ok) throw new Error(`Edge ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Edge function error');

      let parsed;
      try {
        parsed = JSON.parse((data.text || '').replace(/\`\`\`json|\`\`\`/g, '').trim());
      } catch(e) {
        throw new Error('Не вдалось розпарсити відповідь: ' + (data.text || '').slice(0, 200));
      }

      const entries = parsed.schedule || [];
      if (!entries.length) {
        Schedule._showScheduleOverlay(`
          <div style="text-align:center;padding:40px 20px">
            <div style="font-size:40px;margin-bottom:12px">🤷</div>
            <div style="font-size:14px;font-weight:700;color:var(--text)">Нічого не розпізнано</div>
            <div style="font-size:12px;color:var(--text-dim);margin-top:8px">Спробуй фото з кращим освітленням</div>
            <button class="btn btn-ghost btn-sm" style="margin-top:20px" data-action="close">Закрити</button>
          </div>
        `);
        return;
      }

      // Рахуємо загальну кількість записів
      let totalDays = 0;
      entries.forEach(e => { totalDays += Object.keys(e.days || {}).length; });

      // Превью по офіціантах
      const previewRows = entries.map((e, i) => {
        const dayCount = Object.keys(e.days || {}).length;
        const sample = Object.entries(e.days || {}).slice(0, 5)
          .map(([d, v]) => `${d}:${v}`).join(' ');
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">
            <input type="checkbox" id="sched-check-${i}" checked
              style="accent-color:var(--gold);width:16px;height:16px;flex-shrink:0">
            <div style="min-width:0;flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(e.name || e.userId)}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${dayCount} днів · ${esc(sample)}${dayCount > 5 ? '…' : ''}</div>
            </div>
          </div>`;
      }).join('');

      Schedule._pendingSchedulePhoto = { entries, month: parsed.month, year: parsed.year };

      Schedule._showScheduleOverlay(`
        <div style="padding:20px">
          <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:4px">📅 Розпізнано ${entries.length} офіціантів · ${totalDays} записів</div>
          <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px">Зніміть галочки з тих кого не потрібно імпортувати</div>
          <div style="max-height:55vh;overflow-y:auto;margin-bottom:16px">${previewRows}</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gold" style="flex:1" data-action="apply">✅ Імпортувати</button>
            <button class="btn btn-ghost" data-action="close">Скасувати</button>
          </div>
        </div>
      `);

    } catch(err) {
      console.error('Schedule photo error:', err);
      Schedule._showScheduleOverlay(`
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:40px;margin-bottom:12px">❌</div>
          <div style="font-size:14px;font-weight:700;color:var(--danger)">Помилка читання</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:8px;word-break:break-word">${esc(err.message)}</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:20px" data-action="close">Закрити</button>
        </div>
      `);
    }
  },

  async _applySchedulePhoto() {
    const pending = Schedule._pendingSchedulePhoto;
    if (!pending) { Schedule._closeScheduleOverlay(); return; }

    const { entries, month, year } = pending;
    const toApply = entries.filter((e, i) => {
      const cb = document.getElementById(`sched-check-${i}`);
      return cb && cb.checked;
    });

    if (!toApply.length) {
      Schedule._closeScheduleOverlay();
      toast('Нічого не вибрано', '');
      return;
    }

    Schedule._closeScheduleOverlay();
    toast('⏳ Зберігаємо графік...', '');

    // Зберігаємо в локальний кеш і в Supabase
    const scheduleMap = DB.get('schedule', {});
    let saved = 0;

    for (const entry of toApply) {
      const userId = entry.userId;
      if (!userId) continue;

      for (const [dayStr, shift] of Object.entries(entry.days || {})) {
        const day = parseInt(dayStr, 10);
        if (!day || day < 1 || day > 31) continue;

        // Формуємо дату YYYY-MM-DD
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const date = `${year}-${mm}-${dd}`;

        const key = `${userId}_${date}`;
        scheduleMap[key] = shift;

        // Зберігаємо в Supabase
        try {
          await sb.upsert('schedule', { user_id: userId, date, shift }, 'user_id,date');
          saved++;
        } catch(e) {
          console.warn('schedule upsert error:', date, e);
        }
      }
    }

    DB.set('schedule', scheduleMap);

    // Переходимо на місяць з графіку якщо він відрізняється
    if (month && year) {
      Schedule.calYear  = year;
      Schedule.calMonth = month - 1;
      Schedule._updateMonthLabel();
    }

    Schedule.renderTable(scheduleActiveRole, Schedule.calYear, Schedule.calMonth);
    toast(`✅ Імпортовано ${saved} записів графіку`, 'success-t');
    logEvent('schedule', `Імпорт графіку з фото: ${saved} записів`);
  },

  _pendingSchedulePhoto: null,

  _showScheduleOverlay(html) {
    let ov = document.getElementById('schedule-photo-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'schedule-photo-overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)';
      ov.addEventListener('click', e => { if (e.target === ov) Schedule._closeScheduleOverlay(); });
      document.body.appendChild(ov);
    }
    const inner = document.createElement('div');
    inner.style.cssText = 'background:var(--surface);border:1px solid var(--gold-border);border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:90vh;overflow-y:auto';
    inner.innerHTML = html;
    // addEventListener замість onclick — надійно на мобільному
    const applyBtn = inner.querySelector('[data-action="apply"]');
    if (applyBtn) applyBtn.addEventListener('click', () => Schedule._applySchedulePhoto());
    inner.querySelectorAll('[data-action="close"]').forEach(btn =>
      btn.addEventListener('click', () => Schedule._closeScheduleOverlay())
    );
    ov.innerHTML = '';
    ov.appendChild(inner);
    ov.style.display = 'flex';
  },

  _closeScheduleOverlay() {
    const ov = document.getElementById('schedule-photo-overlay');
    if (ov) ov.style.display = 'none';
  },

  toggleLegend() {
    const leg = $('schedule-legend');
    const icon = $('legend-toggle-icon');
    const txt  = $('legend-toggle-text');
    const hidden = leg.classList.toggle('hidden');
    icon.textContent = hidden ? '👁' : '🙈';
    txt.textContent  = hidden ? 'Показати позначки' : 'Сховати позначки';
  },

  renderTable(role, _year, _month) {
    const n = NOW();
    const year = _year !== undefined ? _year : n.getFullYear();
    const month = _month !== undefined ? _month : n.getMonth();
    // Зберегти поточний стан для drag handlers
    Schedule.currentRole = role;
    Schedule.currentYear = year;
    Schedule.currentMonth = month;
    const days = new Date(year, month+1, 0).getDate();
    const today = n.getDate();
    const schedule = DB.get('schedule', {});
    // Отримати порядок офіціантів (для даної ролі)
    const orderKey = `schedule_order_${role}`;
    const savedOrder = DB.get(orderKey, null);
    let users = Schedule._getUsersForRole(role);
    // Застосувати збережений порядок
    if (savedOrder && savedOrder.length) {
      const ordered = [];
      savedOrder.forEach(id => { const u = users.find(u=>u.id===id); if(u) ordered.push(u); });
      users.filter(u=>!savedOrder.includes(u.id)).forEach(u=>ordered.push(u));
      users = ordered;
    }
    const shifts = role==='waiter' ? WAITER_SHIFTS : DEFAULT_SHIFTS;
    const isAdminUser = isAdmin(currentUser);
    // Офіціанти можуть редагувати лише свій рядок
    const canEditAny = isAdminUser;

    const dayNames = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];

    let html = `<thead><tr><th class="name-th">Ім'я</th>`;
    for (let d=1; d<=days; d++) {
      const dow = new Date(year,month,d).getDay();
      const isToday = d===today;
      const weekend = dow===0||dow===6;
      html += `<th class="${isToday?'today-col':''}${weekend?' weekend-col':''}">${d}<br><span style="font-weight:400;font-size:9px">${dayNames[dow]}</span></th>`;
    }
    html += '</tr></thead><tbody>';

    if (!users.length) {
      html += `<tr><td colspan="${days+1}" style="padding:20px;text-align:center;color:var(--text-dim)">Немає персоналу з цією роллю</td></tr>`;
    }

    users.forEach(user => {
      // Чи це власний рядок поточного користувача
      const isOwnRow = currentUser && user.id === currentUser.id;
      // Редагування: адмін може всі рядки, офіціант — лише свій
      const canEditRow = canEditAny || isOwnRow;

      // Для вкладки барменів: якщо юзер тут через role2 (доп. роль бармен),
      // маппимо його зміни: Р→Х, Р/Б→Р, СН/Б→Р, решта комбо→Р, Х→Х
      const isSecondaryBarman = role === 'barman' && user.role !== 'barman' && user.role2 === 'barman';
      const mapShiftForBarman = (val) => {
        if (!val) return '';
        if (val === 'Х') return 'Х';
        if (val === 'Р') return 'Х';   // основний вихідний для офіціанта = вихідний у барі
        if (val === 'Р/Б') return 'Р'; // робочий+бар = робочий у барі
        if (val === 'СН/Б') return 'Р';// сніданки+бар = робочий у барі
        if (val === 'Б') return 'Р';   // бар = робочий у барі
        // всі інші (О, СН, С тощо) — вихідний у барі
        return 'Х';
      };

      const dragAttrs = canEditAny
        ? `draggable="true" class="schedule-row-drag${isOwnRow?' own-row':''}"
           ondragstart="Schedule._rowDragStart(event,'${user.id}','${role}')"
           ondragover="Schedule._rowDragOver(event)"
           ondrop="Schedule._rowDrop(event,'${user.id}','${role}')"
           ondragend="Schedule._rowDragEnd(event)"`
        : (isOwnRow ? 'class="schedule-row-own own-row"' : '');

      html += `<tr ${dragAttrs}><td class="name-cell">`;
      if (canEditAny) {
        html += `<span style="color:var(--text-muted);font-size:13px;cursor:grab;margin-right:6px;flex-shrink:0" title="Перетягнути">⠿</span>`;
      } else if (isOwnRow) {
        html += `<span style="font-size:10px;color:var(--gold);margin-right:4px;flex-shrink:0" title="Ваш рядок">✎</span>`;
      }
      html += `${user.displayName||user.login}`;
      if (user.role2 && user.role2 === role) {
        html += `<span style="font-size:9px;color:var(--gold);font-weight:700;margin-left:4px;opacity:.8">(+)</span>`;
      }      html += `</td>`;
      for (let d=1; d<=days; d++) {
        const dk = dateKey(year,month,d);
        const key = `${user.id}_${dk}`;
        let val = (schedule[key]||'');
        // Якщо це офіціант з доп. роллю бармен — маппимо зміни
        if (isSecondaryBarman) val = mapShiftForBarman(val);
        const cls = val ? `shift-${val.replace('/','').replace('/','')}` : '';
        const isColToday = d === today;
        const dow2 = new Date(year,month,d).getDay();
        const isWeekend2 = dow2 === 0 || dow2 === 6;
        const cellExtraClass = isColToday ? ' today-col' : (isWeekend2 ? ' weekend-col' : '');
        // Редагування: адмін усі, офіціант — свій рядок (не secondary barman)
        if (canEditRow && !isSecondaryBarman) {
          html += `<td class="${cellExtraClass}" onclick="Schedule.openShiftPicker(this,'${key}',${JSON.stringify(shifts.map(s=>s.val)).replace(/"/g,"'")})">
            <div class="shift-badge shift-${val.replace('/','').replace('/','')}" data-key="${key}" data-val="${val}">${val||'·'}</div>
          </td>`;
        } else {
          // Для не-адміна: показуємо клікабельний бейдж для запиту обміну
          const todayStr = dateKey(n.getFullYear(), n.getMonth(), n.getDate());
          const canSwapCell = !isAdmin(currentUser) && val && !isOwnRow && dk >= todayStr;
          if (canSwapCell) {
            html += `<td class="${cellExtraClass}">
              <div class="shift-badge swap-badge shift-${val.replace(/\//g,'')}"
                title="Запропонувати обмін"
                onclick="ShiftSwap.openProposalModal('${user.id}','${dk}','${val}','${esc(user.displayName||user.login)}')"
              >${val}</div>
            </td>`;
          } else {
            html += `<td class="${cls}${cellExtraClass}" style="font-weight:700;font-size:12px">${val||'—'}</td>`;
          }
        }
      }
      html += '</tr>';
    });

    html += '</tbody>';
    $('schedule-table').innerHTML = html;

    // Прокрутити до сьогоднішнього дня (лише якщо відображається поточний місяць)
    const isCurrentMonth = year === n.getFullYear() && month === n.getMonth();
    if (isCurrentMonth) {
      requestAnimationFrame(() => {
        const todayTh = $('schedule-table')?.querySelector('th.today-col');
        const wrapper = document.querySelector('.schedule-wrap');
        if (todayTh && wrapper) {
          const wrapRect = wrapper.getBoundingClientRect();
          const thRect   = todayTh.getBoundingClientRect();
          wrapper.scrollLeft += thRect.left - wrapRect.left - wrapRect.width / 2 + thRect.width / 2;
        }
      });
    }

    Schedule.renderSummary(role, year, month, days);
  },

  openShiftPicker(tdOrBadge, key, shiftVals) {
    // Remove any existing picker
    document.querySelector('.shift-picker')?.remove();

    // Support click on either td or the badge inside
    const td = tdOrBadge.classList.contains('shift-badge') ? tdOrBadge.closest('td') : tdOrBadge;
    const badge = td ? td.querySelector('.shift-badge') : null;
    if (!badge) return;
    const cur = badge.dataset.val || '';

    // Build shift list from current role's WAITER_SHIFTS or DEFAULT_SHIFTS
    const allShifts = shiftVals.map(v => {
      const found = [...WAITER_SHIFTS, ...DEFAULT_SHIFTS].find(s => s.val === v);
      return found || { val: v, label: v || '—' };
    });

    const picker = document.createElement('div');
    picker.className = 'shift-picker';

    allShifts.forEach(shift => {
      const btn = document.createElement('button');
      btn.className = 'shift-picker-btn' + (shift.val === cur ? ' active' : '') + (shift.val === '' ? ' empty' : '');
      btn.textContent = shift.val || '—';
      btn.title = shift.label;
      btn.onclick = (e) => {
        e.stopPropagation();
        picker.remove();
        Schedule.applyShift(badge, key, shift.val);
      };
      picker.appendChild(btn);
    });

    // Position fixed — прив'язано до комірки через viewport координати
    document.body.appendChild(picker);
    const rect = td.getBoundingClientRect();
    const pickerW = picker.offsetWidth || 190;
    const pickerH = picker.offsetHeight || 120;
    let left = rect.left;
    let top  = rect.bottom + 4;
    // Не виходити за правий край
    if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
    if (left < 8) left = 8;
    // Якщо немає місця знизу — показати зверху комірки
    if (top + pickerH > window.innerHeight - 8) top = rect.top - pickerH - 4;
    picker.style.left = left + 'px';
    picker.style.top  = top  + 'px';

    // Close on outside click
    const close = (e) => {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); }
    };
    setTimeout(() => document.addEventListener('click', close), 10);
  },

  applyShift(badge, key, val) {
    // Перевірка прав: офіціант може змінювати лише свій рядок
    const parts = key.split('_');
    const date = parts[parts.length - 1];
    const userId = parts.slice(0, -1).join('_');
    if (!isAdmin(currentUser) && currentUser && userId !== currentUser.id) {
      toast('Ви можете редагувати лише свій графік', 'error');
      return;
    }

    // Update cache
    const schedule = DB.get('schedule', {});
    const oldVal = schedule[key] || '';
    schedule[key] = val;
    DB.set('schedule', schedule);

    // Update badge UI
    badge.dataset.val = val;
    badge.textContent = val || '·';
    badge.className = 'shift-badge shift-' + val.replace(/\//g, '');

    if (isAdmin(currentUser)) {
      // Адмін — зберігає одразу
      Schedule._saveToSupabase(userId, date, val);
    } else {
      // Офіціант — накопичує зміни до натискання "Зберегти"
      Schedule._recordChange(key, oldVal, val);
    }

    // Якщо Duties відкриті — оновити їх щоб показувати актуальних офіціантів
    const dutiesNeedUpdate = ['handover', 'daily'].some(type => {
      const page = $('page-' + (type === 'handover' ? 'handover' : 'daily'));
      return page?.classList.contains('active');
    });
    if (dutiesNeedUpdate) {
      ['handover', 'daily'].forEach(type => {
        const page = $('page-' + (type === 'handover' ? 'handover' : 'daily'));
        if (page && page.classList.contains('active')) {
          const selDate = Duties._selectedDateKey(type);
          if (selDate === date) Duties.initFromCal(type);
        }
      });
    }
  },

  async _saveToSupabase(userId, date, shift) {
    try {
      await sb.upsert('schedule', { user_id: userId, date, shift }, 'user_id,date');
    } catch(e) {
      console.error('Schedule save error:', e);
      toast('Помилка збереження зміни', 'error');
    }
  },

  saveAll() {
    // Force save all pending changes from cache to Supabase
    const schedule = DB.get('schedule', {});
    let count = 0;
    const promises = Object.entries(schedule).map(([key, shift]) => {
      const parts = key.split('_');
      const date = parts[parts.length - 1];
      const userId = parts.slice(0, -1).join('_');
      if (!date || !userId) return Promise.resolve();
      count++;
      return Schedule._saveToSupabase(userId, date, shift);
    });
    Promise.all(promises).then(() => {
      toast(`Збережено ${count} записів`, 'success-t');
    });
  },

  // ── Drag & Drop для рядків графіку ──────────────────────────
  _dragSrcId: null,

  _rowDragStart(e, userId, role) {
    Schedule._dragSrcId = userId;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', userId);
  },

  _rowDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rows = [...document.querySelectorAll('.schedule-row-drag')];
    rows.forEach(r => r.classList.remove('drag-over-top','drag-over-bottom'));
    const tgt = e.currentTarget;
    const rect = tgt.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) tgt.classList.add('drag-over-top');
    else tgt.classList.add('drag-over-bottom');
    return false;
  },

  _rowDrop(e, targetId, role) {
    e.preventDefault();
    const srcId = Schedule._dragSrcId;
    if (!srcId || srcId === targetId) return;

    const orderKey = `schedule_order_${role}`;
    let users = Schedule._getUsersForRole(role);
    const savedOrder = DB.get(orderKey, null);
    if (savedOrder && savedOrder.length) {
      const ordered = [];
      savedOrder.forEach(id => { const u = users.find(u=>u.id===id); if(u) ordered.push(u); });
      users.filter(u=>!savedOrder.includes(u.id)).forEach(u=>ordered.push(u));
      users = ordered;
    }

    const srcIdx = users.findIndex(u => u.id === srcId);
    if (srcIdx < 0) return;
    const [moved] = users.splice(srcIdx, 1);

    const tgtIdx = users.findIndex(u => u.id === targetId);
    if (tgtIdx < 0) { users.push(moved); }
    else {
      const rect = e.currentTarget.getBoundingClientRect();
      const insertAfter = e.clientY >= rect.top + rect.height / 2;
      users.splice(insertAfter ? tgtIdx + 1 : tgtIdx, 0, moved);
    }

    const newOrder = users.map(u => u.id);
    DB.set(orderKey, newOrder);
    sb.upsert('settings', { key: orderKey, value: JSON.stringify(newOrder) }, 'key')
      .catch(err => console.warn('Order save failed:', err));

    document.querySelectorAll('.schedule-row-drag').forEach(r =>
      r.classList.remove('dragging','drag-over-top','drag-over-bottom'));
    Schedule.renderTable(Schedule.currentRole, Schedule.currentYear, Schedule.currentMonth);
  },

  _rowDragEnd(e) {
    document.querySelectorAll('.schedule-row-drag').forEach(r =>
      r.classList.remove('dragging','drag-over-top','drag-over-bottom'));
  },

  renderSummary(role, year, month, days) {
    const schedule = DB.get('schedule',{});
    const users = Schedule._getUsersForRole(role);

    if (!users.length) { $('schedule-summary').innerHTML = ''; return; }

    // Типи що вважаються "робочими" (включно з СН, С)
    const WORK_TYPES  = new Set(['Р','СН','С','Р/Б','СН/Б']);
    // Типи що вважаються "барними"
    const BAR_TYPES   = new Set(['Б','Р/Б','СН/Б']);
    // Типи що вважаються "вихідними"
    const OFF_TYPES   = new Set(['Х','О']);

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">';

    users.forEach(user => {
      let work = 0, bar = 0, off = 0;
      for (let d = 1; d <= days; d++) {
        const v = schedule[`${user.id}_${dateKey(year, month, d)}`] || '';
        if (!v) continue;
        if (WORK_TYPES.has(v)) work++;
        if (BAR_TYPES.has(v))  bar++;
        if (OFF_TYPES.has(v))  off++;
      }

      html += `<div style="background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px">
        <div style="font-weight:700;font-size:12px;margin-bottom:10px;color:var(--text)">${esc(user.displayName||user.login)}</div>
        <div style="display:flex;gap:6px">
          <div style="flex:1;text-align:center;background:rgba(72,199,142,.1);border:1px solid rgba(72,199,142,.2);border-radius:8px;padding:6px 4px">
            <div style="font-size:28px;font-weight:800;color:var(--success);line-height:1.1">${work}</div>
            <div style="font-size:9px;color:var(--text-dim);margin-top:2px">робочих</div>
          </div>
          ${role === 'waiter' && bar > 0 ? `
          <div style="flex:1;text-align:center;background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.2);border-radius:8px;padding:6px 4px">
            <div style="font-size:28px;font-weight:800;color:var(--gold);line-height:1.1">${bar}</div>
            <div style="font-size:9px;color:var(--text-dim);margin-top:2px">барних</div>
          </div>` : ''}
          <div style="flex:1;text-align:center;background:rgba(224,90,90,.1);border:1px solid rgba(224,90,90,.2);border-radius:8px;padding:6px 4px">
            <div style="font-size:28px;font-weight:800;color:var(--danger);line-height:1.1">${off}</div>
            <div style="font-size:9px;color:var(--text-dim);margin-top:2px">вихідних</div>
          </div>
        </div>
      </div>`;
    });

    html += '</div>';
    $('schedule-summary').innerHTML = html;
  }
};

