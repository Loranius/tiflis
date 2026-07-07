/* ─── Управління: користувачі, типи змін, доступи ─── */
Router.register('admin', {
  async render(root) {
    const me = Auth.user();
    let tab = 'users';

    root.innerHTML = `
      <div class="seg admin-tabs" id="tabs">
        <button class="seg__btn is-active" data-t="users">Користувачі</button>
        <button class="seg__btn" data-t="shifts">Типи змін</button>
        <button class="seg__btn" data-t="acl">Доступи</button>
      </div>
      <div id="body"></div>`;

    const body = document.getElementById('body');

    /* ── Користувачі ── */
    const drawUsers = async () => {
      const users = await Store.list('users');
      body.innerHTML = `
        <button class="btn btn--primary btn--wide" id="u-add">+ Новий користувач</button>
        <div class="rowlist" style="margin-top:12px">${users.map(u => `
          <button class="row" data-id="${u.id}" style="border-left-color:${UI.roleColor(u.role)}">
            ${UI.ava(u, true)}
            <div class="row__body"><div class="row__title">${U.esc(u.name)}</div>
            <div class="row__sub">${U.esc(ACL.roleLabel(u.role))}${u.role2 ? ' · ' + U.esc(ACL.roleLabel(u.role2)) : ''}</div></div>
            <span class="row__end">PIN ${U.esc(String(u.pin))}</span>
          </button>`).join('')}</div>`;

      const roleOptions = sel => Object.entries(ACL.ROLES)
        .map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${U.esc(v)}</option>`).join('');

      const openUser = (u = null) => {
        UI.modal(u ? u.name : 'Новий користувач', `
          <label class="field"><span class="field__label">Ім'я</span>
            <input class="field__input" id="uf-name" value="${U.esc(u?.name || '')}"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label class="field"><span class="field__label">Роль</span>
              <select class="field__select" id="uf-role">${roleOptions(u?.role || 'waiter')}</select></label>
            <label class="field"><span class="field__label">Друга роль</span>
              <select class="field__select" id="uf-role2"><option value="">—</option>${roleOptions(u?.role2 || '')}</select></label>
          </div>
          <label class="field"><span class="field__label">PIN для входу</span>
            <input class="field__input mono" id="uf-pin" inputmode="numeric" value="${U.esc(String(u?.pin || ''))}"></label>
          <div class="modal__actions">
            ${u && u.id !== me.id ? '<button class="btn btn--danger" id="uf-del">Видалити</button>' : ''}
            <button class="btn btn--primary" id="uf-save">Зберегти</button>
          </div>`, {
          onMount(el, close) {
            el.querySelector('#uf-save').onclick = async () => {
              const data = {
                name: el.querySelector('#uf-name').value.trim(),
                role: el.querySelector('#uf-role').value,
                role2: el.querySelector('#uf-role2').value || null,
                pin: el.querySelector('#uf-pin').value.trim(),
              };
              if (!data.name || !data.pin) { UI.toast('Ім\u02bcя і PIN обов\u02bcязкові', true); return; }
              if (u) await Store.update('users', u.id, data);
              else await Store.insert('users', data);
              close(); UI.toast('Збережено'); drawUsers();
            };
            const del = el.querySelector('#uf-del');
            if (del) del.onclick = async () => {
              if (!(await UI.confirm('Видалити користувача?', u.name))) return;
              await Store.remove('users', u.id); close(); UI.toast('Видалено'); drawUsers();
            };
          },
        });
      };

      body.querySelector('#u-add').onclick = () => openUser();
      body.querySelectorAll('.row[data-id]').forEach(el =>
        el.onclick = () => openUser(users.find(x => x.id === el.dataset.id)));
    };

    /* ── Типи змін ── */
    const drawShifts = async () => {
      const types = await Store.list('shift_types');
      body.innerHTML = `
        <p style="color:var(--muted);font-size:13px;margin-bottom:12px">
          Коди, які видно в графіку. Порядок циклу при тапі: порожньо → ${types.map(t => t.code).join(' → ')}.
        </p>
        <button class="btn btn--primary btn--wide" id="t-add">+ Новий тип</button>
        <div class="rowlist" style="margin-top:12px">${types.map(t => `
          <button class="row" data-id="${t.id}">
            <span class="ticket__num" style="width:30px">${U.esc(t.code)}</span>
            <div class="row__body"><div class="row__title">${U.esc(t.label)}</div></div>
            <span class="chip">${U.esc(t.color)}</span>
          </button>`).join('')}</div>`;

      const openType = (t = null) => {
        UI.modal(t ? 'Тип зміни' : 'Новий тип зміни', `
          <div style="display:grid;grid-template-columns:90px 1fr;gap:10px">
            <label class="field"><span class="field__label">Код</span>
              <input class="field__input mono" id="tf-code" maxlength="2" value="${U.esc(t?.code || '')}"></label>
            <label class="field"><span class="field__label">Назва</span>
              <input class="field__input" id="tf-label" value="${U.esc(t?.label || '')}"></label>
          </div>
          <label class="field"><span class="field__label">Колір</span>
            <select class="field__select" id="tf-color">
              ${['green','gold','accent','muted'].map(c => `<option ${t?.color === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select></label>
          <div class="modal__actions">
            ${t ? '<button class="btn btn--danger" id="tf-del">Видалити</button>' : ''}
            <button class="btn btn--primary" id="tf-save">Зберегти</button>
          </div>`, {
          onMount(el, close) {
            el.querySelector('#tf-save').onclick = async () => {
              const data = {
                code: el.querySelector('#tf-code').value.trim().toUpperCase(),
                label: el.querySelector('#tf-label').value.trim(),
                color: el.querySelector('#tf-color').value,
              };
              if (!data.code || !data.label) { UI.toast('Код і назва обов\u02bcязкові', true); return; }
              if (t) await Store.update('shift_types', t.id, data);
              else await Store.insert('shift_types', data);
              close(); UI.toast('Збережено'); drawShifts();
            };
            const del = el.querySelector('#tf-del');
            if (del) del.onclick = async () => {
              if (!(await UI.confirm('Видалити тип?', t.label))) return;
              await Store.remove('shift_types', t.id); close(); drawShifts();
            };
          },
        });
      };

      body.querySelector('#t-add').onclick = () => openType();
      body.querySelectorAll('.row[data-id]').forEach(el =>
        el.onclick = () => openType(types.find(x => x.id === el.dataset.id)));
    };

    /* ── Доступи (перекриття ACL) ── */
    const drawAcl = async () => {
      await ACL.loadOverrides();
      const ov = structuredClone(ACL.getOverrides());
      const roles = Object.keys(ACL.ROLES).filter(r => r !== 'sysadmin');

      body.innerHTML = `
        <p style="color:var(--muted);font-size:13px;margin-bottom:12px">
          Вимикай сторінки для окремих ролей. Сисадмін бачить усе завжди.
          Зміни зберігаються автоматично.
        </p>
        ${Object.entries(ACL.PAGES).map(([page, cfg]) => `
          <div class="card">
            <div class="sect__head" style="margin-bottom:8px">
              <h3 class="sect__title" style="font-size:16px">${cfg.ico} ${U.esc(cfg.title)}</h3>
            </div>
            <div class="perm-grid">
              ${roles.filter(r => cfg.roles === '*' || cfg.roles.includes(r)).map(r => {
                const on = ov[page]?.[r] !== false;
                return `<label class="perm-row"><span>${U.esc(ACL.roleLabel(r))}</span>
                  <span class="switch"><input type="checkbox" data-page="${page}" data-role="${r}" ${on ? 'checked' : ''}>
                  <span class="switch__track"></span></span></label>`;
              }).join('')}
            </div>
          </div>`).join('')}
        ${Store.mode === 'demo' ? `<div class="card" style="margin-top:12px">
          <button class="btn btn--danger btn--wide" id="reset-demo">Скинути демо-дані</button></div>` : ''}`;

      body.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.onchange = async () => {
          const { page, role } = cb.dataset;
          ov[page] = ov[page] || {};
          if (cb.checked) delete ov[page][role]; else ov[page][role] = false;
          if (!Object.keys(ov[page]).length) delete ov[page];
          await ACL.saveOverrides(ov);
          UI.toast('Доступи оновлено');
          Router.renderNav();
        };
      });
      const reset = body.querySelector('#reset-demo');
      if (reset) reset.onclick = async () => {
        if (!(await UI.confirm('Скинути демо-дані?', 'Всі локальні зміни зникнуть, дані повернуться до початкових.'))) return;
        Store.resetDemo(); location.reload();
      };
    };

    const draws = { users: drawUsers, shifts: drawShifts, acl: drawAcl };
    document.querySelectorAll('#tabs .seg__btn').forEach(b => {
      b.onclick = () => {
        tab = b.dataset.t;
        document.querySelectorAll('#tabs .seg__btn').forEach(x => x.classList.toggle('is-active', x === b));
        draws[tab]();
      };
    });
    await drawUsers();
  },
});
