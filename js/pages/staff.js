/* ─── Персонал: плитки з кольором ролі, профіль ─── */
Router.register('staff', {
  async render(root) {
    root.innerHTML = `<div class="staff-grid" id="grid">${UI.skeletons(6)}</div>`;

    const [users, sched, cash] = await Promise.all([
      Store.list('users'), Store.list('schedule'), Store.list('cash'),
    ]);
    const t = U.todayISO();
    const mk = U.monthKey(new Date());
    const order = ['sysadmin','admin','chef','cook','waiter','bar','hostess','runner'];
    const sorted = users.slice().sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name, 'uk'));

    document.getElementById('grid').innerHTML = sorted.map(u => `
      <button class="staff-tile" data-id="${u.id}" style="border-top-color:${UI.roleColor(u.role)}">
        ${UI.ava(u)}
        <div class="staff-tile__name">${U.esc(u.name)}</div>
        <div class="staff-tile__role">${U.esc(ACL.roleLabel(u.role))}${u.role2 ? ' · ' + U.esc(ACL.roleLabel(u.role2)) : ''}</div>
      </button>`).join('');

    document.querySelectorAll('.staff-tile').forEach(el => el.onclick = () => {
      const u = users.find(x => x.id === el.dataset.id);
      const todayShift = sched.find(s => s.user_id === u.id && s.date === t);
      const monthShifts = sched.filter(s => s.user_id === u.id && s.date.startsWith(mk) && s.code && !['Х','О'].includes(s.code)).length;
      const monthCash = cash.filter(c => c.user_id === u.id && c.date.startsWith(mk))
        .reduce((s, c) => s + Number(c.amount || 0), 0);

      UI.modal(u.name, `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          ${UI.ava(u)}
          <div>${UI.roleChip(u.role)} ${u.role2 ? UI.roleChip(u.role2) : ''}</div>
        </div>
        <div class="rowlist">
          <div class="row" style="border-left-color:var(--gold)">
            <div class="row__body"><div class="row__title">Сьогодні</div></div>
            <span class="row__end">${U.esc(todayShift?.code && !['Х','О'].includes(todayShift.code) ? 'Зміна ' + todayShift.code : 'Вихідний')}</span>
          </div>
          <div class="row" style="border-left-color:var(--green)">
            <div class="row__body"><div class="row__title">Змін цього місяця</div></div>
            <span class="row__end">${monthShifts}</span>
          </div>
          ${['waiter','bar'].includes(u.role) || ['waiter','bar'].includes(u.role2) ? `
          <div class="row" style="border-left-color:var(--accent)">
            <div class="row__body"><div class="row__title">Каса за місяць</div></div>
            <span class="row__end">${U.esc(U.fmtMoney(monthCash))}</span>
          </div>` : ''}
        </div>`);
    });
  },
});
