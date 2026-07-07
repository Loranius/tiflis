/* ─── Store: єдиний шар даних ───
 * Усі сторінки працюють тільки через Store — їм байдуже,
 * що під капотом: демо (localStorage) чи Supabase (REST).
 *
 * API:
 *   Store.mode                    'demo' | 'supabase'
 *   await Store.list(table, eq?)  → масив (eq: {поле: значення})
 *   await Store.insert(t, obj)    → створений запис
 *   await Store.update(t, id, patch)
 *   await Store.remove(t, id)
 *   await Store.upsert(t, obj, conflictKeys)  // унікальність за полями
 *   Store.cached(t)               → останній відомий масив (синхронно)
 *   Store.onChange(t, cb)         → підписка на зміни таблиці
 */
const Store = (() => {
  const hasSb = !!(window.CONFIG.SUPABASE_URL && window.CONFIG.SUPABASE_KEY);
  const mode = hasSb ? 'supabase' : 'demo';
  const memCache = {};                 // table → array
  const listeners = {};                // table → Set(cb)

  const emit = table => (listeners[table] || []).forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
  const onChange = (table, cb) => {
    (listeners[table] = listeners[table] || new Set()).add(cb);
    return () => listeners[table].delete(cb);
  };

  /* ── ДЕМО-адаптер ── */
  const LS_KEY = 'tiflis2.db';
  let db = null;
  const loadDb = () => {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { db = null; }
    if (!db) { db = DemoData.seed(); saveDb(); }
    return db;
  };
  const saveDb = () => localStorage.setItem(LS_KEY, JSON.stringify(db));

  const demo = {
    async list(t, eq) {
      loadDb();
      let rows = db[t] || [];
      if (eq) rows = rows.filter(r => Object.entries(eq).every(([k, v]) => r[k] === v));
      return structuredClone(rows);
    },
    async insert(t, obj) {
      loadDb();
      const row = { id: U.uid(), ...obj };
      (db[t] = db[t] || []).push(row);
      saveDb(); emit(t);
      return structuredClone(row);
    },
    async update(t, id, patch) {
      loadDb();
      const row = (db[t] || []).find(r => r.id === id);
      if (row) Object.assign(row, patch);
      saveDb(); emit(t);
      return structuredClone(row);
    },
    async remove(t, id) {
      loadDb();
      db[t] = (db[t] || []).filter(r => r.id !== id);
      saveDb(); emit(t);
    },
    async upsert(t, obj, keys) {
      loadDb();
      const row = (db[t] || []).find(r => keys.every(k => r[k] === obj[k]));
      if (row) { Object.assign(row, obj); saveDb(); emit(t); return structuredClone(row); }
      return demo.insert(t, obj);
    },
  };

  /* ── Supabase REST-адаптер (без залежностей) ── */
  const sbFetch = async (path, opts = {}) => {
    const res = await fetch(`${window.CONFIG.SUPABASE_URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: window.CONFIG.SUPABASE_KEY,
        Authorization: `Bearer ${window.CONFIG.SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation' + (opts.upsert ? ',resolution=merge-duplicates' : ''),
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  };

  const supa = {
    async list(t, eq) {
      const q = eq ? '&' + Object.entries(eq).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&') : '';
      return sbFetch(`${t}?select=*${q}`);
    },
    async insert(t, obj) { return (await sbFetch(t, { method: 'POST', body: JSON.stringify(obj) }))[0]; },
    async update(t, id, patch) {
      return (await sbFetch(`${t}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }))[0];
    },
    async remove(t, id) { await sbFetch(`${t}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async upsert(t, obj, keys) {
      return (await sbFetch(`${t}?on_conflict=${keys.join(',')}`, { method: 'POST', upsert: true, body: JSON.stringify(obj) }))[0];
    },
  };

  const impl = mode === 'demo' ? demo : supa;

  /* обгортки з кешем і подіями */
  const api = {
    mode, onChange,
    cached: t => memCache[t] || null,
    async list(t, eq) {
      const rows = await impl.list(t, eq);
      if (!eq) memCache[t] = rows;
      return rows;
    },
    async insert(t, obj)  { const r = await impl.insert(t, obj);  if (mode === 'supabase') emit(t); return r; },
    async update(t, id, p){ const r = await impl.update(t, id, p);if (mode === 'supabase') emit(t); return r; },
    async remove(t, id)   { await impl.remove(t, id);             if (mode === 'supabase') emit(t); },
    async upsert(t, o, k) { const r = await impl.upsert(t, o, k); if (mode === 'supabase') emit(t); return r; },
    resetDemo() { if (mode === 'demo') { localStorage.removeItem(LS_KEY); db = null; } },
  };
  return api;
})();
