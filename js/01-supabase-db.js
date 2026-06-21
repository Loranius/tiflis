// ╔═══════════════════════════════════════════════════════════════╗
// ║  [1/13]  SUPABASE КЛІЄНТ + LocalStorage DB                    ║
// ╚═══════════════════════════════════════════════════════════════╝
const SUPA_URL = 'https://duzfttrrzeqvxpfnyxfg.supabase.co';
const SUPA_KEY = 'sb_publishable_ICnIrODW2ZMbbhia8iBoCA_vCgQwoPx';

const sb = {
  async query(table, opts = {}) {
    let url = `${SUPA_URL}/rest/v1/${table}`;
    const params = [];
    if (opts.select)  params.push(`select=${opts.select}`);
    if (opts.filter)  Object.entries(opts.filter).forEach(([k,v]) => params.push(`${k}=eq.${encodeURIComponent(v)}`));
    if (opts.order)   params.push(`order=${opts.order}`);
    if (opts.limit)   params.push(`limit=${opts.limit}`);
    if (params.length) url += '?' + params.join('&');

    const res = await fetch(url, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ── Offline write queue ────────────────────────────────────────
  QUEUE_KEY: 'tiflis_offline_queue',

  _isNetworkError(e) {
    const msg = e?.message || '';
    return msg.includes('Failed to fetch') || msg.includes('NetworkError') ||
           msg.includes('net::') || msg.includes('Load failed') || !navigator.onLine;
  },

  _getQueue() {
    try { return JSON.parse(localStorage.getItem(sb.QUEUE_KEY) || '[]'); }
    catch(e) { return []; }
  },

  _setQueue(q) {
    try { localStorage.setItem(sb.QUEUE_KEY, JSON.stringify(q)); } catch(e) {}
    App._updateOfflineQueueBadge?.(q.length);
  },

  _enqueue(op) {
    const q = sb._getQueue();
    q.push({ ...op, ts: Date.now() });
    sb._setQueue(q);
    sb._setOffline(true);
  },

  // Виконує одну операцію з черги напряму (без повторного енкʼю при невдачі)
  async _runQueuedOp(op) {
    switch (op.method) {
      case 'insert': return sb._insertRaw(op.table, op.data);
      case 'upsert': return sb._upsertRaw(op.table, op.data, op.onConflict);
      case 'update': return sb._updateRaw(op.table, op.data, op.filter);
      case 'delete': return sb._deleteRaw(op.table, op.filter);
    }
  },

  // Спробувати відправити всі відкладені операції (FIFO)
  async flushQueue() {
    let q = sb._getQueue();
    if (!q.length) return;
    while (q.length) {
      const op = q[0];
      try {
        await sb._runQueuedOp(op);
        q.shift();
        sb._setQueue(q);
      } catch(e) {
        if (sb._isNetworkError(e)) {
          // Все ще офлайн — зупиняємось, спробуємо пізніше
          return;
        }
        // Не мережева помилка (напр. конфлікт даних) — пропускаємо операцію,
        // щоб не блокувати решту черги назавжди
        console.warn('Offline queue: dropping failed op', op, e);
        q.shift();
        sb._setQueue(q);
      }
    }
    sb._setOffline(false);
    toast('✅ Відкладені дані синхронізовано', 'success-t');
  },


  async _insertRaw(table, data) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      sb._handleError(table, 'insert', errText);
      throw new Error(errText);
    }
    return res.json();
  },

  async _upsertRaw(table, data, onConflict) {
    let url = `${SUPA_URL}/rest/v1/${table}`;
    if (onConflict) url += `?on_conflict=${onConflict}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      sb._handleError(table, 'upsert', errText);
      throw new Error(errText);
    }
    return res.json();
  },

  async _updateRaw(table, data, filter) {
    let url = `${SUPA_URL}/rest/v1/${table}`;
    const params = Object.entries(filter).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`);
    if (params.length) url += '?' + params.join('&');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      sb._handleError(table, 'update', errText);
      throw new Error(errText);
    }
    return res.json();
  },

  async _deleteRaw(table, filter) {
    let url = `${SUPA_URL}/rest/v1/${table}`;
    const params = Object.entries(filter).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`);
    if (params.length) url += '?' + params.join('&');
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      sb._handleError(table, 'delete', errText);
      throw new Error(errText);
    }
    return true;
  },

  // ── Публічні методи з offline-черги ─────────────────────────────
  // При мережевій помилці операція ставиться в localStorage-черту
  // і повторюється автоматично при відновленні зʼєднання.
  async insert(table, data) {
    try {
      return await sb._insertRaw(table, data);
    } catch(e) {
      if (sb._isNetworkError(e)) { sb._enqueue({ method:'insert', table, data }); return null; }
      throw e;
    }
  },

  async upsert(table, data, onConflict) {
    try {
      return await sb._upsertRaw(table, data, onConflict);
    } catch(e) {
      if (sb._isNetworkError(e)) { sb._enqueue({ method:'upsert', table, data, onConflict }); return null; }
      throw e;
    }
  },

  async update(table, data, filter) {
    try {
      return await sb._updateRaw(table, data, filter);
    } catch(e) {
      if (sb._isNetworkError(e)) { sb._enqueue({ method:'update', table, data, filter }); return null; }
      throw e;
    }
  },

  async delete(table, filter) {
    try {
      return await sb._deleteRaw(table, filter);
    } catch(e) {
      if (sb._isNetworkError(e)) { sb._enqueue({ method:'delete', table, filter }); return null; }
      throw e;
    }
  },

  // Централізований обробник помилок — підказує що робити
  _rlsWarned: {},
  _isOffline: false,

  _setOffline(offline) {
    if (sb._isOffline === offline) return;
    sb._isOffline = offline;
    let bar = document.getElementById('offline-bar');
    if (offline) {
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'offline-bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:rgba(224,90,90,.95);color:#fff;text-align:center;font-size:11px;font-weight:700;padding:6px 16px;letter-spacing:.05em;backdrop-filter:blur(4px)';
        bar.textContent = '⚠️ Немає з\'єднання з сервером — дані збережено локально';
        document.body.prepend(bar);
      }
    } else {
      if (bar) { bar.textContent = '✅ З\'єднання відновлено'; bar.style.background = 'rgba(90,175,122,.95)'; setTimeout(() => bar?.remove(), 2000); }
    }
  },

  _handleError(table, op, msg) {
    console.error(`[Supabase ${op} ${table}]`, msg);
    // RLS або permission denied — показуємо підказку один раз на таблицю
    if ((msg.includes('42501') || msg.includes('permission denied') || msg.includes('row-level security') || msg.includes('violates row-level')) && !sb._rlsWarned[table]) {
      sb._rlsWarned[table] = true;
      toast(`🔒 RLS заблокував "${table}". Вимкни RLS в Supabase → Table Editor → ${table} → RLS`, 'error');
    }
  },

  async rpc(fn, params = {}) {
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Supabase Storage: upload file to bucket, return public URL
  async uploadImage(bucket, path, file) {
    const url = `${SUPA_URL}/storage/v1/object/${bucket}/${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!res.ok) throw new Error(await res.text());
    return `${SUPA_URL}/storage/v1/object/public/${bucket}/${path}`;
  }
};

// Локальний кеш для швидкодії
const cache = {};

// Префікси ключів які треба зберігати в localStorage (щоб пережили оновлення)
const LS_PERSIST_PREFIXES = ['duties_', 'interactive_', 'menu_sections_custom'];

function lsShouldPersist(k) {
  return LS_PERSIST_PREFIXES.some(p => k.startsWith(p));
}

// При старті — відновлюємо збережені duties з localStorage в cache
(function restoreFromLS() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !lsShouldPersist(k)) continue;
      try { cache[k] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
    }
  } catch(e) {}
})();

const DB = {
  get(k, def=null) {
    const v = cache[k];
    if (v === undefined) return def;
    // Захист: якщо duties-ключ містить рядок (старий кеш) — парсимо
    if (typeof v === 'string' && k.startsWith('duties_')) {
      try { const parsed = JSON.parse(v); cache[k] = parsed; return parsed; } catch(e) { return def; }
    }
    return v;
  },
  set(k, v) {
    cache[k] = v;
    if (lsShouldPersist(k)) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
    }
  },
  del(k) {
    delete cache[k];
    if (lsShouldPersist(k)) {
      try { localStorage.removeItem(k); } catch(e) {}
    }
  },
};

