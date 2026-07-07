/* ─── Каса: внесення сум, місячна статистика, рейтинг ─── */
Router.register('cash', {
  async render(root) {
    const me = Auth.user();
    const seeAll = ACL.can(me, 'seeAllCash');
    let view = new Date();

    root.innerHTML = `
      <div class="sched-head">
        <div class="sched-head__month" id="cash-month"></div>
        <div class="sched-nav">
          <button class="btn btn--sm" id="prev">‹</button>
          <button class="btn btn--sm" id="next">›</button>
        </div>
      </div>
      <div id="total"></div>
      <div class="sect">
        <div class="sect__head">
          <h2 class="sect__title">Рейтинг місяця</h2>
        </div>
        <div id="rating">${UI.skeletons(3)}</div>
      </div>
      <div class="sect">
        <div class="sect__head">
          <h2 class="sect__title">${seeAll ? 'Останні записи' : 'Мої записи'}</h2>
          <button class="btn btn--sm btn--primary" id="add">+ Внести</button>
        </div>
        <div id="entries">${UI.skeletons(3)}</div>
      </div>`;

    const draw = async () => {
      const mk = U.monthKey(view);
      document.getElementById('cash-month').textContent = `${U.MONTHS_NOM[view.getMonth()]} ${view.getFullYear()}`;
      const [cash, users] = await Promise.all([Store.list('cash'), Store.list('users')]);
      const monthRows = cash.filter(c => c.date.startsWith(mk));
      const uById = Object.fromEntries(users.map(u => [u.id, u]));

      /* сумарно */
      const myRows = monthRows.filter(c => c.user_id === me.id);
      const totalSum = (seeAll ? monthRows : myRows).reduce((s, c) => s + Number(c.amount || 0), 0);
      document.getElementById('total').innerHTML = `
        <div class="cash-total">
          <div class="cash-total__label">${seeAll ? 'Каса закладу за місяць' : 'Твоя каса за місяць'}</div>
          <div class="cash-total__sum">${U.esc(U.fmtMoney(totalSum))}</div>
          <div class="cash-total__sub">${(seeAll ? monthRows : myRows).length} записів · режим: ${Store.mode === 'demo' ? 'демо' : 'Supabase'}</div>
        </div>`;

      /* рейтинг */
      const byUser = {};
      monthRows.forEach(c => { byUser[c.user_id] = (byUser[c.user_id] || 0) + Number(c.amount || 0); });
      const rating = Object.entries(byUser)
        .map(([id, sum]) => ({ u: uById[id], sum })).filter(x => x.u)
        .sort((a, b) => b.sum - a.sum);
      document.getElementById('rating').innerHTML = rating.length
        ? `<div class="rowlist">${rating.map((r, i) => `
            <div class="row" style="border-left-color:${UI.roleColor(r.u.role)}">
              <span class="rating-pos ${i === 0 ? 'top1' : ''}">${i + 1}</span>
              ${UI.ava(r.u, true)}
              <div class="row__body"><div class="row__title">${U.esc(r.u.name)} ${r.u.id === me.id ? '· ти' : ''}</div></div>
              <span class="row__end">${U.esc(U.fmtMoney(r.sum))}</span>
            </div>`).join('')}</div>`
        : UI.empty('₴', 'За цей місяць записів ще немає');

      /* записи */
      const list = (seeAll ? monthRows : myRows)
        .slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
      document.getElementById('entries').innerHTML = list.length
        ? list.map(c => `
          <div class="ticket" data-id="${c.id}"><div class="ticket__row">
            <div><div class="ticket__title">${seeAll ? U.esc(uById[c.user_id]?.name || '?') : 'Каса за зміну'}</div>
            <div class="ticket__meta">${U.esc(U.fmtDate(c.date))}</div></div>
            <span class="ticket__num">${U.esc(U.fmtMoney(c.amount))}</span></div></div>`).join('')
        : UI.empty('⋯', 'Порожньо. Натисни «+ Внести»');

      /* редагування свого запису тапом */
      document.querySelectorAll('#entries .ticket').forEach(el => {
        el.onclick = () => {
          const c = list.find(x => x.id === el.dataset.id);
          if (!c || (c.user_id !== me.id && !seeAll)) return;
          openForm(c);
        };
      });
    };

    const openForm = (entry = null) => {
      UI.modal(entry ? 'Редагувати запис' : 'Внести касу', `
        <label class="field"><span class="field__label">Дата</span>
          <input class="field__input mono" id="f-date" type="date" value="${entry?.date || U.todayISO()}"></label>
        <label class="field"><span class="field__label">Сума, ₴</span>
          <input class="field__input mono" id="f-sum" type="number" inputmode="decimal" min="0" step="1"
            value="${entry?.amount ?? ''}" placeholder="0"></label>
        <div class="modal__actions">
          ${entry ? '<button class="btn btn--danger" id="f-del">Видалити</button>' : ''}
          <button class="btn btn--primary" id="f-save">${entry ? 'Зберегти' : 'Внести'}</button>
        </div>`, {
        onMount(el, close) {
          el.querySelector('#f-save').onclick = async () => {
            const date = el.querySelector('#f-date').value;
            const amount = Number(el.querySelector('#f-sum').value);
            if (!date || !(amount > 0)) { UI.toast('Вкажи дату і суму', true); return; }
            try {
              if (entry) await Store.update('cash', entry.id, { date, amount });
              else await Store.insert('cash', { user_id: me.id, date, amount });
              close(); UI.toast(entry ? 'Збережено' : 'Внесено ✔'); draw();
            } catch (e) { UI.toast(e.message, true); }
          };
          const del = el.querySelector('#f-del');
          if (del) del.onclick = async () => {
            if (!(await UI.confirm('Видалити запис?', 'Цю дію не можна скасувати.'))) return;
            await Store.remove('cash', entry.id);
            close(); UI.toast('Видалено'); draw();
          };
        },
      });
    };

    document.getElementById('add').onclick = () => openForm();
    document.getElementById('prev').onclick = () => { view.setMonth(view.getMonth() - 1); draw(); };
    document.getElementById('next').onclick = () => { view.setMonth(view.getMonth() + 1); draw(); };
    await draw();
  },
});
