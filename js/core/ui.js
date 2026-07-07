/* ─── UI: тости, модалки, дрібні компоненти ─── */
const UI = (() => {
  const toast = (msg, isErr = false) => {
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' toast--err' : '');
    el.textContent = msg;
    document.getElementById('toast-root').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  };

  const modal = (title, bodyHTML, { onMount } = {}) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h3 class="modal__title">${U.esc(title)}</h3>
          <button class="modal__close" aria-label="Закрити">✕</button>
        </div>
        <div class="modal__body">${bodyHTML}</div>
      </div>`;
    const close = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    wrap.querySelector('.modal__close').onclick = close;
    document.getElementById('modal-root').appendChild(wrap);
    if (onMount) onMount(wrap, close);
    return { el: wrap, close };
  };

  const confirm = (title, text) => new Promise(res => {
    modal(title, `
      <p style="color:var(--muted);font-size:14px">${U.esc(text)}</p>
      <div class="modal__actions">
        <button class="btn" data-a="no">Скасувати</button>
        <button class="btn btn--danger" data-a="yes">Так</button>
      </div>`, {
      onMount(el, close) {
        el.querySelector('[data-a=no]').onclick = () => { close(); res(false); };
        el.querySelector('[data-a=yes]').onclick = () => { close(); res(true); };
      },
    });
  });

  /* аватар і роль */
  const roleColor = role => `var(--role-${role}, var(--muted))`;
  const ava = (user, sm = false) =>
    `<span class="ava${sm ? ' ava--sm' : ''}" style="background:${roleColor(user.role)}">${U.esc(U.initials(user.name))}</span>`;
  const roleChip = role =>
    `<span class="chip chip--role" style="background:${roleColor(role)}">${U.esc(ACL.roleLabel(role))}</span>`;

  const skeletons = (n = 3) => Array.from({ length: n }, () => '<div class="skel"></div>').join('');

  const empty = (ico, text) => `<div class="empty"><span class="empty__ico">${ico}</span>${U.esc(text)}</div>`;

  return { toast, modal, confirm, ava, roleChip, roleColor, skeletons, empty };
})();
