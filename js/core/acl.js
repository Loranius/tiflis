/* ─── ACL: ЄДИНЕ місце, де живуть права доступу ───
 * Головний урок v1: гарди були розкидані по navigate(), сайдбару
 * і сторінках — і постійно розсинхронізовувались. Тут — один конфіг.
 *
 * Сторінки бачить роль, якщо вона є у PAGES[page].roles,
 * або '*' (усі). sysadmin бачить все завжди.
 * Адмін може вимкнути сторінку для ролі через Управління →
 * Доступи (перекриття зберігаються у settings, key='acl').
 */
const ACL = (() => {
  const ROLES = {
    sysadmin: 'Сисадмін',
    admin:    'Адмін',
    chef:     'Шеф-кухар',
    cook:     'Кухар',
    waiter:   'Офіціант',
    bar:      'Бармен',
    hostess:  'Хостес',
    runner:   'Ранер',
  };

  const PAGES = {
    today:    { title: 'Сьогодні',   ico: '☀', roles: '*' },
    schedule: { title: 'Графік',     ico: '▦', roles: ['sysadmin','admin','chef','cook','waiter','bar','hostess'] },
    cash:     { title: 'Каса',       ico: '₴', roles: ['sysadmin','admin','waiter','bar'] },
    menu:     { title: 'Меню',       ico: '𐃯', roles: ['sysadmin','admin','chef','cook','waiter','bar','hostess'] },
    reserve:  { title: 'Резерви',    ico: '⌘', roles: ['sysadmin','admin','waiter','hostess'] },
    staff:    { title: 'Персонал',   ico: '☰', roles: ['sysadmin','admin','chef','cook','waiter','bar','hostess'] },
    admin:    { title: 'Управління', ico: '⚙', roles: ['sysadmin','admin'] },
  };

  /* дії (не сторінки) */
  const ACTIONS = {
    editSchedule:  ['sysadmin','admin'],
    editOwnShift:  ['waiter','bar','cook','chef','hostess'], // свою клітинку — так
    toggleStop:    ['sysadmin','admin','chef','cook'],
    editMenu:      ['sysadmin','admin','chef'],
    manageReserve: ['sysadmin','admin','hostess'],
    manageUsers:   ['sysadmin','admin'],
    seeAllCash:    ['sysadmin','admin'],
  };

  let overrides = {}; // { page: { role: false } } — з settings

  const userRoles = u => [u.role, u.role2].filter(Boolean);

  const canSee = (u, page) => {
    if (!u || !PAGES[page]) return false;
    if (u.role === 'sysadmin') return true;
    const rs = userRoles(u);
    const base = PAGES[page].roles === '*' || rs.some(r => PAGES[page].roles.includes(r));
    if (!base) return false;
    // перекриття адміном: якщо ХОЧ ОДНА з ролей явно вимкнена і жодна не ввімкнена — ховаємо
    return !rs.every(r => overrides[page]?.[r] === false);
  };

  const can = (u, action) => {
    if (!u) return false;
    if (u.role === 'sysadmin') return true;
    return userRoles(u).some(r => (ACTIONS[action] || []).includes(r));
  };

  const navFor = u => Object.keys(PAGES).filter(p => canSee(u, p));

  const loadOverrides = async () => {
    try {
      const rows = await Store.list('settings', { key: 'acl' });
      overrides = rows[0] ? JSON.parse(rows[0].value) : {};
    } catch (e) { overrides = {}; }
  };
  const saveOverrides = async next => {
    overrides = next;
    const rows = await Store.list('settings', { key: 'acl' });
    if (rows[0]) await Store.update('settings', rows[0].id, { value: JSON.stringify(next) });
    else await Store.insert('settings', { key: 'acl', value: JSON.stringify(next) });
  };

  const roleLabel = r => ROLES[r] || r;

  return { ROLES, PAGES, canSee, can, navFor, roleLabel, loadOverrides, saveOverrides, getOverrides: () => overrides };
})();
