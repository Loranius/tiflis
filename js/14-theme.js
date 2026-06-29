// ── Теми оформлення ─────────────────────────────────────────────
const Theme = {
  KEY: 'tiflis_theme',

  LIST: [
    {
      id: 'eden',      label: 'Едем',     desc: 'Темно-зелений + золото',
      bg: '#163832', accent: '#D4AF37'
    },
    {
      id: 'bordeaux',  label: 'Бордо',    desc: 'Вишня + мідь',
      bg: '#3a1620', accent: '#d9a05b'
    },
    {
      id: 'midnight',  label: 'Опівніч',  desc: 'Графіт + срібло',
      bg: '#16232e', accent: '#9fc7e0'
    },
    {
      id: 'onyx',      label: 'Онікс',    desc: 'Чорний + бронза',
      bg: '#1c1c1c', accent: '#c9975a'
    },
    {
      id: 'sapphire',  label: 'Сапфір',   desc: 'Індиго + бірюзовий',
      bg: '#0d1b2e', accent: '#38e8d0'
    },
    {
      id: 'amethyst',  label: 'Аметист',  desc: 'Сливово-темний + лавандовий',
      bg: '#1a0f2e', accent: '#c084fc'
    },
    {
      id: 'ember',     label: 'Жар',      desc: 'Вугільний + жовтогарячий',
      bg: '#1a1008', accent: '#ff7c2a'
    },
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
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
        ${Theme.LIST.map(t => {
          const active = t.id === current;
          return `
            <div onclick="Theme.set('${t.id}')" class="card"
              style="cursor:pointer;padding:14px;position:relative;transition:.15s;
                border-color:${active ? t.accent : 'var(--gold-border)'};
                ${active ? `box-shadow:0 0 0 1px ${t.accent},0 4px 16px rgba(0,0,0,.3)` : ''}">
              ${active ? `<div style="position:absolute;top:10px;right:10px;width:20px;height:20px;
                  border-radius:50%;background:${t.accent};color:${t.bg};
                  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900">✓</div>` : ''}
              <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
                <div style="width:24px;height:24px;border-radius:50%;background:${t.bg};border:1px solid ${t.accent};flex-shrink:0"></div>
                <div style="width:24px;height:24px;border-radius:50%;background:${t.accent};flex-shrink:0"></div>
              </div>
              <div style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:700;color:${t.accent}">${t.label}</div>
              <div style="font-size:10px;color:var(--text-dim);margin-top:2px">${t.desc}</div>
            </div>`;
        }).join('')}
      </div>`;
  },
};
