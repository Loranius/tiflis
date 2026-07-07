/* ─── Графік: місячна сітка, тап по клітинці = наступний тип зміни, автозбереження ─── */
Router.register('schedule', {
  async render(root) {
    const me = Auth.user();
    let view = new Date(); view.setDate(1);

    root.innerHTML = `
      <div class="sched-head">
        <div class="sched-head__month" id="sched-month"></div>
        <div class="sched-nav">
          <button class="btn btn--sm" id="prev">‹</button>
          <button class="btn btn--sm" id="today-btn">Сьогодні</button>
          <button class="btn btn--sm" id="next">›</button>
        </div>
      </div>
      <div class="sched-scroll"><div id="grid">${UI.skeletons(4)}</div></div>
      <div class="sched-legend" id="legend"></div>
      <p style="margin-top:10px;color:var(--muted);font-size:12.5px">
        ${ACL.can(me, 'editSchedule')
          ? 'Тапни клітинку, щоб змінити тип зміни. Зберігається автоматично.'
          : 'Ти можеш редагувати лише свій рядок. Тапни клітинку — збережеться саме.'}
      </p>`;

    const colorOf = c => ({ green: 'var(--green)', gold: 'var(--gold)', accent: 'var(--accent)', muted: 'var(--muted)' }[c] || 'var(--muted)');

    let types = [], users = [], sched = [];
    const cycle = code => {
      const codes = ['', ...types.map(t => t.code)];
      return codes[(codes.indexOf(code || '') + 1) % codes.length];
    };

    const draw = async () => {
      [types, users] = await Promise.all([Store.list('shift_types'), Store.list('users')]);
      sched = await Store.list('schedule');
      const y = view.getFullYear(), m = view.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      const t = U.todayISO();
      document.getElementById('sched-month').textContent = `${U.MONTHS_NOM[m]} ${y}`;

      const map = {};
      sched.forEach(s => { map[`${s.user_id}|${s.date}`] = s; });
      const typeByCode = Object.fromEntries(types.map(x => [x.code, x]));

      const visibleUsers = users.filter(u => u.role !== 'sysadmin' || u.id === me.id);
      let html = `<table class="sched-table"><thead><tr><th style="text-align:left;padding-left:10px">Ім'я</th>`;
      for (let d = 1; d <= days; d++) {
        const date = `${y}-${U.pad(m + 1)}-${U.pad(d)}`;
        const dow = new Date(date + 'T00:00:00').getDay();
        html += `<th class="${date === t ? 'is-today' : ''}">${d}<br>${U.DOW[dow]}</th>`;
      }
      html += '</tr></thead><tbody>';
      visibleUsers.forEach(u => {
        html += `<tr><td class="name-cell" style="border-left:4px solid ${UI.roleColor(u.role)}">${U.esc(u.name)}</td>`;
        for (let d = 1; d <= days; d++) {
          const date = `${y}-${U.pad(m + 1)}-${U.pad(d)}`;
          const cell = map[`${u.id}|${date}`];
          const code = cell?.code || '';
          const tp = typeByCode[code];
          const editable = ACL.can(me, 'editSchedule') || (u.id === me.id && ACL.can(me, 'editOwnShift'));
          html += `<td class="${date === t ? 'is-today-col' : ''}">
            <div class="sched-cell" data-u="${u.id}" data-d="${date}" data-e="${editable ? 1 : 0}"
              style="color:${tp ? colorOf(tp.color) : 'var(--line)'}">${U.esc(code || '·')}</div></td>`;
        }
        html += '</tr>';
      });
      html += '</tbody></table>';
      document.getElementById('grid').innerHTML = html;

      document.getElementById('legend').innerHTML = types.map(tp =>
        `<span class="chip"><span class="badge-dot" style="background:${colorOf(tp.color)}"></span>
         <b class="mono">${U.esc(tp.code)}</b>&nbsp;${U.esc(tp.label)}</span>`).join('');

      document.querySelectorAll('.sched-cell').forEach(el => {
        el.onclick = async () => {
          if (el.dataset.e !== '1') { UI.toast('Немає доступу до цього рядка', true); return; }
          const next = cycle(el.textContent === '·' ? '' : el.textContent.trim());
          const tp = typeByCode[next];
          el.textContent = next || '·';
          el.style.color = tp ? colorOf(tp.color) : 'var(--line)';
          try {
            await Store.upsert('schedule',
              { user_id: el.dataset.u, date: el.dataset.d, code: next },
              ['user_id', 'date']);
          } catch (e) { UI.toast('Не збереглось: ' + e.message, true); }
        };
      });
    };

    document.getElementById('prev').onclick = () => { view.setMonth(view.getMonth() - 1); draw(); };
    document.getElementById('next').onclick = () => { view.setMonth(view.getMonth() + 1); draw(); };
    document.getElementById('today-btn').onclick = () => { view = new Date(); view.setDate(1); draw(); };
    await draw();
  },
});
