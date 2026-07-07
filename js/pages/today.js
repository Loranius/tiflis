/* ─── Сторінка «Сьогодні» — дашборд зміни ─── */
Router.register('today', {
  async render(root) {
    const me = Auth.user();
    const t = U.todayISO();
    root.innerHTML = `<div class="hero">
        <div class="hero__date">${U.esc(U.fmtDateFull(t))}</div>
        <div class="hero__sub">Гамарджоба, ${U.esc(me.name)}! Гарної зміни ✦</div>
        <div class="hero__myshift" id="my-shift"></div>
      </div>
      <div class="sect"><div class="quick-grid" id="quick"></div></div>
      <div class="sect">
        <div class="sect__head"><h2 class="sect__title">Сьогодні працюють</h2></div>
        <div class="today-team" id="team">${UI.skeletons(2)}</div>
      </div>
      <div class="sect">
        <div class="sect__head"><h2 class="sect__title">Стоп-меню</h2><span class="sect__aside" id="stop-count"></span></div>
        <div id="stops">${UI.skeletons(1)}</div>
      </div>
      <div class="sect">
        <div class="sect__head"><h2 class="sect__title">Резерви на сьогодні</h2></div>
        <div id="res">${UI.skeletons(1)}</div>
      </div>`;

    /* швидкі дії — залежать від прав */
    const quick = [];
    if (ACL.canSee(me, 'schedule')) quick.push({ p: 'schedule', ico: '▦', label: 'Мій графік' });
    if (ACL.can(me, 'seeAllCash') || me.role === 'waiter' || me.role2 === 'waiter') quick.push({ p: 'cash', ico: '₴', label: 'Внести касу' });
    if (ACL.canSee(me, 'reserve')) quick.push({ p: 'reserve', ico: '⌘', label: 'Новий резерв' });
    if (ACL.canSee(me, 'menu')) quick.push({ p: 'menu', ico: '𐃯', label: 'Меню і стопи' });
    document.getElementById('quick').innerHTML = quick.map(q =>
      `<button class="quick" data-page="${q.p}"><span class="quick__ico">${q.ico}</span>${U.esc(q.label)}</button>`).join('');
    root.querySelectorAll('[data-page]').forEach(b => b.onclick = () => Router.go(b.dataset.page));

    const draw = async () => {
      const [users, sched, types, menu, reserves] = await Promise.all([
        Store.list('users'), Store.list('schedule', { date: t }),
        Store.list('shift_types'), Store.list('menu'), Store.list('reserves', { date: t }),
      ]);
      const typeMap = Object.fromEntries(types.map(x => [x.code, x]));
      const working = sched.filter(s => s.code && !['Х', 'О'].includes(s.code));

      /* моя зміна */
      const mine = sched.find(s => s.user_id === me.id);
      const myType = mine && typeMap[mine.code];
      document.getElementById('my-shift').innerHTML = mine && !['Х','О',''].includes(mine.code)
        ? `<div class="ticket ticket--accent"><div class="ticket__row">
             <div><div class="ticket__title">Твоя зміна сьогодні</div>
             <div class="ticket__meta">${U.esc(myType?.label || '')}</div></div>
             <span class="ticket__num">${U.esc(mine.code)}</span></div></div>`
        : `<div class="ticket"><div class="ticket__row">
             <div class="ticket__title">Сьогодні в тебе ${mine?.code === 'О' ? 'відпустка 🌴' : 'вихідний'}</div></div></div>`;

      /* команда за ролями */
      const byRole = {};
      working.forEach(s => {
        const u = users.find(x => x.id === s.user_id);
        if (!u) return;
        (byRole[u.role] = byRole[u.role] || []).push({ u, code: s.code });
      });
      const order = ['admin','hostess','waiter','bar','runner','chef','cook','sysadmin'];
      const teamEl = document.getElementById('team');
      const groups = order.filter(r => byRole[r]);
      teamEl.innerHTML = groups.length ? groups.map(r => `
        <div class="team-group">
          <div class="team-group__label"><span class="badge-dot" style="background:${UI.roleColor(r)}"></span>${U.esc(ACL.roleLabel(r))}</div>
          <div class="team-group__row">${byRole[r].map(({ u, code }) => `
            <span class="person-chip">${UI.ava(u, true)}${U.esc(u.name)}<span class="shiftcode">${U.esc(code)}</span></span>`).join('')}
          </div>
        </div>`).join('') : UI.empty('🌙', 'На сьогодні графік порожній');

      /* стопи */
      const stops = menu.filter(m => m.stopped);
      document.getElementById('stop-count').textContent = stops.length ? `${stops.length} поз.` : '';
      document.getElementById('stops').innerHTML = stops.length
        ? `<div class="rowlist">${stops.map(m => `
            <div class="row" style="border-left-color:var(--danger)">
              <div class="row__body"><div class="row__title">${U.esc(m.name)}</div>
              <div class="row__sub">${U.esc(m.section)}</div></div>
            </div>`).join('')}</div>`
        : UI.empty('✔', 'Стопів немає — все меню у продажу');

      /* резерви */
      const rs = reserves.slice().sort((a, b) => a.time.localeCompare(b.time));
      document.getElementById('res').innerHTML = rs.length
        ? rs.map(r => `
          <div class="ticket"><div class="ticket__row">
            <div><div class="ticket__title">${U.esc(r.name)} · ${r.guests} ${r.guests === 1 ? 'гість' : 'гостей'}</div>
            <div class="ticket__meta">Стіл ${U.esc(r.table || '—')}${r.note ? ' · ' + U.esc(r.note) : ''}</div></div>
            <span class="ticket__num">${U.esc(r.time)}</span></div></div>`).join('')
        : UI.empty('🕊', 'Резервів на сьогодні немає');
    };
    await draw();

    const unsubs = ['schedule', 'menu', 'reserves'].map(tbl => Store.onChange(tbl, draw));
    return () => unsubs.forEach(fn => fn());
  },
});
