// ╔═══════════════════════════════════════════════════════════════╗
// ║  [13/13] ЖУРНАЛ ПОДІЙ                                         ║
// ╚═══════════════════════════════════════════════════════════════╝

// Записує подію в localStorage + Supabase (асинхронно, без блокування)
function logEvent(section, action, detail = '') {
  if (!currentUser) return;
  const entry = {
    id: Date.now() + Math.random(),
    ts: new Date().toISOString(),
    who: currentUser.displayName || currentUser.login || '?',
    who_id: currentUser.id,
    section,   // 'schedule' | 'cash' | 'menu' | 'staff' | 'notifications' | ...
    action,    // короткий опис що сталось
    detail,    // деталі (необов'язково)
  };
  try {
    const log = JSON.parse(localStorage.getItem('tiflis_event_log') || '[]');
    log.unshift(entry);
    // зберігаємо останні 500
    localStorage.setItem('tiflis_event_log', JSON.stringify(log.slice(0, 500)));
  } catch(e) {}
  // Асинхронно пишемо в Supabase (не чекаємо)
  sb.insert('event_log', {
    ts: entry.ts,
    who: entry.who,
    who_id: entry.who_id,
    section: entry.section,
    action: entry.action,
    detail: entry.detail,
  }).catch(() => {});
}

const EventLog = {
  _tab: 'all',

  init() { this.render(); },
  refresh() { this._loadFromSupabase().then(() => this.render()); },

  async _loadFromSupabase() {
    try {
      const rows = await sb.query('event_log', { order: 'ts.desc', limit: 300 });
      if (rows?.length) {
        const merged = this._merge(
          JSON.parse(localStorage.getItem('tiflis_event_log') || '[]'),
          rows
        );
        localStorage.setItem('tiflis_event_log', JSON.stringify(merged.slice(0, 500)));
      }
    } catch(e) {}

    // Повідомлення боту — з таблиці bot_messages
    try {
      const msgs = await sb.query('bot_messages', { order: 'ts.desc', limit: 200 });
      if (msgs?.length) localStorage.setItem('tiflis_bot_messages', JSON.stringify(msgs));
    } catch(e) {}
  },

  _merge(local, remote) {
    const map = new Map();
    [...local, ...remote].forEach(r => map.set(r.id || r.ts + r.who + r.action, r));
    return [...map.values()].sort((a, b) => b.ts > a.ts ? 1 : -1);
  },

  _getLog() {
    try {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const all = JSON.parse(localStorage.getItem('tiflis_event_log') || '[]');
      const fresh = all.filter(e => (e.ts || '') >= cutoff);
      if (fresh.length !== all.length) {
        localStorage.setItem('tiflis_event_log', JSON.stringify(fresh));
      }
      return fresh;
    } catch(e) { return []; }
  },
  _getBotMsgs() {
    try {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const all = JSON.parse(localStorage.getItem('tiflis_bot_messages') || '[]');
      const fresh = all.filter(e => (e.ts || '') >= cutoff);
      if (fresh.length !== all.length) {
        localStorage.setItem('tiflis_bot_messages', JSON.stringify(fresh));
      }
      return fresh;
    } catch(e) { return []; }
  },

  _sectionLabel(s) {
    const map = { schedule:'Графік', cash:'Каса', menu:'Меню', staff:'Персонал',
      notifications:'Сповіщення', handover:'Здача зміни',
      daily:'Обов\'язки', rating:'Рейтинг', auth:'Вхід/Вихід', admin:'Адмін', other:'Інше' };
    return map[s] || s;
  },

  _fmtTs(iso) {
    try {
      const d = new Date(iso);
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const t = d.toLocaleTimeString('uk-UA', { hour:'2-digit', minute:'2-digit' });
      if (isToday) return 'сьогодні ' + t;
      return d.toLocaleDateString('uk-UA', { day:'numeric', month:'short' }) + ' ' + t;
    } catch(e) { return iso?.slice(0,16) || ''; }
  },

  render() {
    const el = $('elog-container');
    if (!el) return;

    const TABS = [
      { id:'all',           label:'Всі дії' },
      { id:'schedule',      label:'Графік' },
      { id:'cash',          label:'Каса' },
      { id:'menu',          label:'Меню' },
      { id:'staff',         label:'Персонал' },
      { id:'notifications', label:'Сповіщення' },
      { id:'bot',           label:'💬 Бот' },
    ];

    const tab = this._tab;

    // Підвкладки
    const tabsHtml = `<div class="elog-tabs">${
      TABS.map(t => `<button class="elog-tab${tab===t.id?' active':''}" onclick="EventLog._setTab('${t.id}')">${t.label}</button>`).join('')
    }</div>`;

    if (tab === 'bot') {
      el.innerHTML = tabsHtml + this._renderBot();
    } else {
      el.innerHTML = tabsHtml + this._renderLog(tab);
    }
  },

  _setTab(id) {
    this._tab = id;
    this.render();
  },

  _renderLog(section) {
    let rows = this._getLog();
    if (section !== 'all') rows = rows.filter(r => r.section === section);
    if (!rows.length) return `<div class="elog-empty">📭 Подій ще немає${section !== 'all' ? ' у цьому розділі' : ''}</div>`;

    const head = `<div class="elog-row elog-head"><div>Хто</div><div>Розділ</div><div>Дія</div><div>Час</div></div>`;
    const body = rows.slice(0, 200).map(r => `
      <div class="elog-row">
        <div class="elog-who">${esc(r.who || '?')}</div>
        <div><span class="elog-badge">${this._sectionLabel(r.section)}</span></div>
        <div class="elog-what">${esc(r.action)}${r.detail ? `<div style="color:var(--text-dim);font-size:10px;margin-top:2px">${esc(r.detail)}</div>` : ''}</div>
        <div class="elog-time">${this._fmtTs(r.ts)}</div>
      </div>`).join('');

    return `<div style="background:var(--surface);border:1px solid var(--gold-border);border-radius:12px;overflow:hidden">${head}${body}</div>`;
  },

  _renderBot() {
    const msgs = this._getBotMsgs();
    if (!msgs.length) return `<div class="elog-empty">💬 Повідомлень боту ще немає.<br><span style="font-size:11px;color:var(--text-muted)">Коли персонал пише боту — повідомлення зʼявляться тут</span></div>`;

    const users = DB.get('users', []);
    const rows = msgs.slice(0, 200).map(m => {
      const u = users.find(u => String(u.chat_id||u.tg_id) === String(m.chat_id));
      const name = m.from_name || u?.displayName || u?.login || ('ID: ' + m.chat_id);
      const role = u ? (DB.get('roles',[]).find(r=>r.key===u.role)?.label || u.role) : '';
      const avatarInner = u?.avatar
        ? `<img src="${u.avatar}" loading="lazy">`
        : `<span>${name[0]?.toUpperCase()||'?'}</span>`;
      const text = m.text || '';
      const isCmd = text.startsWith('/');
      const textHtml = isCmd
        ? `<span class="botmsg-cmd">${esc(text)}</span>`
        : esc(text);
      return `<div class="botmsg-row">
        <div class="botmsg-avatar">${avatarInner}</div>
        <div class="botmsg-body">
          <div class="botmsg-meta">
            <span class="botmsg-name">${esc(name)}</span>
            ${role ? `<span class="botmsg-role">${esc(role)}</span>` : ''}
            <span class="botmsg-ts">${this._fmtTs(m.ts)}</span>
          </div>
          <div class="botmsg-text">${textHtml}</div>
        </div>
      </div>`;
    }).join('');

    return `<div style="background:var(--surface);border:1px solid var(--gold-border);border-radius:12px;overflow:hidden">${rows}</div>`;
  },
};

