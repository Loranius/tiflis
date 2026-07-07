/* ─── Старт додатку ─── */
const App = (() => {
  const THEME_KEY = 'tiflis2.theme';

  const applyTheme = t => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem(THEME_KEY, t);
  };
  const initTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) applyTheme(saved);
    else applyTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  };
  const toggleTheme = () =>
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

  const showApp = async () => {
    await ACL.loadOverrides();
    const me = Auth.user();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('topbar-user').innerHTML = `${UI.ava(me, true)} <span>${U.esc(me.name)}</span>`;
    Router.start();
  };

  const showLogin = () => {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');

    if (Store.mode === 'demo') {
      const hint = document.getElementById('demo-hint');
      hint.classList.remove('hidden');
      hint.innerHTML = `<b>Демо-режим</b> — Supabase не налаштований, дані локальні.
        Спробуй різні ролі:
        <div class="chiprow">
          <span class="chip" data-demo="Діма|0000">Діма · сисадмін</span>
          <span class="chip" data-demo="Тамара|1111">Тамара · адмін</span>
          <span class="chip" data-demo="Оксана|2222">Оксана · офіціант</span>
          <span class="chip" data-demo="Сергій|3333">Сергій · кухар</span>
          <span class="chip" data-demo="Ніно|5555">Ніно · хостес</span>
        </div>`;
      hint.querySelectorAll('[data-demo]').forEach(c => {
        c.style.cursor = 'pointer';
        c.onclick = () => {
          const [n, p] = c.dataset.demo.split('|');
          document.getElementById('login-name').value = n;
          document.getElementById('login-pin').value = p;
        };
      });
    }

    document.getElementById('login-form').onsubmit = async e => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const err = document.getElementById('login-err');
      btn.disabled = true; err.textContent = '';
      try {
        await Auth.login(
          document.getElementById('login-name').value,
          document.getElementById('login-pin').value);
        showApp();
      } catch (ex) {
        err.textContent = ex.message;
      } finally { btn.disabled = false; }
    };
  };

  const boot = async () => {
    initTheme();
    document.getElementById('theme-btn-side').onclick = toggleTheme;
    document.getElementById('logout-btn-side').onclick = () => Auth.logout();

    const me = await Auth.restore();
    if (me) showApp(); else showLogin();

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  };

  return { boot, toggleTheme };
})();

App.boot();
