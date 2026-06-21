// ╔═══════════════════════════════════════════════════════════════╗
// ║  [0/13]  УТІЛІТИ БЕЗПЕКИ + КОНСТАНТИ                         ║
// ╚═══════════════════════════════════════════════════════════════╝

// XSS-захист: екранує всі спецсимволи HTML перед вставкою в innerHTML
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Блокування кнопки під час async-операції (захист від double-submit)
function btnLock(btn) {
  if (!btn) return;
  btn.disabled = true;
  btn._origText = btn.innerHTML;
  btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px">'
    + '<span class="btn-spinner"></span>Збереження...</span>';
}
function btnUnlock(btn) {
  if (!btn) return;
  btn.disabled = false;
  if (btn._origText !== undefined) btn.innerHTML = btn._origText;
}

// Красивий confirm() замість системного браузерного діалогу
function showConfirm(text, onOk, { okLabel = 'Підтвердити', okClass = 'btn-danger', cancelLabel = 'Скасувати' } = {}) {
  // Зберігаємо поточний контент модалки (якщо відкрита) — щоб відновити при скасуванні
  const overlay = document.getElementById('modal-overlay');
  const prevContent = document.getElementById('modal-content').innerHTML;
  const wasPrevOpen = overlay.classList.contains('active');

  showModal(`
    <div style="text-align:center;padding:8px 0 4px">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--text);margin-bottom:8px;line-height:1.3">${esc(text)}</div>
    </div>
    <div class="modal-footer" style="justify-content:center;gap:12px">
      <button class="btn ${okClass}" id="confirm-ok-btn">${okLabel}</button>
      <button class="btn btn-ghost" id="confirm-cancel-btn">${cancelLabel}</button>
    </div>
  `);

  document.getElementById('confirm-ok-btn').onclick = () => {
    closeModal();
    onOk();
  };

  document.getElementById('confirm-cancel-btn').onclick = () => {
    if (wasPrevOpen) {
      // Відновити попередню модалку
      document.getElementById('modal-content').innerHTML = prevContent;
    } else {
      closeModal();
    }
  };
}

// Кольори і назви типів змін — єдине місце для редагування
const SHIFT_COLORS = {
  'Р':    'var(--success)',
  'Х':    'var(--danger)',
  'О':    '#b06040',
  'СН':   '#7ec8e3',
  'Б':    'var(--gold)',
  'С':    '#c890e8',
  'Р/Б':  '#f0a050',
  'СН/Б': '#80c8b0',
  '':     'var(--text-muted)',
};
const SHIFT_LABELS = {
  'Р':    'Робочий',
  'Х':    'Вихідний',
  'О':    'Обов\'язковий вихідний',
  'СН':   'Сніданки',
  'Б':    'Бар',
  'С':    'Сомельє',
  'Р/Б':  'Робочий + Бар',
  'СН/Б': 'Сніданки + Бар',
  '':     'Не вказано',
};

// Константи ключів LocalStorage — єдине місце для зміни
const LS_KEYS = {
  NAV_ORDER:        'tiflis_nav_order',
  MENU_CUSTOM_CATS: 'menu_sections_custom',
  TG_TEMPLATES:     'tiflis_tg_templates',
  RESERVE_HALLS_ORDER: 'tiflis_reserve_halls_order',
  RESERVE_BOOKINGS: 'tiflis_reserve_bookings',
};

