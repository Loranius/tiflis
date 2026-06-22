// ── Сповіщення ────────────────────────────────────────────────
// ── Теми оформлення ─────────────────────────────────────────────
const Theme = {
  KEY: 'tiflis_theme',

  LIST: [
    { id: 'eden',     label: 'Едем',    desc: 'Темно-зелений + золото (класика)', eden: '#163832', gold: '#D4AF37' },
    { id: 'bordeaux', label: 'Бордо',   desc: 'Бордовий + мідь',                  eden: '#3a1620', gold: '#d9a05b' },
    { id: 'midnight', label: 'Опівніч', desc: 'Графіт + срібло',                  eden: '#16232e', gold: '#9fc7e0' },
    { id: 'onyx',     label: 'Онікс',   desc: 'Чорний + бронза',                  eden: '#1c1c1c', gold: '#c9975a' },
  ],

  apply(id) {
    if (id === 'eden') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', id);
    }
  },

  init() {
    const saved = localStorage.getItem(Theme.KEY) || 'eden';
    Theme.apply(saved);
  },

  set(id) {
    localStorage.setItem(Theme.KEY, id);
    Theme.apply(id);
    Theme.render();
    toast('✅ Тему змінено', 'success-t');
  },

  render() {
    const el = $('theme-picker');
    if (!el) return;
    const current = localStorage.getItem(Theme.KEY) || 'eden';

    el.innerHTML = `
      <div class="card-title">Тема оформлення</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
        ${Theme.LIST.map(t => {
          const active = t.id === current;
          return `
            <div onclick="Theme.set('${t.id}')" class="card"
              style="cursor:pointer;padding:14px;position:relative;transition:.15s;
                border-color:${active ? t.gold : 'var(--gold-border)'};
                ${active ? `box-shadow:0 0 0 1px ${t.gold}, 0 4px 16px rgba(0,0,0,.25)` : ''}">
              ${active ? `<div style="position:absolute;top:10px;right:10px;width:20px;height:20px;
                  border-radius:50%;background:${t.gold};color:${t.eden};
                  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900">✓</div>` : ''}
              <div style="display:flex;gap:8px;margin-bottom:10px">
                <div style="width:24px;height:24px;border-radius:50%;background:${t.eden};border:1px solid ${t.gold}"></div>
                <div style="width:24px;height:24px;border-radius:50%;background:${t.gold}"></div>
              </div>
              <div style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:700;color:${t.gold}">${t.label}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${t.desc}</div>
            </div>`;
        }).join('')}
      </div>`;
  },
};

