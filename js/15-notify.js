const Notify = {
  init() {
    Notify.render();
    Notify.checkTgBanner();
    Notify.renderBotSettings();
    // Показати кнопку "Нове" тільки адміну
    const newBtn = $('notify-new-btn');
    if (newBtn) {
      newBtn.innerHTML = canSendNotify(currentUser)
        ? '<button class="btn btn-gold btn-sm" onclick="Notify.openNew()">＋ Нове сповіщення</button>'
        : '';
    }
  },

  renderBotSettings() {
    const el = $('tg-bot-settings');
    if (!el || !isAdmin(currentUser)) { if (el) el.innerHTML = ''; return; }
    const current = getTgToken();
    el.innerHTML = `
      <div style="background:rgba(37,152,218,.08);border:1px solid rgba(37,152,218,.25);border-radius:12px;padding:16px 18px;margin-bottom:20px">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <span style="font-size:20px">🤖</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:#7ec8e3;margin-bottom:4px">Telegram Bot Token</div>
            <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px">Токен вашого бота з @BotFather. Потрібен для надсилання повідомлень напряму.</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <input type="password" id="tg-bot-token-input" class="field" style="flex:1;min-width:200px;padding:7px 10px;font-size:12px;font-family:monospace"
                placeholder="1234567890:AAF..." value="${current ? '••••••••••••••••' : ''}">
              <button class="btn btn-sm" style="background:rgba(37,152,218,.25);color:#7ec8e3;border:1px solid rgba(37,152,218,.4)"
                onclick="Notify.saveBotToken()">💾 Зберегти</button>
              ${current ? `<button class="btn btn-sm btn-ghost" onclick="Notify.testBot(event)">📤 Тест</button>` : ''}
            </div>
            ${current ? `<div style="font-size:10px;color:var(--success);margin-top:6px">✅ Токен встановлено</div>` : `<div style="font-size:10px;color:var(--warning);margin-top:6px">⚠️ Токен не встановлено — повідомлення не надсилаються</div>`}
          </div>
        </div>
      </div>`;
  },

  async saveBotToken() {
    const input = $('tg-bot-token-input');
    const val = input ? input.value.trim() : '';
    if (!val || val.startsWith('•')) { toast('Введіть новий токен', 'error'); return; }
    // Валідація формату токена
    if (!/^\d+:[\w-]{35,}$/.test(val)) { toast('Невірний формат токена. Має бути: 1234567890:AAF...', 'error'); return; }
    // Зберігаємо в localStorage і DB
    localStorage.setItem('tiflis_tg_token', val);
    DB.set('tg_bot_token', val);
    // Зберігаємо в Supabase settings для синхронізації між пристроями
    try {
      await sb.upsert('settings', { key: 'tg_bot_token', value: JSON.stringify(val) }, 'key');
      toast('Токен збережено!', 'success-t');
      Notify.renderBotSettings();
    } catch(e) {
      toast('Збережено локально (Supabase недоступний)', 'success-t');
      Notify.renderBotSettings();
    }
  },

  async testBot(event) {
    const adminId = currentUser.tg_id || currentUser.chat_id;
    if (!adminId) { toast('Спочатку вкажіть свій Telegram ID нижче', 'error'); return; }
    const btn = event?.target || event?.currentTarget;
    btnLock(btn);
    try {
      await tgSendPersonal(adminId, '✅ Тест Тифліс-портал: бот працює! Повідомлення надходять.');
      toast('Тестове повідомлення надіслано!', 'success-t');
    } catch(e) {
      toast('Помилка відправки', 'error');
    } finally {
      btnUnlock(btn);
    }
  },

  checkTgBanner() {
    // Показати банер якщо tg_id не прив'язано (для всього персоналу)
    const u = currentUser;
    // Вважаємо прив'язаним якщо є tg_id (числовий) — відрізняємо від tg_username (@...)
    const hasTgId = u.tg_id && String(u.tg_id).trim() !== '';
    const banner = $('tg-link-banner');
    if (!banner) return;
    if (hasTgId) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  },

  async saveTgId() {
    const input = $('tg-id-input');
    const val = input ? input.value.trim() : '';
    if (!val) { toast('Введіть Telegram ID', 'error'); return; }
    // Telegram user ID — лише цифри
    if (!/^\d+$/.test(val)) { toast('Telegram ID має містити лише цифри. Дізнайтесь свій ID через @userinfobot', 'error'); return; }
    try {
      await sb.update('users', { tg_id: val }, { id: currentUser.id });
      currentUser.tg_id = val;
      // Оновити в кеші
      const users = DB.get('users', []);
      const i = users.findIndex(u => u.id === currentUser.id);
      if (i >= 0) { users[i].tg_id = val; DB.set('users', users); }
      toast('Telegram успішно прив\'язано!', 'success-t');
      $('tg-link-banner').classList.add('hidden');
    } catch(e) { toast('Помилка збереження', 'error'); console.error(e); }
  },

  getAll() {
    return DB.get('notifications', []);
  },

  render() {
    const list = $('notifications-list');
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const role = currentUser?.role || '';
    const allItems = Notify.getAll().filter(n => {
      // Перевірка терміну (expires_at або created_at + 3 дні)
      const exp = n.expires_at ? new Date(n.expires_at).getTime() : (new Date(n.created_at).getTime() + 3*24*60*60*1000);
      if (exp < Date.now()) return false;
      // Перевірка ролі (якщо roles вказано — показуємо тільки відповідним)
      if (n.roles && !isAdmin(currentUser)) {
        const nr = n.roles.split(',').map(r=>r.trim());
        if (!nr.includes(role) && !nr.includes(currentUser?.role2)) return false;
      }
      return true;
    });
    const items = allItems.slice().reverse(); // Нові зверху

    if (!items.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--text-dim)">
          <div style="font-size:40px;margin-bottom:12px">🔔</div>
          <div style="font-size:14px;font-weight:600">Немає сповіщень</div>
          ${canSendNotify(currentUser) ? '<div style="font-size:11px;margin-top:6px">Натисніть «＋ Нове сповіщення» щоб створити</div>' : ''}
        </div>`;
      return;
    }

    const PRIORITY_CFG = {
      high:   { label: '🔴 Важливо',    color: 'var(--danger)',  bg: 'rgba(224,90,90,.08)',  border: 'rgba(224,90,90,.3)'  },
      medium: { label: '🟡 Звичайне',   color: 'var(--warning)', bg: 'rgba(224,160,80,.08)', border: 'rgba(224,160,80,.3)' },
      low:    { label: '🟢 Інформація', color: 'var(--success)', bg: 'rgba(90,175,122,.08)', border: 'rgba(90,175,122,.3)' },
    };

    list.innerHTML = items.map((n) => {
      const cfg = PRIORITY_CFG[n.priority] || PRIORITY_CFG.medium;
      const _d = n.created_at ? new Date(n.created_at) : new Date();
      const dateStr = _d.toLocaleDateString('uk', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
      return `
        <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:12px;padding:16px;margin-bottom:12px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:10px;font-weight:700;color:${cfg.color};text-transform:uppercase;letter-spacing:.06em">${cfg.label}</span>
              <span style="font-size:10px;color:var(--text-muted)">${dateStr} · ${n.author}</span>
            </div>
            ${(isAdmin(currentUser) || n.author===(currentUser.displayName||currentUser.login))?`<button onclick="Notify.delete(${n.id})" style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;padding:0;line-height:1;flex-shrink:0">✕</button>`:''}
          </div>
          <div style="font-size:14px;font-weight:700;margin-bottom:6px">${n.title}</div>
          ${n.body ? `<div style="font-size:12px;color:var(--text-dim);line-height:1.6">${n.body}</div>` : ''}
          ${n.photo_url ? `<div style="margin-top:10px"><img src="${n.photo_url}" alt="Фото" style="max-width:100%;max-height:220px;border-radius:10px;object-fit:cover" onerror="this.style.display='none'"></div>` : ''}
          ${(n.roles && isAdmin(currentUser)) ? `<div style="margin-top:8px;font-size:10px;color:var(--text-muted)">👥 Для: ${n.roles.split(',').map(r=>{const rl=DB.get('roles',[]).find(x=>x.key===r);return rl?.label||r;}).join(', ')}</div>` : ''}
        </div>`;
    }).join('');
  },

  openNew() {
    if (!canSendNotify(currentUser)) { toast('Недостатньо прав', 'error'); return; }
    const roles = DB.get('roles',[]).filter(r=>r.key!=='sysadmin');
    showModal(`
      <div class="modal-title">🔔 Нове сповіщення</div>
      <div style="display:flex;flex-direction:column;gap:12px" id="notif-form-step">
        <div class="form-group">
          <label class="lbl">Пріоритет</label>
          <select id="notif-priority" class="field" onchange="Notify._livePreview()">
            <option value="high">🔴 Важливо</option>
            <option value="medium" selected>🟡 Звичайне</option>
            <option value="low">🟢 Інформація</option>
          </select>
        </div>
        <div class="form-group">
          <label class="lbl">Заголовок *</label>
          <input type="text" id="notif-title" class="field" placeholder="Коротко і чітко..." oninput="Notify._livePreview()">
        </div>
        <div class="form-group">
          <label class="lbl">Текст повідомлення</label>
          <textarea id="notif-body" class="field" rows="3" style="resize:vertical" placeholder="Детальніше..." oninput="Notify._livePreview()"></textarea>
        </div>
        <div class="form-group">
          <label class="lbl">Отримувачі (порожньо = всі)</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
            ${roles.map(r=>`
              <label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer">
                <input type="checkbox" class="notif-role-check" value="${r.key}" onchange="Notify._livePreview()">
                ${r.label}
              </label>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="lbl">📷 Фото (необов'язково)</label>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
            ${renderUploadBtn('notif-photo-file','images','notifications','_notifPhotoUploaded','📁 Завантажити з пристрою')}
            <span style="font-size:11px;color:var(--text-muted)">або</span>
            <input type="url" id="notif-photo-url" class="field" style="flex:1;min-width:160px" placeholder="Вставити URL..." oninput="Notify._onPhotoUrlInput()">
          </div>
          <div id="notif-photo-preview" style="display:none;margin-bottom:6px">
            <div style="position:relative;display:inline-block">
              <img id="notif-photo-preview-img" src="" alt="Превью" style="max-height:120px;max-width:100%;border-radius:8px;object-fit:cover">
              <button onclick="Notify._clearPhoto()" style="position:absolute;top:-6px;right:-6px;background:var(--danger);border:none;color:#fff;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
            </div>
          </div>
          <div style="font-size:10px;color:var(--text-dim)">Якщо вказати — в Telegram надішлеться фото з підписом замість тексту</div>
        </div>

        <!-- Попередній перегляд -->
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:8px">👁 Попередній перегляд</div>
          <div id="notif-preview" style="border-radius:12px;padding:14px;border:1px solid rgba(224,160,80,.3);background:rgba(224,160,80,.08);min-height:60px;transition:all .2s">
            <div style="font-size:11px;color:var(--text-muted);font-style:italic">Заповніть заголовок щоб побачити перегляд...</div>
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn btn-gold" onclick="Notify.confirmSend()">👁 Переглянути і надіслати</button>
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
      </div>`);
  },

  // Живий перегляд в процесі набору
  _livePreview() {
    const title    = $('notif-title')?.value.trim() || '';
    const body     = $('notif-body')?.value.trim() || '';
    const priority = $('notif-priority')?.value || 'medium';
    const preview  = $('notif-preview');
    if (!preview) return;

    if (!title) {
      preview.innerHTML = '<div style="font-size:11px;color:var(--text-muted);font-style:italic">Заповніть заголовок щоб побачити перегляд...</div>';
      preview.style.borderColor = 'rgba(224,160,80,.3)';
      preview.style.background  = 'rgba(224,160,80,.08)';
      return;
    }

    const PRIORITY_CFG = {
      high:   { label:'🔴 Важливо',    color:'var(--danger)',  bg:'rgba(224,90,90,.08)',   border:'rgba(224,90,90,.3)'  },
      medium: { label:'🟡 Звичайне',   color:'var(--warning)', bg:'rgba(224,160,80,.08)',  border:'rgba(224,160,80,.3)' },
      low:    { label:'🟢 Інформація', color:'var(--success)', bg:'rgba(90,175,122,.08)',  border:'rgba(90,175,122,.3)' },
    };
    const cfg = PRIORITY_CFG[priority];
    const author = currentUser.displayName || currentUser.login;
    const photoUrl = $('notif-photo-url')?.value.trim() || '';

    preview.style.background   = cfg.bg;
    preview.style.borderColor  = cfg.border;
    preview.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;color:${cfg.color};text-transform:uppercase;letter-spacing:.06em">${cfg.label}</span>
        <span style="font-size:10px;color:var(--text-muted)">Зараз · ${esc(author)}</span>
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:${body?'6px':'0'}">${esc(title)}</div>
      ${body ? `<div style="font-size:12px;color:var(--text-dim);line-height:1.6">${esc(body)}</div>` : ''}
      ${photoUrl ? `<div style="margin-top:8px"><img src="${esc(photoUrl)}" style="max-height:80px;border-radius:6px;object-fit:cover" onerror="this.style.display='none'"></div>` : ''}`;
  },

  // Callback після успішного upload фото
  _notifPhotoUploaded(url) {
    const inp = $('notif-photo-url');
    if (inp) inp.value = url;
    Notify._showPhotoPreview(url);
    Notify._livePreview();
    toast('Фото завантажено ✅', 'success-t');
  },

  // При ручному введенні URL
  _onPhotoUrlInput() {
    const url = $('notif-photo-url')?.value.trim() || '';
    if (url) {
      Notify._showPhotoPreview(url);
    } else {
      Notify._clearPhoto();
    }
    Notify._livePreview();
  },

  _showPhotoPreview(url) {
    const wrap = $('notif-photo-preview');
    const img  = $('notif-photo-preview-img');
    if (!wrap || !img) return;
    img.src = url;
    wrap.style.display = 'block';
  },

  _clearPhoto() {
    const inp  = $('notif-photo-url');
    const wrap = $('notif-photo-preview');
    const img  = $('notif-photo-preview-img');
    if (inp)  inp.value = '';
    if (img)  img.src = '';
    if (wrap) wrap.style.display = 'none';
    // Скинути file input щоб можна було вибрати те саме фото знову
    const fileInp = $('notif-photo-file');
    if (fileInp) fileInp.value = '';
    Notify._livePreview();
  },

  // Крок підтвердження — показує фінальний перегляд перед відправкою
  confirmSend() {
    if (!canSendNotify(currentUser)) return;
    const title    = $('notif-title')?.value.trim();
    if (!title) { toast('Введіть заголовок', 'error'); return; }
    const body     = $('notif-body')?.value.trim() || '';
    const priority = $('notif-priority')?.value || 'medium';
    const roles    = [...document.querySelectorAll('.notif-role-check:checked')].map(c=>c.value);
    const photoUrl = $('notif-photo-url')?.value.trim() || '';
    const author   = currentUser.displayName || currentUser.login;

    const PRIORITY_CFG = {
      high:   { label:'🔴 Важливо',    color:'var(--danger)',  bg:'rgba(224,90,90,.08)',   border:'rgba(224,90,90,.3)'  },
      medium: { label:'🟡 Звичайне',   color:'var(--warning)', bg:'rgba(224,160,80,.08)',  border:'rgba(224,160,80,.3)' },
      low:    { label:'🟢 Інформація', color:'var(--success)', bg:'rgba(90,175,122,.08)',  border:'rgba(90,175,122,.3)' },
    };
    const cfg = PRIORITY_CFG[priority];
    const PRIORITY_EMOJI = { high:'🔴', medium:'🟡', low:'🟢' };

    const recipientLabel = roles.length
      ? roles.map(r => DB.get('roles',[]).find(x=>x.key===r)?.label || r).join(', ')
      : 'Всі співробітники';

    // Шаблон: якщо є збережений — підставити змінні
    const savedTpl = DB.get('tpl_notify', '');
    const defaultTgText = `${PRIORITY_EMOJI[priority]||'🔔'} <b>${title}</b>${body?'\n\n'+body:''}\n\n<i>— ${author}</i>`;
    const tgTextInit = savedTpl
      ? savedTpl.replace(/\{\{title\}\}/g, title).replace(/\{\{body\}\}/g, body).replace(/\{\{author\}\}/g, author).replace(/\{\{emoji\}\}/g, PRIORITY_EMOJI[priority]||'🔔')
      : defaultTgText;

    showModal(`
      <div class="modal-title">👁 Підтвердження надсилання</div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:10px">Так виглядатиме сповіщення в порталі:</div>

      <!-- Перегляд картки в порталі -->
      <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:700;color:${cfg.color};text-transform:uppercase;letter-spacing:.06em">${cfg.label}</span>
          <span style="font-size:10px;color:var(--text-muted)">Зараз · ${author}</span>
        </div>
        <div style="font-size:14px;font-weight:700;margin-bottom:${body?'6px':'0'}">${title}</div>
        ${body ? `<div style="font-size:12px;color:var(--text-dim);line-height:1.6">${body}</div>` : ''}
        ${photoUrl ? `<div style="margin-top:10px"><img src="${photoUrl}" alt="Фото" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:cover" onerror="this.style.display='none'"></div>` : ''}
      </div>

      ${photoUrl ? `
      <!-- Фото превью для Telegram -->
      <div style="background:rgba(37,152,218,.07);border:1px solid rgba(37,152,218,.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">📷</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#7ec8e3;margin-bottom:2px">Фото для Telegram</div>
          <div style="font-size:10px;color:var(--text-dim);word-break:break-all">${photoUrl}</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:14px">⚠️ При наявності фото — в Telegram надсилається фото з підписом (текст з textarea нижче = підпис)</div>
      ` : ''}

      <!-- Редагований Telegram-текст -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim)">📱 ${photoUrl ? 'Підпис до фото в Telegram' : 'Текст в Telegram'}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="Notify._saveNotifyTpl()">💾 Зберегти шаблон</button>
          <button class="btn btn-ghost btn-sm" onclick="Notify._loadNotifyTpl()">📋 Шаблон</button>
        </div>
      </div>
      <textarea id="notif-tg-text" class="field" rows="6"
        style="font-family:monospace;font-size:12px;line-height:1.6;resize:vertical;white-space:pre;margin-bottom:4px"
      ></textarea>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:14px">
        Змінні: <code style="color:var(--gold)">{{emoji}}</code> <code style="color:var(--gold)">{{title}}</code> <code style="color:var(--gold)">{{body}}</code> <code style="color:var(--gold)">{{author}}</code>
      </div>

      <!-- Отримувачі -->
      <div style="background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 14px;margin-bottom:4px;display:flex;align-items:center;gap:8px">
        <span style="font-size:13px">👥</span>
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-dim)">Отримувачі</div>
          <div style="font-size:12px;font-weight:600;margin-top:1px">${recipientLabel}</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-gold" id="notif-send-final-btn" onclick="Notify.save('${encodeURIComponent(title)}','${encodeURIComponent(body)}','${encodeURIComponent(priority)}','${encodeURIComponent(roles.join(','))}','${encodeURIComponent(photoUrl)}')">
          📨 Надіслати
        </button>
        <button class="btn btn-ghost" onclick="Notify.openNew()">✏️ Редагувати</button>
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
      </div>`);
    // Вставити текст після рендеру модалки (уникаємо escaping в template literal)
    const ta = document.getElementById('notif-tg-text');
    if (ta) ta.value = tgTextInit;
  },

  _saveNotifyTpl() {
    const ta = $('notif-tg-text');
    if (!ta) return;
    DB.set('tpl_notify', ta.value);
    toast('Шаблон збережено ✅', 'success-t');
  },

  _loadNotifyTpl() {
    const ta = $('notif-tg-text');
    if (!ta) return;
    const tpl = DB.get('tpl_notify', '');
    if (!tpl) { toast('Немає збереженого шаблону', 'error'); return; }
    ta.value = tpl;
    toast('Шаблон завантажено', 'success-t');
  },

  async save(titleEnc, bodyEnc, priorityEnc, rolesStr, photoUrlEnc) {
    if (!canSendNotify(currentUser)) { toast('Недостатньо прав', 'error'); return; }
    const title    = decodeURIComponent(titleEnc || '');
    const body     = decodeURIComponent(bodyEnc  || '');
    const photoUrl = decodeURIComponent(photoUrlEnc || '');
    const priority = decodeURIComponent(priorityEnc || 'medium');
    const roles    = rolesStr ? decodeURIComponent(rolesStr).split(',').filter(Boolean) : [];
    const author   = currentUser.displayName || currentUser.login;

    const btn = $('notif-send-final-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Надсилання...'; }

    // Читаємо відредагований Telegram-текст з textarea
    const tgTextEl = $('notif-tg-text');
    const PRIORITY_EMOJI = { high:'🔴', medium:'🟡', low:'🟢' };
    const tgText = tgTextEl
      ? tgTextEl.value
      : `${PRIORITY_EMOJI[priority]||'🔔'} <b>${title}</b>${body?'\n\n'+body:''}\n\n<i>— ${author}</i>`;

    try {
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const [inserted] = await sb.insert('notifications', {
        title, body, priority, author,
        roles: roles.length > 0 ? roles.join(',') : null,
        expires_at: expiresAt,
        ...(photoUrl ? { photo_url: photoUrl } : {})
      });
      const items = DB.get('notifications',[]);
      items.push(inserted);
      DB.set('notifications', items);

      let broadcastResult;
      if (photoUrl) {
        // Передаємо plain-text caption (HTML стрипається всередині tgSendPhoto)
        broadcastResult = await tgBroadcastPhoto(photoUrl, tgText, roles.length > 0 ? roles : undefined);
      } else {
        await tgBroadcast(tgText, roles.length > 0 ? roles : undefined);
      }

      closeModal();
      if (photoUrl) {
        const sentCount = broadcastResult?.sent ?? 0;
        const skipCount = broadcastResult?.skipped ?? 0;
        const skipNote = skipCount > 0 ? `, ${skipCount} без chat_id` : '';
        if (sentCount === 0) {
          toast(`⚠️ Фото не надіслано — у користувачів немає chat_id. Попросіть написати /start боту`, 'error');
        } else {
          logEvent('notifications', 'Надіслано сповіщення з фото', title);
          toast(`Фото надіслано: ${sentCount} отримувачів${skipNote} ✅`, 'success-t');
        }
      } else {
        logEvent('notifications', 'Надіслано сповіщення', title);
        toast('Сповіщення надіслано ✅', 'success-t');
      }
      Notify.render();
    } catch(e) {
      toast('Помилка надсилання', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '📨 Надіслати'; }
      console.error(e);
    }
  },

  async delete(id) {
    showConfirm('Видалити це сповіщення?', async () => {
      try {
        await sb.delete('notifications', { id });
        const items = DB.get('notifications',[]).filter(n=>n.id!==id);
        DB.set('notifications', items);
        Notify.render();
      } catch(e) { toast('Помилка', 'error'); console.error(e); }
    }, { okLabel: '🗑 Видалити' });
  },
};

// Глобальний callback для завантаження фото в сповіщення (викликається через handleImageUpload)
function _notifPhotoUploaded(url) { Notify._notifPhotoUploaded(url); }

