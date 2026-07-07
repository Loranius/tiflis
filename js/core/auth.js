/* ─── Auth: вхід за ім'ям + PIN, сесія в localStorage ─── */
const Auth = (() => {
  const SESSION_KEY = 'tiflis2.session';
  let currentUser = null;

  const user = () => currentUser;

  const login = async (name, pin) => {
    const users = await Store.list('users');
    const u = users.find(x =>
      x.name.trim().toLowerCase() === String(name).trim().toLowerCase() && String(x.pin) === String(pin));
    if (!u) throw new Error('Невірне ім\u02bcя або PIN');
    currentUser = u;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, at: Date.now() }));
    return u;
  };

  const restore = async () => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!s?.id) return null;
      const users = await Store.list('users');
      currentUser = users.find(x => x.id === s.id) || null;
      if (!currentUser) localStorage.removeItem(SESSION_KEY);
      return currentUser;
    } catch (e) { return null; }
  };

  const logout = () => {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    location.reload();
  };

  return { user, login, restore, logout };
})();
