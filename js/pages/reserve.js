/* ─── Резерви: список за днями, швидке додавання ─── */
Router.register('reserve', {
  async render(root) {
    const me = Auth.user();
    const canManage = ACL.can(me, 'manageReserve') || me.role === 'waiter' || me.role2 === 'waiter';

    root.innerHTML = `
      ${canManage ? '<button class="btn btn--primary btn--wide" id="add">+ Новий резерв</button>' : ''}
      <div id="list" style="margin-top:14px">${UI.skeletons(3)}</div>`;

    const draw = async () => {
      const reserves = await Store.list('reserves');
      const t = U.todayISO();
      const upcoming = reserves.filter(r => r.date >= t)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      const byDate = {};
      upcoming.forEach(r => (byDate[r.date] = byDate[r.date] || []).push(r));

      document.getElementById('list').innerHTML = upcoming.length
        ? Object.entries(byDate).map(([date, rows]) => `
          <div class="res-day">
            <div class="team-group__label">${date === t ? 'Сьогодні' : U.esc(U.fmtDateFull(date))}</div>
            ${rows.map(r => `
              <div class="ticket ticket--accent" data-id="${r.id}"><div class="ticket__row">
                <div><div class="ticket__title">${U.esc(r.name)} · ${r.guests} ${r.guests === 1 ? 'гість' : 'гостей'} · стіл ${U.esc(r.table || '—')}</div>
                <div class="ticket__meta">${U.esc(r.phone || '')}${r.note ? ' · ' + U.esc(r.note) : ''}</div></div>
                <span class="ticket__num">${U.esc(r.time)}</span></div></div>`).join('')}
          </div>`).join('')
        : UI.empty('⌘', 'Майбутніх резервів немає');

      if (canManage) document.querySelectorAll('#list .ticket').forEach(el => {
        el.onclick = () => openForm(upcoming.find(x => x.id === el.dataset.id));
      });
    };

    const openForm = (r = null) => {
      UI.modal(r ? 'Редагувати резерв' : 'Новий резерв', `
        <label class="field"><span class="field__label">Ім'я гостя</span>
          <input class="field__input" id="r-name" value="${U.esc(r?.name || '')}"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="field"><span class="field__label">Дата</span>
            <input class="field__input mono" id="r-date" type="date" value="${r?.date || U.todayISO()}"></label>
          <label class="field"><span class="field__label">Час</span>
            <input class="field__input mono" id="r-time" type="time" value="${r?.time || '19:00'}"></label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="field"><span class="field__label">Гостей</span>
            <input class="field__input mono" id="r-guests" type="number" min="1" value="${r?.guests || 2}"></label>
          <label class="field"><span class="field__label">Стіл</span>
            <input class="field__input mono" id="r-table" value="${U.esc(r?.table || '')}"></label>
        </div>
        <label class="field"><span class="field__label">Телефон</span>
          <input class="field__input mono" id="r-phone" type="tel" value="${U.esc(r?.phone || '')}"></label>
        <label class="field"><span class="field__label">Примітка</span>
          <textarea class="field__area" id="r-note">${U.esc(r?.note || '')}</textarea></label>
        <div class="modal__actions">
          ${r ? '<button class="btn btn--danger" id="r-del">Видалити</button>' : ''}
          <button class="btn btn--primary" id="r-save">Зберегти</button>
        </div>`, {
        onMount(el, close) {
          el.querySelector('#r-save').onclick = async () => {
            const data = {
              name: el.querySelector('#r-name').value.trim(),
              date: el.querySelector('#r-date').value,
              time: el.querySelector('#r-time').value,
              guests: Number(el.querySelector('#r-guests').value) || 1,
              table: el.querySelector('#r-table').value.trim(),
              phone: el.querySelector('#r-phone').value.trim(),
              note: el.querySelector('#r-note').value.trim(),
            };
            if (!data.name || !data.date || !data.time) { UI.toast('Ім\u02bcя, дата і час — обов\u02bcязкові', true); return; }
            if (r) await Store.update('reserves', r.id, data);
            else await Store.insert('reserves', data);
            close(); UI.toast('Резерв збережено'); draw();
          };
          const del = el.querySelector('#r-del');
          if (del) del.onclick = async () => {
            if (!(await UI.confirm('Видалити резерв?', `${r.name}, ${r.time}`))) return;
            await Store.remove('reserves', r.id); close(); UI.toast('Видалено'); draw();
          };
        },
      });
    };

    if (canManage) document.getElementById('add').onclick = () => openForm();
    await draw();
  },
});
