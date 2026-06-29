// ── Теми оформлення ─────────────────────────────────────────────
const Theme = {
  KEY: 'tiflis_theme',

  // Кожна тема: темний фон (eden) + виразний акцент (gold)
  // Палітри побудовані за Pantone Fashion & Home + Color of the Year
  LIST: [
    {
      id: 'eden',
      label: 'Едем',
      desc: 'Хантер грін + золото',       // Pantone 19-0230 + 14-0846
      bg: '#163832', accent: '#D4AF37'
    },
    {
      id: 'bordeaux',
      label: 'Бордо',
      desc: 'Бордо + мідь',               // Pantone 19-1624 + 16-1343
      bg: '#3B1219', accent: '#C17F4A'
    },
    {
      id: 'midnight',
      label: 'Опівніч',
      desc: 'Темно-синій + срібло',        // Pantone 19-3939 + 13-0002
      bg: '#141E2E', accent: '#B0C4D8'
    },
    {
      id: 'onyx',
      label: 'Онікс',
      desc: 'Чорний + ванільний крем',     // Pantone 19-0303 + 12-0712
      bg: '#1A1A1A', accent: '#E8D5B0'
    },
    {
      id: 'indigo',
      label: 'Індиго',
      desc: 'Індиго + персик',             // Pantone 19-3748 + 15-1520
      bg: '#1C1040', accent: '#F4A882'
    },
    {
      id: 'forest',
      label: 'Ліс',
      desc: 'Смарагдовий + рожеве золото', // Pantone 17-0145 + 15-1516
      bg: '#1A3028', accent: '#DFA878'
    },
    {
      id: 'dusk',
      label: 'Сутінки',
      desc: 'Сливовий + лавандовий',       // Pantone 19-3220 + 15-3817
      bg: '#261530', accent: '#B8A4CC'
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
      <div class="card-title">🎨 Тема оформлення</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px">
        ${Theme.LIST.map(t => {
          const active = t.id === current;
          return `
            <div onclick="Theme.set('${t.id}')" class="card"
              style="cursor:pointer;padding:14px;position:relative;transition:.18s;
                border-color:${active ? t.accent : 'var(--gold-border)'};
                ${active ? `box-shadow:0 0 0 1.5px ${t.accent},0 6px 20px rgba(0,0,0,.35)` : ''}">
              ${active ? `<div style="position:absolute;top:9px;right:9px;width:20px;height:20px;
                  border-radius:50%;background:${t.accent};color:${t.bg};
                  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900">✓</div>` : ''}
              <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
                <div style="width:26px;height:26px;border-radius:50%;background:${t.bg};
                  border:2px solid ${t.accent};flex-shrink:0"></div>
                <div style="width:26px;height:26px;border-radius:50%;background:${t.accent};flex-shrink:0"></div>
              </div>
              <div style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:700;color:${t.accent};line-height:1.2">${t.label}</div>
              <div style="font-size:10px;color:var(--text-dim);margin-top:3px;line-height:1.4">${t.desc}</div>
            </div>`;
        }).join('')}
      </div>`;
  },
};
