// ╔═══════════════════════════════════════════════════════════════╗
// ║  [8/13]  КАСА (виручка, чайові, статистика)                   ║
// ╚═══════════════════════════════════════════════════════════════╝
const Cash = {
  viewUserId: null,
  calYear: null,
  calMonth: null,
  selectedDate: null,
  _saving: false, // захист від гонки poll vs save

  async init() {
    // Каса доступна лише офіціантам та системному адміну
    if (currentUser.role !== 'waiter' && currentUser.role2 !== 'waiter' && !isSysadmin(currentUser)) {
      $('page-cash').innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-dim)">
        <div style="font-size:32px;margin-bottom:12px">🔒</div>
        <div style="font-size:14px;font-weight:700">Доступ закрито</div>
        <div style="font-size:12px;margin-top:6px">Каса доступна лише офіціантам</div>
      </div>`;
      return;
    }
    const n = NOW();
    // Завжди скидаємо до поточного місяця/дати при кожному відкритті
    Cash.calYear     = n.getFullYear();
    Cash.calMonth    = n.getMonth();
    Cash.selectedDate = todayKey();

    if (isSysadmin(currentUser)) {
      Cash.viewUserId = Cash.viewUserId || currentUser.id;
      Cash.renderAdminSelector();
    } else {
      Cash.viewUserId = currentUser.id;
    }
    const viewUser = getUserById(Cash.viewUserId) || currentUser;
    $('cash-user-label').textContent = viewUser.displayName || viewUser.login;

    // Встановити сьогоднішню дату в extra
    const ed = $('extra-date');
    if (ed && !ed.value) ed.value = todayKey();

    // Завантажити дані — тільки якщо не в кеші (вже завантажено при старті)
    const cashDB = DB.get('cash', {});
    const staleTs = DB.get('cash_ts', {});
    const isStale = !staleTs[Cash.viewUserId] || (Date.now() - staleTs[Cash.viewUserId]) > 2 * 60 * 1000;
    if (!cashDB[Cash.viewUserId] || isStale) {
      await Cash.loadUserCash(Cash.viewUserId);
    }
    await Cash.loadExtra(Cash.viewUserId);

    Cash.renderCalendar();
    Cash.renderPeriodBar();
    Cash.loadDayEntry();
  },

  renderCalendar() {
    if (!$('cash-calendar')) return; // DOM перебудовано (не-офіціант відкрив касу раніше)
    const y = Cash.calYear, m = Cash.calMonth;
    $('cal-month-label').textContent = `${MONTHS_UA[m]} ${y}`;
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const entries = Cash.getUserEntries(uid);
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Пн=0
    const todayStr = todayKey();
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

    let html = dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('');

    // Порожні клітинки на початку
    for (let i = 0; i < firstDow; i++) html += `<div class="cal-day empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dk = dateKey(y, m, d);
      const isToday    = dk === todayStr;
      const isSelected = dk === Cash.selectedDate;
      const hasEntry   = !!entries[dk];
      const dow = (new Date(y, m, d).getDay() + 6) % 7;
      const isWeekend  = dow >= 5;
      let cls = 'cal-day';
      if (isSelected) cls += ' selected';
      else if (isToday) cls += ' today';
      if (hasEntry) cls += ' has-entry';
      if (isWeekend && !isSelected) cls += ' other-month';
      html += `<div class="${cls}" onclick="Cash.selectDay('${dk}')">${d}</div>`;
    }

    $('cash-calendar').innerHTML = html;
  },

  selectDay(dk) {
    Cash.selectedDate = dk;
    Cash.renderCalendar();
    Cash.loadDayEntry();
  },

  async resetDay() {
    showConfirm(
      `Скинути запис за ${Cash.selectedDate}? Дані буде видалено, день стане порожнім.`,
      async () => {
        const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
        const cashDB = DB.get('cash', {});
        if (cashDB[uid]) delete cashDB[uid][Cash.selectedDate];
        DB.set('cash', cashDB);
        Cash.renderCalendar();
        Cash.renderPeriodBar();
        Cash.loadDayEntry();
        try {
          // Видалити з Supabase
          await sb.delete('cash', { user_id: uid, date: Cash.selectedDate });
          logEvent('cash', 'Видалено запис каси'); toast('Запис видалено', 'success-t');
        } catch(e) {
          toast('Помилка видалення', 'error');
          console.error(e);
        }
      },
      { okLabel: '🗑 Видалити', okClass: 'btn-danger' }
    );
  },

  renderPeriodBar() {
    if (!$('cash-period-bar-h1')) return;
    // Показуємо періоди для місяця, який зараз обрано в календарі (а не завжди поточного)
    const y = Cash.calYear, mo = Cash.calMonth;
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const entries = Cash.getUserEntries(uid);
    const lastDay = new Date(y, mo + 1, 0).getDate();

    const periods = [
      { key: 'h1', from: new Date(y, mo, 1),      to: new Date(y, mo, 14, 23, 59, 59),      label: `Каса 1–14 ${MONTHS_UA[mo]}` },
      { key: 'h2', from: new Date(y, mo, 15),     to: new Date(y, mo, lastDay, 23, 59, 59), label: `Каса 15–${lastDay} ${MONTHS_UA[mo]}` },
    ];

    periods.forEach(p => {
      let cashSum = 0, workDays = 0;
      Object.entries(entries).forEach(([dk, v]) => {
        const d = parseDateKey(dk);
        if (d >= p.from && d <= p.to) {
          cashSum += (v.cash || 0);
          if ((v.cash || 0) > 0 || (v.tips || 0) > 0) workDays++;
        }
      });
      const earn = cashSum * 0.04 + workDays * 200;
      const labelEl = $(`cash-period-label-${p.key}`);
      const sumEl   = $(`cash-period-sum-${p.key}`);
      const earnEl  = $(`cash-period-earn-${p.key}`);
      if (labelEl) labelEl.textContent = p.label;
      if (sumEl)   sumEl.textContent   = cashSum.toFixed(0) + ' ₴';
      if (earnEl)  earnEl.textContent  = earn.toFixed(0) + ' ₴';
    });
  },

  loadDayEntry() {
    if (!$('cash-input')) return; // DOM перебудовано
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const entries = Cash.getUserEntries(uid);
    const entry = entries[Cash.selectedDate];
    const [y, m, d] = Cash.selectedDate.split('-');
    const day = parseInt(d);
    const halfLabel = day <= 14 ? 'Перша половина' : day === 15 ? '15-те число' : 'Друга половина';
    const halfColor = day <= 15 ? '#7ec8e3' : '#c890e8';
    $('selected-day-label').textContent = `${day} ${MONTHS_UA[parseInt(m)-1]}`;
    $('selected-day-half').innerHTML = `<span style="color:${halfColor}">${halfLabel}</span>`;
    const resetBtn = $('cash-reset-btn');
    if (entry) {
      $('cash-input').value  = entry.cash  || '';
      $('tips-input').value  = entry.tips  || '';
      Cash.preview();
      if (resetBtn) resetBtn.classList.remove('hidden');
    } else {
      $('cash-input').value  = '';
      $('tips-input').value  = '';
      $('calc-preview').classList.add('hidden');
      if (resetBtn) resetBtn.classList.add('hidden');
    }
  },

  switchTab(tab) {
    ['main','extra','stats','cashtop'].forEach(t => {
      const panel = $(`cash-panel-${t}`);
      if (panel) panel.classList.toggle('hidden', t !== tab);
      const tabBtn = $(`cash-tab-${t}`);
      if (tabBtn) tabBtn.classList.toggle('active', t === tab);
    });
    if (tab === 'extra')   Cash.renderExtraList();
    if (tab === 'stats')   { Cash.renderMonthStats(); Cash.renderDetailedStats(); Cash.renderExtraStats(); }
    if (tab === 'cashtop') CashTop.load();
  },

  async saveExtra() {
    const amount = parseFloat($('extra-amount').value)||0;
    const date   = $('extra-date').value;
    const desc   = $('extra-desc').value.trim();
    if (!amount || !date) { toast('Введіть суму і дату', 'error'); return; }
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    try {
      await sb.upsert('extra_wages', { user_id: uid, date, amount, description: desc }, 'user_id,date');
      // Оновити кеш
      const ew = DB.get('extra_wages',{});
      if (!ew[uid]) ew[uid] = {};
      ew[uid][date] = { amount, description: desc };
      DB.set('extra_wages', ew);
      $('extra-amount').value = '';
      $('extra-desc').value = '';
      toast('Збережено!', 'success-t');
      const rb = $('cash-reset-btn');
      if (rb) rb.classList.remove('hidden');
      Cash.renderExtraList();
    } catch(e) { toast('Помилка збереження', 'error'); console.error(e); }
  },

  async loadExtra(uid) {
    const ew = DB.get('extra_wages',{});
    if (ew[uid]) return;
    try {
      const rows = await sb.query('extra_wages', { filter: { user_id: uid } });
      if (!ew[uid]) ew[uid] = {};
      rows.forEach(r => { ew[uid][r.date] = { amount: parseFloat(r.amount), description: r.description||'' }; });
      DB.set('extra_wages', ew);
    } catch(e) { console.error(e); }
  },

  renderExtraList() {
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const ew = DB.get('extra_wages',{})[uid] || {};
    const el = $('extra-list');
    if (!el) return;
    const entries = Object.entries(ew).sort((a,b) => b[0].localeCompare(a[0]));
    if (!entries.length) { el.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Немає записів</p>`; return; }
    el.innerHTML = entries.map(([date, v]) => {
      const [y,m,d] = date.split('-');
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <div>
          <div style="font-size:12px;font-weight:600">${parseInt(d)} ${MONTHS_UA[parseInt(m)-1]} ${y}</div>
          ${v.description ? `<div style="font-size:10px;color:var(--text-dim)">${v.description}</div>` : ''}
        </div>
        <span style="font-size:13px;font-weight:800;color:var(--success)">+${v.amount.toFixed(0)} ₴</span>
      </div>`;
    }).join('');
  },

  renderExtraStats() {
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const ew = DB.get('extra_wages',{})[uid] || {};
    const n = NOW(); const y=n.getFullYear(), mo=n.getMonth();
    const h1s=new Date(y,mo,1),   h1e=new Date(y,mo,14,23,59,59);
    const h2s=new Date(y,mo,15),  h2e=new Date(y,mo+1,0,23,59,59);
    let extra114=0, extra15e=0, extraAll=0;
    Object.entries(ew).forEach(([date,v]) => {
      const d = new Date(date);
      if (d>=h1s&&d<=h1e) extra114 += v.amount||0;
      if (d>=h2s&&d<=h2e) extra15e += v.amount||0;
      extraAll += v.amount||0;
    });
    const el = $('extra-stats-rows');
    if (!el) return;
    el.innerHTML = `
      <div style="background:rgba(126,200,227,.05);border:1px solid rgba(126,200,227,.15);border-radius:10px;padding:12px;margin-bottom:8px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:#7ec8e3">1–14 числа</span>
          <span style="font-size:13px;font-weight:800;color:#7ec8e3">${extra114.toFixed(0)} ₴</span>
        </div>
      </div>
      <div style="background:rgba(200,144,232,.05);border:1px solid rgba(200,144,232,.15);border-radius:10px;padding:12px;margin-bottom:12px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:#c890e8">15 – кінець місяця</span>
          <span style="font-size:13px;font-weight:800;color:#c890e8">${extra15e.toFixed(0)} ₴</span>
        </div>
      </div>
      <div style="background:rgba(212,175,55,.1);border:2px solid rgba(212,175,55,.5);border-radius:12px;padding:16px;box-shadow:0 2px 16px rgba(212,175,55,.08)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:800;color:var(--gold)">За весь час</span>
          <span style="font-size:22px;font-weight:900;color:var(--gold);font-family:'Cormorant Garamond',serif">${extraAll.toFixed(0)} ₴</span>
        </div>
      </div>`;

    Cash.renderTotalSummary(extra114, extra15e, extraAll);
  },

  renderTotalSummary(extra114, extra15e, extraAll) {
    const s = Cash._stats || {};
    const earn114 = (s.earn114 || 0) + extra114;
    const earn15e = (s.earn15e || 0) + extra15e;
    const earnAll = (s.earnAll || 0) + extraAll;
    const tips114 = s.tips114 || 0;
    const tips15e = s.tips15e || 0;
    const tipsAll = s.tipsAll || 0;

    const total114 = earn114 + tips114;
    const total15e = earn15e + tips15e;
    const totalAll = earnAll + tipsAll;

    const sr = (label, val) => Cash.statRow(label, val);
    const el = $('cash-total-rows');
    if (!el) return;
    el.innerHTML = `
      <div style="background:rgba(126,200,227,.05);border:1px solid rgba(126,200,227,.15);border-radius:10px;padding:12px;margin-bottom:8px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:700;color:#7ec8e3">1–14 числа</span>
          <span style="font-size:13px;font-weight:800;color:#7ec8e3">${total114.toFixed(0)} ₴</span>
        </div>
        ${sr('Каса + ставка', earn114.toFixed(0)+' ₴')}
        ${sr('Чайові', tips114.toFixed(0)+' ₴')}
        ${sr('Доп. ставки', extra114.toFixed(0)+' ₴')}
      </div>
      <div style="background:rgba(200,144,232,.05);border:1px solid rgba(200,144,232,.15);border-radius:10px;padding:12px;margin-bottom:12px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:700;color:#c890e8">15 – кінець місяця</span>
          <span style="font-size:13px;font-weight:800;color:#c890e8">${total15e.toFixed(0)} ₴</span>
        </div>
        ${sr('Каса + ставка', earn15e.toFixed(0)+' ₴')}
        ${sr('Чайові', tips15e.toFixed(0)+' ₴')}
        ${sr('Доп. ставки', extra15e.toFixed(0)+' ₴')}
      </div>
      <div style="background:rgba(212,175,55,.1);border:2px solid rgba(212,175,55,.5);border-radius:12px;padding:16px;box-shadow:0 2px 16px rgba(212,175,55,.08)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:13px;font-weight:800;color:var(--gold)">За весь час</span>
          <span style="font-size:22px;font-weight:900;color:var(--gold);font-family:'Cormorant Garamond',serif">${totalAll.toFixed(0)} ₴</span>
        </div>
        ${sr('Каса + ставка', earnAll.toFixed(0)+' ₴')}
        ${sr('Чайові', tipsAll.toFixed(0)+' ₴')}
        ${sr('Доп. ставки', extraAll.toFixed(0)+' ₴')}
      </div>`;
  },

  prevMonth() {
    Cash.calMonth--;
    if (Cash.calMonth < 0) { Cash.calMonth = 11; Cash.calYear--; }
    Cash.renderCalendar();
    Cash.renderPeriodBar();
  },

  nextMonth() {
    Cash.calMonth++;
    if (Cash.calMonth > 11) { Cash.calMonth = 0; Cash.calYear++; }
    Cash.renderCalendar();
    Cash.renderPeriodBar();
  },

  switchUser(uid) {
    Cash.viewUserId = uid;
    const viewUser = getUserById(uid) || currentUser;
    $('cash-user-label').textContent = viewUser.displayName || viewUser.login;
    Cash.renderCalendar();
    Cash.loadDayEntry();
  },

  preview() {
    const raw  = parseFloat($('cash-input').value) || 0;
    const pct  = raw * 0.04;
    const wage = 200;
    const total = pct + wage;
    if (raw > 0) {
      $('calc-pct').textContent  = pct.toFixed(2) + ' ₴';
      $('calc-result').textContent = total.toFixed(2) + ' ₴';
      $('calc-preview').classList.remove('hidden');
    } else {
      $('calc-preview').classList.add('hidden');
    }
  },

  async save() {
    const rawStr = $('cash-input').value.trim();
    const raw  = rawStr === '' ? null : (parseFloat(rawStr) || 0);
    const tips = parseFloat($('tips-input').value) || 0;
    if (raw === null && !tips) { toast('Введіть суму', 'error'); return; }
    return Cash._doSave(raw === null ? 0 : raw, tips);
  },

  async _doSave(cashVal, tips) {
    const saveBtn = document.querySelector('[onclick="Cash.save()"]');
    btnLock(saveBtn);
    Cash._saving = true;
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const cashDB = DB.get('cash',{});
    if (!cashDB[uid]) cashDB[uid] = {};
    const existing = cashDB[uid][Cash.selectedDate];
    const firstCash = (existing && existing.firstCash != null) ? existing.firstCash : cashVal;
    cashDB[uid][Cash.selectedDate] = { cash: cashVal, tips, firstCash };
    DB.set('cash', cashDB);
    Cash.renderCalendar();
    Cash.renderPeriodBar();
    try {
      await sb.upsert('cash', { user_id: uid, date: Cash.selectedDate, cash: cashVal, tips, first_cash: firstCash }, 'user_id,date');
      toast('Збережено!', 'success-t');
      // Оновити рейтинг каси якщо він зараз відкритий
      if (document.getElementById('cash-top-panel')?.style.display !== 'none') {
        CashTop.render();
      }
    } catch(e) {
      toast('Помилка збереження', 'error');
      console.error(e);
    } finally {
      Cash._saving = false;
      btnUnlock(saveBtn);
    }
  },

  async loadUserCash(uid, force = false) {
    const cashDB = DB.get('cash',{});
    const cacheTs = DB.get('cash_ts', {});
    const now = Date.now();
    const stale = !cacheTs[uid] || (now - cacheTs[uid]) > 2 * 60 * 1000; // 2 хв
    // Пропускаємо тільки якщо є свіжі дані і не примусово
    if (!force && cashDB[uid] && Object.keys(cashDB[uid]).length > 0 && !stale) return;
    try {
      const rows = await sb.query('cash', { filter: { user_id: uid } });
      cashDB[uid] = {};
      rows.forEach(r => {
        const c = parseFloat(r.cash)||0, t = parseFloat(r.tips)||0;
        cashDB[uid][r.date] = {
          cash:      c,
          tips:      t,
          firstCash: r.first_cash != null ? parseFloat(r.first_cash) : c,
        };
      });
      DB.set('cash', cashDB);
      cacheTs[uid] = Date.now();
      DB.set('cash_ts', cacheTs);
    } catch(e) { console.error('Cash load error:', e); }
  },

  getUserEntries(userId) {
    const cashDB = DB.get('cash',{});
    return cashDB[userId]||{};
  },

  calcSalary(entries, from, to) {
    let salary=0, tips=0;
    for (const [dk, v] of Object.entries(entries)) {
      const d = parseDateKey(dk);
      if (d>=from && d<=to) {
        salary += (v.cash||0) * 0.04 + 200;  // 4% від каси + ставка
        tips   += v.tips||0;
      }
    }
    return { salary, tips };
  },

  renderMonthStats() {
    // Викликається лише при відкритті вкладки "Статистика"
    // Рендерить секцію "Каса + ставка офіціанта"
    const n = NOW();
    const y = n.getFullYear(), m = n.getMonth();
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const entries = Cash.getUserEntries(uid);

    const h1s  = new Date(y,m,1),          h1e  = new Date(y,m,14,23,59,59);
    const d15s = new Date(y,m,15),          d15e = new Date(y,m,15,23,59,59);
    const h2s  = new Date(y,m,16),          h2e  = new Date(y,m+1,0,23,59,59);
    const allS = new Date(2000,0,1),        allE = new Date(2099,11,31);

    // Сума каси по періодах
    const cash114  = Cash.sumCash(entries, h1s,  h1e);
    const cash15   = Cash.sumCash(entries, d15s, d15e);
    const cash15e  = Cash.sumCash(entries, d15s, h2e);   // 15 до кінця
    const cashAll  = Cash.sumCash(entries, allS, allE);

    // % від каси
    const pct114 = cash114 * 0.04;
    const pct15  = cash15  * 0.04;
    const pct16e = Cash.sumCash(entries, h2s, h2e) * 0.04;
    const pctAll = cashAll * 0.04;

    // Ставки (кількість робочих днів × 200)
    const days114 = Cash.countDays(entries, h1s,  h1e);
    const days15  = Cash.countDays(entries, d15s, d15e);
    const days16e = Cash.countDays(entries, h2s,  h2e);
    const daysAll = Cash.countDays(entries, allS, allE);

    const wage114 = days114 * 200;
    const wage15  = days15  * 200;
    const wage16e = days16e * 200;
    const wageAll = daysAll * 200;

    // Підсумки по виплатах
    const earn114 = pct114 + wage114;                  // 1–14: % + ставка
    const earn15e = pct15  + pct16e + wage15 + wage16e; // 15–кін: % + ставка
    const earnAll = pctAll + wageAll;

    const statRow = Cash.statRow.bind(Cash);

    $('cash-stats-rows').innerHTML = `
      <div style="background:rgba(126,200,227,.05);border:1px solid rgba(126,200,227,.15);border-radius:10px;padding:12px;margin-bottom:8px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:11px;font-weight:700;color:#7ec8e3">1–14 числа</span>
          <span style="font-size:13px;font-weight:800;color:#7ec8e3">${earn114.toFixed(0)} ₴</span>
        </div>
        ${statRow('Каса', cash114.toFixed(0)+' ₴')}
        ${statRow('4% від каси', pct114.toFixed(0)+' ₴')}
        ${statRow('Ставка ('+days114+' р × 200 ₴)', wage114.toFixed(0)+' ₴')}
      </div>
      <div style="background:rgba(200,144,232,.05);border:1px solid rgba(200,144,232,.15);border-radius:10px;padding:12px;margin-bottom:12px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:11px;font-weight:700;color:#c890e8">15 – кінець місяця</span>
          <span style="font-size:13px;font-weight:800;color:#c890e8">${earn15e.toFixed(0)} ₴</span>
        </div>
        ${statRow('Каса', cash15e.toFixed(0)+' ₴')}
        ${statRow('4% від каси', (pct15+pct16e).toFixed(0)+' ₴')}
        ${statRow('Ставка ('+(days15+days16e)+' р × 200 ₴)', (wage15+wage16e).toFixed(0)+' ₴')}
      </div>
      <div style="background:rgba(212,175,55,.1);border:2px solid rgba(212,175,55,.5);border-radius:12px;padding:16px;box-shadow:0 2px 16px rgba(212,175,55,.08)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:13px;font-weight:800;color:var(--gold)">За весь час</span>
          <span style="font-size:22px;font-weight:900;color:var(--gold);font-family:'Cormorant Garamond',serif">${earnAll.toFixed(0)} ₴</span>
        </div>
        ${statRow('Загальна каса', cashAll.toFixed(0)+' ₴')}
        ${statRow('4% від каси', pctAll.toFixed(0)+' ₴')}
        ${statRow('Ставка ('+daysAll+' р × 200 ₴)', wageAll.toFixed(0)+' ₴')}
      </div>`;

    // Зберігаємо підрахунки для загального підсумку
    Cash._stats = { earn114, earn15e, earnAll, pct114, pct15, pct16e, pctAll, wage114, wage15, wage16e, wageAll, cash114, cash15e, cashAll };
  },

  statRow(label, val) {
    return `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px">
      <span style="color:var(--text-dim)">${label}</span>
      <span style="color:var(--text)">${val}</span>
    </div>`;
  },

  bigStatRow(label, val) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <span style="font-size:12px;color:var(--text-dim)">${label}</span>
      <span style="font-size:13px;font-weight:700;color:var(--text)">${val}</span>
    </div>`;
  },

  sumCash(entries, from, to) {
    return Object.entries(entries).filter(([dk])=>{ const d=parseDateKey(dk); return d>=from&&d<=to; })
           .reduce((s,[,v])=>s+(v.cash||0), 0);
  },

  countDays(entries, from, to) {
    return Object.entries(entries).filter(([dk,v])=>{ const d=parseDateKey(dk); return d>=from&&d<=to&&(v.cash||0)>0; }).length;
  },

  renderDetailedStats() {
    // Рендерить секцію "Чайові" у вкладці Статистика
    const n = NOW();
    const y = n.getFullYear(), m = n.getMonth();
    const uid = (isAdmin(currentUser) && Cash.viewUserId) ? Cash.viewUserId : currentUser.id;
    const entries = Cash.getUserEntries(uid);

    const h1s  = new Date(y,m,1),   h1e  = new Date(y,m,14,23,59,59);
    const h2s  = new Date(y,m,15),  h2e  = new Date(y,m+1,0,23,59,59);
    const allS = new Date(2000,0,1), allE = new Date(2099,11,31);

    let tips114=0, tips15e=0, tipsAll=0;
    for (const [dk,v] of Object.entries(entries)) {
      const d = parseDateKey(dk);
      if (d>=h1s && d<=h1e)  tips114 += v.tips||0;
      if (d>=h2s && d<=h2e)  tips15e += v.tips||0;
      tipsAll += v.tips||0;
    }

    const statRow = Cash.statRow.bind(Cash);

    $('cash-tips-rows').innerHTML = `
      <div style="background:rgba(126,200,227,.05);border:1px solid rgba(126,200,227,.15);border-radius:10px;padding:12px;margin-bottom:8px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:#7ec8e3">1–14 числа</span>
          <span style="font-size:13px;font-weight:800;color:#7ec8e3">${tips114.toFixed(0)} ₴</span>
        </div>
      </div>
      <div style="background:rgba(200,144,232,.05);border:1px solid rgba(200,144,232,.15);border-radius:10px;padding:12px;margin-bottom:12px;opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:#c890e8">15 – кінець місяця</span>
          <span style="font-size:13px;font-weight:800;color:#c890e8">${tips15e.toFixed(0)} ₴</span>
        </div>
      </div>
      <div style="background:rgba(212,175,55,.1);border:2px solid rgba(212,175,55,.5);border-radius:12px;padding:16px;box-shadow:0 2px 16px rgba(212,175,55,.08)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:800;color:var(--gold)">За весь час</span>
          <span style="font-size:22px;font-weight:900;color:var(--gold);font-family:'Cormorant Garamond',serif">${tipsAll.toFixed(0)} ₴</span>
        </div>
      </div>`;

    // Зберігаємо для загального підсумку
    if (!Cash._stats) Cash._stats = {};
    Cash._stats.tips114 = tips114;
    Cash._stats.tips15e = tips15e;
    Cash._stats.tipsAll = tipsAll;
  },

  renderAdminSelector() {
    const waiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');
    const wrap = $('cash-admin-selector-wrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <label class="lbl">Переглядати касу</label>
      <select id="cash-admin-selector" class="field" onchange="Cash.switchUser(this.value)">
        <option value="${currentUser.id}">— Своя каса (${currentUser.displayName||currentUser.login}) —</option>
        ${waiters.map(u=>`<option value="${esc(u.id)}" ${u.id===Cash.viewUserId?'selected':''}>${esc(u.displayName||u.login)}</option>`).join('')}
      </select>`;
  },

}; // ── end Cash ──

// ╔═══════════════════════════════════════════════════════════════╗
// ║  ТОП КАСИ (перенесено з рейтингу)                             ║
// ╚═══════════════════════════════════════════════════════════════╝
const CashTopState = {
  period: 'h1',
  month:  new Date().getMonth(),
  year:   new Date().getFullYear(),
};

const CashTop = {
  async init() {
    CashTop.setPeriod(CashTopState.period);
  },

  setPeriod(period) {
    CashTopState.period = period;
    document.querySelectorAll('#cash-top-period-tabs .rating-tab').forEach((b,i)=>{
      b.classList.toggle('active', ['h1','h2','month','year'][i] === period);
    });
    const isYear = period === 'year';
    const monthNav = $('cash-top-month-nav');
    const yearNav  = $('cash-top-year-nav');
    if (monthNav) { monthNav.classList.remove('hidden'); monthNav.style.display = isYear ? 'none' : 'flex'; }
    if (yearNav)  { yearNav.classList.remove('hidden');  yearNav.style.display  = isYear ? 'flex' : 'none'; }
    CashTop.render();
  },

  shiftMonth(delta) {
    CashTopState.month += delta;
    if (CashTopState.month < 0)  { CashTopState.month = 11; CashTopState.year--; }
    if (CashTopState.month > 11) { CashTopState.month = 0;  CashTopState.year++; }
    CashTop.render();
  },

  shiftYear(delta) {
    CashTopState.year += delta;
    CashTop.render();
  },

  async load() {
    const waiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');
    const listEl = $('cash-top-list');
    if (listEl) listEl.innerHTML = `<p class="muted" style="text-align:center;padding:20px">⏳ Завантаження...</p>`;
    await Promise.all(waiters.map(u => Cash.loadUserCash(u.id, true)));
    CashTop.render();
  },

  render() {
    const { period, month: m, year: y } = CashTopState;
    const cashDB = DB.get('cash', {});
    const waiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');

    let from, to, periodLabel, cardTitle;
    if (period === 'h1') {
      from = new Date(y, m, 1);
      to   = new Date(y, m, 14, 23, 59, 59);
      periodLabel = `${MONTHS_UA[m]} ${y}`;
      cardTitle   = `Топ каси · 1–14 ${MONTHS_UA[m]}`;
    } else if (period === 'h2') {
      from = new Date(y, m, 15);
      to   = new Date(y, m + 1, 0, 23, 59, 59);
      periodLabel = `${MONTHS_UA[m]} ${y}`;
      cardTitle   = `Топ каси · 15–${new Date(y, m+1, 0).getDate()} ${MONTHS_UA[m]}`;
    } else if (period === 'month') {
      from = new Date(y, m, 1);
      to   = new Date(y, m + 1, 0, 23, 59, 59);
      periodLabel = `${MONTHS_UA[m]} ${y}`;
      cardTitle   = `Топ каси · ${MONTHS_UA[m]} ${y}`;
    } else {
      from = new Date(y, 0, 1);
      to   = new Date(y, 11, 31, 23, 59, 59);
      cardTitle = `Топ каси · ${y} рік`;
    }

    const monthLabel = $('cash-top-month-label');
    const yearLabel  = $('cash-top-year-label');
    if (monthLabel) monthLabel.textContent = periodLabel || '';
    if (yearLabel)  yearLabel.textContent  = String(y);

    const titleEl = $('cash-top-card-title');
    if (titleEl) titleEl.textContent = cardTitle;

    const ranked = waiters.map(u => {
      const entries = cashDB[u.id] || {};
      const total = Object.entries(entries)
        .filter(([dk]) => { const d = parseDateKey(dk); return d >= from && d <= to; })
        .reduce((sum, [, v]) => {
          const val = (v.firstCash != null) ? v.firstCash : (parseFloat(v.cash) || 0);
          return sum + val;
        }, 0);
      return { u, total };
    }).sort((a, b) => b.total - a.total);

    const maxTotal = ranked[0]?.total || 1;
    const medals = ['🥇','🥈','🥉'];
    const list = $('cash-top-list');
    if (!list) return;

    if (!ranked.length || ranked.every(r => r.total === 0)) {
      list.innerHTML = `<p class="muted" style="text-align:center;padding:20px">Немає даних за цей період</p>`;
      return;
    }

    list.innerHTML = ranked.map(({ u, total }, i) => {
      const barW = maxTotal > 0 ? (total / maxTotal * 100).toFixed(1) : 0;
      const medal = medals[i] || `<span style="font-size:12px;color:var(--text-dim)">#${i+1}</span>`;
      const isLeader = i === 0 && total > 0;
      return `<div style="padding:12px;background:rgba(0,0,0,${isLeader?'.3':'.15'});border:1px solid ${isLeader?'var(--gold-border)':'rgba(255,255,255,.06)'};border-radius:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:${i<3?'20':'13'}px;width:24px;text-align:center;flex-shrink:0">${medal}</span>
          ${avatarHTML(u, 36, 13)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px">${u.displayName||u.login}${u.nick?` <span style="font-size:11px;color:var(--text-dim)">(${u.nick})</span>`:''}</div>
            <div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;margin-top:6px;overflow:hidden">
              <div style="height:100%;width:${barW}%;background:${isLeader?'var(--gold)':'rgba(255,255,255,.25)'};border-radius:3px;transition:width .4s"></div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  },
};

