// ╔═══════════════════════════════════════════════════════════════╗
// ║  [5/13]  УТІЛІТИ (хелпери, toast, modal, дати, юзери)         ║
// ╚═══════════════════════════════════════════════════════════════╝
const $ = id => document.getElementById(id);
const toast = (msg, type='') => {
  const t = $('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = '', 2800);
};
function showModal(html) {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('active');
}
function closeModal() {
  $('modal-overlay').classList.remove('active');
}
$('modal-overlay').addEventListener('click', e => { if(e.target === $('modal-overlay')) closeModal(); });

const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const NOW = () => new Date();
const padZ = n => String(n).padStart(2,'0');
const dateKey = (y,m,d) => `${y}-${padZ(m+1)}-${padZ(d)}`;
const todayKey = () => { const n=NOW(); return dateKey(n.getFullYear(), n.getMonth(), n.getDate()); };
const parseDateKey = dk => { const [y,m,d]=dk.split("-").map(Number); return new Date(y,m-1,d); };

function getRoleLabel(key) {
  const roles = DB.get('roles',[]);
  return (roles.find(r=>r.key===key)||{label:key}).label;
}
// ID системного адміна — привілеї прив'язані до цього ID назавжди,
// незалежно від ролі у базі даних. Ніхто не може це змінити через інтерфейс.
const SYSADMIN_ID = 'sysadmin';

function isSysadmin(u) {
  return u && u.id === SYSADMIN_ID;
}

function getUsers(fired=false) {
  return (DB.get('users',[])).filter(u => {
    return (u.fired||false) === fired;
  }).map(u => {
    // Сисадмін завжди відображається як офіціант для всіх крім себе
    if (isSysadmin(u)) {
      const displayRole = u.display_role || u.role || 'waiter';
      return { ...u, _isSysadmin: true, role: displayRole };
    }
    return u;
  });
}
function getUserById(id) { return (DB.get('users',[])).find(u=>u.id===id); }
// Повертає юзера з підміненою роллю (для відображення не-адмінам)
function getDisplayUser(id) {
  const u = getUserById(id);
  if (!u) return null;
  if (isSysadmin(u)) {
    const displayRole = u.display_role || u.role || 'waiter';
    return { ...u, _isSysadmin: true, role: displayRole };
  }
  return u;
}
function avatarHTML(user, size=48, fontSize=18) {
  const style = `width:${size}px;height:${size}px;border-radius:50%;background:var(--eden-light);border:2px solid var(--gold-border);display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:700;color:var(--gold);flex-shrink:0;overflow:hidden;`;
  if (user.avatar) return `<div style="${style}"><img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>`;
  return `<div style="${style}">${(user.displayName||user.login||'?')[0].toUpperCase()}</div>`;
}
// Адмін = сисадмін (за ID) або роль admin
const isAdmin = (u) => u && (isSysadmin(u) || u._isSysadmin || u.role==='admin');
// Може надсилати сповіщення: адміни, сисадмін, або офіціант Оксана
const canSendNotify = (u) => {
  if (!u) return false;
  if (isAdmin(u)) return true;
  // Офіціант Оксана — перевіряємо login і displayName (регістронезалежно)
  const name = (u.displayName || u.login || '').trim().toLowerCase();
  return name === 'оксана';
};

