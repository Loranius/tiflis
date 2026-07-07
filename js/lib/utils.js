/* ─── Утиліти ─── */
const U = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => iso(new Date());
  const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  const MONTHS = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  const MONTHS_NOM = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
  const DOW = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];

  const fmtDate = isoStr => {
    const d = new Date(isoStr + 'T00:00:00');
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const fmtDateFull = isoStr => {
    const d = new Date(isoStr + 'T00:00:00');
    return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const fmtMoney = n => Number(n || 0).toLocaleString('uk-UA') + ' ₴';

  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const debounce = (fn, ms = 400) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  return { esc, uid, iso, todayISO, monthKey, fmtDate, fmtDateFull, fmtMoney, initials, debounce, MONTHS, MONTHS_NOM, DOW, pad };
})();
