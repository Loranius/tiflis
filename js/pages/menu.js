/* ─── Меню + стоп-меню в одному місці ─── */
Router.register('menu', {
  async render(root) {
    const me = Auth.user();
    const canStop = ACL.can(me, 'toggleStop');
    const canEdit = ACL.can(me, 'editMenu');
    let activeSection = 'all';

    root.innerHTML = `
      <div class="menu-tabs" id="tabs"></div>
      <div id="list">${UI.skeletons(5)}</div>
      ${canEdit ? '<div style="margin-top:14px"><button class="btn btn--primary btn--wide" id="add">+ Додати страву</button></div>' : ''}`;

    const draw = async () => {
      const menu = await Store.list('menu');
      const sections = [...new Set(menu.map(m => m.section))];
      const stops = menu.filter(m => m.stopped).length;

      document.getElementById('tabs').innerHTML =
        `<span class="chip ${activeSection === 'all' ? 'is-active' : ''}" data-s="all">Всі</span>` +
        `<span class="chip ${activeSection === 'stop' ? 'is-active' : ''}" data-s="stop">🛑 Стопи${stops ? ' · ' + stops : ''}</span>` +
        sections.map(s => `<span class="chip ${activeSection === s ? 'is-active' : ''}" data-s="${U.esc(s)}">${U.esc(s)}</span>`).join('');
      document.querySelectorAll('#tabs .chip').forEach(c => c.onclick = () => { activeSection = c.dataset.s; draw(); });

      let items = menu;
      if (activeSection === 'stop') items = menu.filter(m => m.stopped);
      else if (activeSection !== 'all') items = menu.filter(m => m.section === activeSection);

      document.getElementById('list').innerHTML = items.length
        ? `<div class="rowlist">${items.map(m => `
          <div class="row menu-item ${m.stopped ? 'is-stopped' : ''}" data-id="${m.id}">
            <div class="row__body">
              <div class="row__title">${U.esc(m.name)}</div>
              <div class="row__sub">${U.esc(m.section)}</div>
            </div>
            <span class="row__end">${U.esc(U.fmtMoney(m.price))}</span>
            ${canStop ? `<button class="stop-toggle" data-stop="${m.id}" title="${m.stopped ? 'Зняти зі стопу' : 'Поставити в стоп'}">${m.stopped ? '🛑' : '🟢'}</button>` : ''}
          </div>`).join('')}</div>`
        : UI.empty('𐃯', activeSection === 'stop' ? 'Стопів немає' : 'У цій секції порожньо');

      if (canStop) document.querySelectorAll('[data-stop]').forEach(b => {
        b.onclick = async e => {
          e.stopPropagation();
          const m = items.find(x => x.id === b.dataset.stop);
          await Store.update('menu', m.id, { stopped: !m.stopped });
          UI.toast(m.stopped ? `«${m.name}» знову у продажу` : `«${m.name}» — у стопі`);
          draw();
        };
      });

      if (canEdit) document.querySelectorAll('.menu-item').forEach(el => {
        el.onclick = () => openForm(items.find(x => x.id === el.dataset.id));
      });
    };

    const openForm = (item = null) => {
      UI.modal(item ? 'Редагувати страву' : 'Нова страва', `
        <label class="field"><span class="field__label">Назва</span>
          <input class="field__input" id="m-name" value="${U.esc(item?.name || '')}"></label>
        <label class="field"><span class="field__label">Секція</span>
          <input class="field__input" id="m-sect" value="${U.esc(item?.section || '')}" placeholder="Напр. Хачапурі"></label>
        <label class="field"><span class="field__label">Ціна, ₴</span>
          <input class="field__input mono" id="m-price" type="number" min="0" value="${item?.price ?? ''}"></label>
        <div class="modal__actions">
          ${item ? '<button class="btn btn--danger" id="m-del">Видалити</button>' : ''}
          <button class="btn btn--primary" id="m-save">Зберегти</button>
        </div>`, {
        onMount(el, close) {
          el.querySelector('#m-save').onclick = async () => {
            const name = el.querySelector('#m-name').value.trim();
            const section = el.querySelector('#m-sect').value.trim() || 'Інше';
            const price = Number(el.querySelector('#m-price').value) || 0;
            if (!name) { UI.toast('Вкажи назву', true); return; }
            if (item) await Store.update('menu', item.id, { name, section, price });
            else await Store.insert('menu', { name, section, price, stopped: false });
            close(); UI.toast('Збережено'); draw();
          };
          const del = el.querySelector('#m-del');
          if (del) del.onclick = async () => {
            if (!(await UI.confirm('Видалити страву?', item.name))) return;
            await Store.remove('menu', item.id); close(); UI.toast('Видалено'); draw();
          };
        },
      });
    };

    if (canEdit) document.getElementById('add').onclick = () => openForm();
    await draw();
  },
});
