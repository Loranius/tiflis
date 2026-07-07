/* ─── Router: хеш-навігація + рендер меню з ACL ───
 * Гард ОДИН: якщо ACL.canSee() каже "ні" — редірект на першу
 * доступну сторінку. Меню будується з того ж списку. Крапка.
 */
const Router = (() => {
  const pages = {}; // name → { render(container) , destroy?() }
  let current = null;
  let destroyCurrent = null;

  const register = (name, page) => { pages[name] = page; };

  const go = name => { location.hash = '#' + name; };

  const renderNav = () => {
    const u = Auth.user();
    const items = ACL.navFor(u);
    const tabItems = items.slice(0, 5);
    const tabbar = document.getElementById('tabbar');
    tabbar.innerHTML = tabItems.map(p => `
      <button class="tab ${p === current ? 'is-active' : ''}" data-page="${p}">
        <span class="tab__ico">${ACL.PAGES[p].ico}</span>${U.esc(ACL.PAGES[p].title)}
      </button>`).join('') +
      (items.length > 5 ? `<button class="tab" data-more>▸<span></span>Ще</button>` : '');
    tabbar.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
    const more = tabbar.querySelector('[data-more]');
    if (more) more.onclick = () => {
      UI.modal('Ще', `<div class="rowlist">${items.slice(5).map(p => `
        <button class="row" data-page="${p}" style="border-left-color:var(--accent)">
          <span class="tab__ico">${ACL.PAGES[p].ico}</span>
          <div class="row__body"><div class="row__title">${U.esc(ACL.PAGES[p].title)}</div></div>
        </button>`).join('')}
        <button class="row" data-theme style="border-left-color:var(--gold)">◐
          <div class="row__body"><div class="row__title">Змінити тему</div></div></button>
        <button class="row" data-logout style="border-left-color:var(--danger)">⏻
          <div class="row__body"><div class="row__title">Вийти</div></div></button>
      </div>`, {
        onMount(el, close) {
          el.querySelectorAll('[data-page]').forEach(b => b.onclick = () => { close(); go(b.dataset.page); });
          el.querySelector('[data-theme]').onclick = () => { App.toggleTheme(); close(); };
          el.querySelector('[data-logout]').onclick = () => Auth.logout();
        },
      });
    };

    const side = document.getElementById('sidebar-nav');
    side.innerHTML = items.map(p => `
      <button class="navbtn ${p === current ? 'is-active' : ''}" data-page="${p}">
        ${ACL.PAGES[p].ico} <span>${U.esc(ACL.PAGES[p].title)}</span>
      </button>`).join('');
    side.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
  };

  const handle = async () => {
    const u = Auth.user();
    if (!u) return;
    let name = (location.hash || '#today').slice(1);
    if (!pages[name] || !ACL.canSee(u, name)) name = ACL.navFor(u)[0] || 'today';

    if (destroyCurrent) { try { destroyCurrent(); } catch (e) {} destroyCurrent = null; }
    current = name;

    document.getElementById('topbar-title').textContent = ACL.PAGES[name].title;
    const container = document.getElementById('page');
    container.innerHTML = '';
    window.scrollTo(0, 0);
    const res = await pages[name].render(container);
    if (res && typeof res === 'function') destroyCurrent = res;
    renderNav();
  };

  const start = () => {
    window.addEventListener('hashchange', handle);
    handle();
  };

  return { register, go, start, renderNav, currentPage: () => current };
})();
