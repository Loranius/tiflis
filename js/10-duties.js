// ╔═══════════════════════════════════════════════════════════════╗
// ║  [11/13] ОБОВ'ЯЗКИ (здача зміни + щоденні обов'язки)          ║
// ╚═══════════════════════════════════════════════════════════════╝

// Списки обов'язків з docx файлів
const HANDOVER_DUTIES = [
  'Комора, двоє дверей на чорному ході',
  'R-keeper, біля нього, полки під графінами і шампанками (на всіх позиціях)',
  'Розноси, планшетки',
  'Спецовниці зал/каб, літня тер., камінний',
  'Підвіконня, вхідні двері. Вікна на хостесі, дзеркало, Дивани і тумбочки в холі (з усіх сторін). Перило, перегородки в залі',
  'Всі полиці в залі і все, що на них є, плафони, колонки, стільці в залі',
  'Дровери (3 шт)',
  'Балки, люстри',
  'Камінний зал (стільці, пилюка, люстри, тв., вікна)',
  'Новий зал (колонки, сабвуфери, плафони, стільці, спецовниці…)',
  'Павутиння: зал, вулиця-вхід, коридори',
  'Кабінки: коридор, плазми, дровери, стільці, підвіконня',
  'Раковина на барі + робоче місце на барі',
  'Відра для льоду та шампанського, полиці під ними',
  'Їдальня, хлібний столик зверху і всередині, холодил.',
  'Дитяча кімната',
  'Літня тераса',
];

const DAILY_DUTIES = [
  'Прибирання залу (парапети, підвіконня, тумби, столешні, тумба з вином, дзеркало)',
  'Камінний зал, двері на літню терасу',
  'Узвар, лимонад, хліб, хлібний столик, їдальня',
  'Хол. з узваром бар, Кондитерський холодильник, з морозивом, з соусами',
  'Розкладання скатерок',
  'Кабінки, комора',
  'Сети',
  'Дровер на 3-й поз. (чистота і фраже)',
  'Новий зал (столи, стільці, спецовниці)',
  'Прибирання літньої тераси',
  'Полив квітів',
];

const DAILY_ZONES = [
  'Загальний зал',
  'Кабінки',
  'Нижній зал 2',
  'Нижній зал 3',
  'Камінний зал',
  'Літня тераса',
];

const Duties = {
  // Стан стрипів { handover: {centerDate, selectedDate}, daily: {centerDate, selectedDate} }
  _strip: {},
  STRIP_VISIBLE: 7, // скільки днів показувати

  _initStrip(type) {
    if (Duties._strip[type]) return;
    const n = NOW();
    const base = new Date(n);
    if (type === 'handover') {
      // Завжди наступний вівторок (якщо сьогодні вівторок — беремо +7)
      const dow = base.getDay(); // 0=нд,1=пн,2=вт,...
      const daysUntilTue = dow < 2 ? 2 - dow : 9 - dow; // до наступного вт
      base.setDate(base.getDate() + daysUntilTue);
    }
    let dk = dateKey(base.getFullYear(), base.getMonth(), base.getDate());

    Duties._strip[type] = { centerDate: new Date(base), selectedDate: dk };
  },

  stripPrev(type) {
    Duties._initStrip(type);
    Duties._strip[type].centerDate.setDate(Duties._strip[type].centerDate.getDate() - Duties.STRIP_VISIBLE);
    Duties.renderStrip(type);
  },

  stripNext(type) {
    Duties._initStrip(type);
    Duties._strip[type].centerDate.setDate(Duties._strip[type].centerDate.getDate() + Duties.STRIP_VISIBLE);
    Duties.renderStrip(type);
  },

  stripSelect(type, isoDate) {
    Duties._initStrip(type);
    Duties._strip[type].selectedDate = isoDate;
    Duties.renderStrip(type);
    Duties.initFromCal(type);
  },

  renderStrip(type) {
    Duties._initStrip(type);
    const st = Duties._strip[type];
    const todayStr = todayKey();
    const DOW_UK = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
    const MON_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
    const container = $(`${type}-strip-days`);

    if (type === 'handover') {
      // Тільки вівторки — показуємо 8 вівторків відносно centerDate (4 до + 4 після)
      const tuesdays = [];
      const base = new Date(st.centerDate);
      // Знаходимо найближчий вівторок <= base
      const daysBack = (base.getDay() + 7 - 2) % 7; // 2 = вівторок
      const firstTue = new Date(base);
      firstTue.setDate(firstTue.getDate() - daysBack - 3 * 7); // 3 тижні назад
      // Нормалізуємо до вівторка
      while (firstTue.getDay() !== 2) firstTue.setDate(firstTue.getDate() + 1);
      for (let i = 0; i < 8; i++) {
        const d = new Date(firstTue);
        d.setDate(d.getDate() + i * 7);
        tuesdays.push(d);
      }
      let html = '';
      tuesdays.forEach(d => {
        const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        const isToday = dk === todayStr;
        const isSel = dk === st.selectedDate;
        const hasData = Object.keys(DB.get(`duties_handover_${dk}`, {})).length > 0;
        // TTL: handover зберігається 1 день з published_at
        const pubRaw = DB.get(`duties_handover_pub_${dk}`);
        const isExpired = pubRaw && (Date.now() - pubRaw > 24*60*60*1000);
        let cls = 'duties-strip-day';
        if (isToday) cls += ' today';
        if (isSel) cls += ' selected';
        html += `<div class="${cls}" onclick="Duties.stripSelect('${type}','${dk}')">
          <span class="ds-dow">Вт</span>
          <span class="ds-num">${d.getDate()}</span>
          <span class="ds-mon">${MON_SHORT[d.getMonth()]}</span>
          ${hasData && !isExpired ? '<span style="font-size:8px;color:var(--success)">●</span>' : ''}
          ${isExpired ? '<span style="font-size:8px;color:var(--danger)">✕</span>' : ''}
        </div>`;
      });
      container.innerHTML = html;
    } else {
      // daily — звичайний стрип 7 днів + TTL індикатор (3 дні)
      const ONE_DAY = 24*60*60*1000;
      const base = new Date(st.centerDate);
      base.setDate(base.getDate() - Math.floor(Duties.STRIP_VISIBLE / 2));
      let html = '';
      for (let i = 0; i < Duties.STRIP_VISIBLE; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        const isToday = dk === todayStr;
        const isSel = dk === st.selectedDate;
        let cls = 'duties-strip-day';
        if (isToday) cls += ' today';
        if (isSel) cls += ' selected';
        const hasData = Object.keys(DB.get(`duties_daily_${dk}`, {})).length > 0;
        html += `<div class="${cls}" onclick="Duties.stripSelect('${type}','${dk}')">
          <span class="ds-dow">${DOW_UK[d.getDay()]}</span>
          <span class="ds-num">${d.getDate()}</span>
          <span class="ds-mon">${MON_SHORT[d.getMonth()]}</span>
          ${hasData ? '<span style="font-size:8px;color:var(--success)">●</span>' : ''}
        </div>`;
      }
      container.innerHTML = html;
    }
  },

  // Зворотна сумісність — рендер = стрип
  renderCal(type) { Duties.renderStrip(type); },

  // Повертає ключ вибраної дати
  _selectedDateKey(type) {
    Duties._initStrip(type);
    return Duties._strip[type].selectedDate;
  },

  // Повертає список офіціантів, що мають робочу зміну на вказану дату.
  // Порожнє поле = не вказано = не показуємо. Тільки явна позначка зміни (не Х, не О, не С).
  // 'С' = зміна сомельє — в цей день офіціант не бере обов'язки/здачу зміни.
  // Враховує role2 — якщо у користувача додаткова роль waiter, він також включається.
  _workingWaiters(dateStr) {
    const schedule = DB.get('schedule', {});
    const OFF_SHIFTS = new Set(['Х', 'О', 'С']);
    return getUsers().filter(u => {
      if (u.role !== 'waiter' && u.role2 !== 'waiter') return false;
      const shift = schedule[`${u.id}_${dateStr}`];
      if (!shift || shift.trim() === '') return false;
      return !OFF_SHIFTS.has(shift);
    });
  },

  // Рендерить обов'язки для вибраної дати з календаря
  initFromCal(type) {
    const selKey = Duties._selectedDateKey(type);
    // selKey = 'YYYY-MM-DD'
    const [y, m, d] = selKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dateStr = `${d} ${MONTHS_UA[m - 1]} ${y}`;
    const storageKey = `duties_${type}_${selKey}`;
    const workingWaiters = Duties._workingWaiters(selKey);

    const shiftHint = `працює: <b style="color:var(--gold)">${workingWaiters.length}</b> офіц.`;

    if (type === 'handover') {
      $('handover-date-label').textContent = dateStr;
      Duties.render('handover', HANDOVER_DUTIES, storageKey, workingWaiters, selKey);
      Duties.renderTTLBanner('handover', selKey);
      const sa = $('handover-actions');
      sa.innerHTML = isAdmin(currentUser)
        ? `<span style="font-size:11px;color:var(--text-dim);margin-right:8px">📅 ${shiftHint}</span>
           <button class="btn btn-gold btn-sm" onclick="Duties.sendTg('handover','${storageKey}')">📨 Надіслати</button>
           <button class="btn btn-ghost btn-sm" onclick="Duties.clear('handover','${storageKey}')">Очистити</button>`
        : '';
    } else {
      $('daily-date-label').textContent = dateStr;
      Duties.render('daily', DAILY_DUTIES, storageKey, workingWaiters, selKey);
      const zonesKey = `duties_daily_zones_${selKey}`;
      Duties.renderZones(zonesKey, workingWaiters, selKey);
      Duties.renderTTLBanner('daily', selKey);
      const sa = $('daily-actions');
      sa.innerHTML = isAdmin(currentUser)
        ? `<span style="font-size:11px;color:var(--text-dim);margin-right:8px">📅 ${shiftHint}</span>
           <button class="btn btn-gold btn-sm" onclick="Duties.sendTg('daily','${storageKey}')">📨 Надіслати</button>
           <button class="btn btn-ghost btn-sm" onclick="Duties.clear('daily','${storageKey}')">Очистити</button>`
        : '';
    }
  },

  init(type) {
    // Скидаємо кеш щоразу при відкритті — щоб дата перераховувалась
    delete Duties._strip[type];
    Duties._initStrip(type);
    Duties.renderStrip(type);
    Duties.initFromCal(type);
  },

  render(type, duties, storageKey, workingWaiters, scheduleDateKey) {
    const saved = DB.get(storageKey, {});
    const schedDateKey = scheduleDateKey || Duties._selectedDateKey(type);
    const schedule = DB.get('schedule', {});
    const OFF_SHIFTS = new Set(['Х', 'О', 'С']);
    const allWaiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');
    const waiters = allWaiters.filter(u => {
      const shift = schedule[`${u.id}_${schedDateKey}`];
      return shift && shift.trim() !== '' && !OFF_SHIFTS.has(shift);
    });
    const canEdit = isAdmin(currentUser);
    const workingIds = new Set(waiters.map(w => w.id));
    const MAX_SLOTS = type === 'handover' ? 16 : 2;

    // Будує рядок чіпів + кнопку +
    const chipRow = (assignedIds, idx, dataType, dataKey, maxSlots, isHandover) => {
      const chips = assignedIds.map(uid => {
        const w = allWaiters.find(w => w.id === uid);
        if (!w) return '';
        const shift = schedule[`${w.id}_${schedDateKey}`] || '';
        const nm = (w.displayName || w.login) + (shift ? ` · ${shift}` : '');
        const isOff = !workingIds.has(uid);
        const chipStyle = isOff
          ? 'background:rgba(224,90,90,.18);border-color:rgba(224,90,90,.4);color:var(--danger)'
          : 'background:var(--gold-dim);border-color:var(--gold-border);color:var(--gold)';
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 10px;border-radius:20px;border:1px solid;font-size:11px;font-weight:600;${chipStyle}">
          ${nm}
          <button onclick="Duties.removeAssigned('${dataKey}','${idx}','${uid}')" style="background:none;border:none;cursor:pointer;padding:0;line-height:1;color:inherit;opacity:.7;font-size:13px" title="Зняти">×</button>
        </span>`;
      }).filter(Boolean).join(' ');

      const canAdd = assignedIds.length < maxSlots;
      const addBtn = canAdd ? `<button
          onclick="Duties.openWaiterPicker(this,'${dataKey}','${idx}','${dataType}'${isHandover ? ",true" : ""})"
          style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:20px;border:1px dashed rgba(212,175,55,.35);background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer;font-family:Montserrat,sans-serif">
          ＋
        </button>` : '';

      const empty = !assignedIds.length
        ? `<span style="color:var(--text-muted);font-size:11px">— не призначено —</span> `
        : '';

      return `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${empty}${chips}${addBtn}</div>`;
    };

    let html = '<tbody>';
    duties.forEach((duty, i) => {
      const rawSaved = saved[String(i)] !== undefined ? saved[String(i)] : saved[i];
      const assignedIds = Array.isArray(rawSaved) ? rawSaved.filter(Boolean) : (rawSaved ? [rawSaved] : []);
      const isHandover = type === 'handover';

      if (canEdit) {
        html += `<tr>
          <td style="padding:8px 10px;vertical-align:middle;font-size:12px">${duty}</td>
          <td style="padding:6px 8px;vertical-align:middle" id="duty-cell-${Duties._dtSafe(type)}-${i}">
            ${chipRow(assignedIds, i, type, storageKey, MAX_SLOTS, isHandover)}
          </td>
        </tr>`;
      } else {
        const names = assignedIds.map(uid => {
          const w = allWaiters.find(w => w.id === uid);
          if (!w) return '';
          const isOff = !workingIds.has(w.id);
          const shift = schedule[`${w.id}_${schedDateKey}`] || '';
          const nm = (w.displayName || w.login) + (shift ? ` · ${shift}` : '');
          const st = isOff ? 'color:var(--danger);font-weight:700;opacity:.7' : 'color:var(--gold);font-weight:700';
          return `<span style="${st}">${nm}</span>`;
        }).filter(Boolean);
        html += `<tr>
          <td style="padding:8px 10px;vertical-align:middle;font-size:12px">${duty}</td>
          <td style="padding:8px 10px;vertical-align:middle">${names.length ? names.join(' · ') : '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
        </tr>`;
      }
    });

    html += '</tbody>';
    $(`${type==='handover'?'handover':'daily'}-table`).innerHTML = html;
  },

  renderZones(zonesKey, workingWaiters, scheduleDateKey) {
    const saved = DB.get(zonesKey, {});
    const schedule = DB.get('schedule', {});
    const OFF_SHIFTS = new Set(['Х', 'О', 'С']);
    const allWaiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');
    const waiters = allWaiters.filter(u => {
      const shift = schedule[`${u.id}_${scheduleDateKey}`];
      return shift && shift.trim() !== '' && !OFF_SHIFTS.has(shift);
    });
    const workingIds = new Set(waiters.map(w => w.id));
    const canEdit = isAdmin(currentUser);
    const MAX_SLOTS = 4;

    const chipRow = (assignedIds, idx) => {
      const chips = assignedIds.map(uid => {
        const w = allWaiters.find(w => w.id === uid);
        if (!w) return '';
        const shift = schedule[`${w.id}_${scheduleDateKey}`] || '';
        const nm = (w.displayName || w.login) + (shift ? ` · ${shift}` : '');
        const isOff = !workingIds.has(uid);
        const chipStyle = isOff
          ? 'background:rgba(224,90,90,.18);border-color:rgba(224,90,90,.4);color:var(--danger)'
          : 'background:var(--gold-dim);border-color:var(--gold-border);color:var(--gold)';
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 10px;border-radius:20px;border:1px solid;font-size:11px;font-weight:600;${chipStyle}">
          ${nm}
          <button onclick="Duties.removeAssigned('${zonesKey}','${idx}','${uid}')" style="background:none;border:none;cursor:pointer;padding:0;line-height:1;color:inherit;opacity:.7;font-size:13px" title="Зняти">×</button>
        </span>`;
      }).filter(Boolean).join(' ');
      const canAdd = assignedIds.length < MAX_SLOTS;
      const addBtn = canAdd ? `<button
          onclick="Duties.openWaiterPicker(this,'${zonesKey}','${idx}','daily-zones')"
          style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:20px;border:1px dashed rgba(212,175,55,.35);background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer;font-family:Montserrat,sans-serif">
          ＋
        </button>` : '';
      const empty = !assignedIds.length ? `<span style="color:var(--text-muted);font-size:11px">— </span> ` : '';
      return `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${empty}${chips}${addBtn}</div>`;
    };

    let html = '<tbody>';
    DAILY_ZONES.forEach((zone, i) => {
      const rawSaved = saved[String(i)] !== undefined ? saved[String(i)] : saved[i];
      const assignedIds = Array.isArray(rawSaved) ? rawSaved.filter(Boolean) : (rawSaved ? [rawSaved] : []);
      if (canEdit) {
        html += `<tr>
          <td style="padding:8px 10px;vertical-align:middle;font-size:12px">${zone}</td>
          <td style="padding:6px 8px;vertical-align:middle">${chipRow(assignedIds, i)}</td>
        </tr>`;
      } else {
        const names = assignedIds.map(uid => {
          const w = allWaiters.find(w => w.id === uid);
          if (!w) return '';
          const isOff = !workingIds.has(w.id);
          const shift = schedule[`${w.id}_${scheduleDateKey}`] || '';
          const nm = (w.displayName || w.login) + (shift ? ` · ${shift}` : '');
          const st = isOff ? 'color:var(--danger);font-weight:700;opacity:.7' : 'color:var(--gold);font-weight:700';
          return `<span style="${st}">${nm}</span>`;
        }).filter(Boolean);
        html += `<tr>
          <td style="padding:8px 10px;vertical-align:middle;font-size:12px">${zone}</td>
          <td style="padding:8px 10px;vertical-align:middle">${names.length ? names.join(' · ') : '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
        </tr>`;
      }
    });

    html += '</tbody>';
    $('daily-zones-table').innerHTML = html;
  },

  // Допоміжна — безпечний id для атрибутів
  _dtSafe: t => t.replace(/[^a-z0-9]/gi, '_'),

  // ── Видалити конкретного офіціанта з обов'язку/зони ──────────────
  removeAssigned(key, idx, uid) {
    const saved = DB.get(key, {});
    const idxKey = String(idx);
    const raw = saved[idxKey] !== undefined ? saved[idxKey] : saved[Number(idx)];
    const arr = Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [raw] : []);
    saved[idxKey] = arr.filter(id => id !== uid);
    // Прибираємо числовий дублікат якщо є
    if (saved[Number(idx)] !== undefined) delete saved[Number(idx)];
    DB.set(key, saved);
    // Визначаємо тип і перерендеримо одразу з локального DB
    if (key.startsWith('duties_daily_zones_')) {
      const selKey = Duties._selectedDateKey('daily');
      Duties._rerenderFromDB('daily-zones', key, selKey);
    } else {
      const t = key.startsWith('duties_handover_') ? 'handover' : 'daily';
      const selKey = Duties._selectedDateKey(t);
      Duties._rerenderFromDB(t, key, selKey);
    }
    Duties._scheduleAutosave(key);
  },

  // ── Відкрити компактний пікер офіціанта (попап-список) ───────────
  openWaiterPicker(btn, key, idx, dataType, isHandover) {
    // Закрити попередній якщо є
    document.querySelector('.duty-waiter-picker')?.remove();

    const schedKey = key.replace(/^duties_(daily_zones_|handover_|daily_)/, '');
    const schedule = DB.get('schedule', {});
    const OFF_SHIFTS = new Set(['Х', 'О', 'С']);
    const allWaiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');
    let waiters = allWaiters.filter(u => {
      const shift = schedule[`${u.id}_${schedKey}`];
      return shift && shift.trim() !== '' && !OFF_SHIFTS.has(shift);
    });
    // Якщо розклад не заповнений — показуємо всіх офіціантів
    if (!waiters.length) waiters = allWaiters;

    const saved = DB.get(key, {});
    const raw = saved[idx];
    const assigned = new Set(Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [raw] : []));

    const picker = document.createElement('div');
    picker.className = 'duty-waiter-picker';
    picker.style.cssText = [
      'position:fixed;z-index:9999',
      'background:#1a3d36',
      'border:1px solid rgba(212,175,55,.35)',
      'border-radius:10px',
      'box-shadow:0 8px 32px rgba(0,0,0,.55)',
      'min-width:200px',
      'max-height:320px',
      'overflow-y:auto',
      'padding:6px 0',
      'font-family:Montserrat,sans-serif',
    ].join(';');

    // Опція "Всі на зміні" для handover
    if (isHandover) {
      const allBtn = document.createElement('div');
      allBtn.style.cssText = 'padding:9px 14px;font-size:12px;font-weight:700;cursor:pointer;color:var(--gold);border-bottom:1px solid rgba(212,175,55,.15);display:flex;align-items:center;gap:8px';
      allBtn.innerHTML = '👥 Всі на зміні';
      allBtn.onmouseenter = () => allBtn.style.background = 'rgba(212,175,55,.1)';
      allBtn.onmouseleave = () => allBtn.style.background = '';
      allBtn.onclick = () => {
        const allIds = waiters.map(w => w.id);
        const saved2 = DB.get(key, {});
        saved2[String(idx)] = allIds;
        DB.set(key, saved2);
        picker.remove();
        const selKey = Duties._selectedDateKey('handover');
        Duties._rerenderFromDB('handover', key, selKey);
      };
      picker.appendChild(allBtn);
    }

    waiters.forEach(w => {
      const isAssigned = assigned.has(w.id);
      const row = document.createElement('div');
      const shiftVal = schedule[`${w.id}_${schedKey}`] || '';
      const nm = (w.displayName || w.login) + (w.nick ? ` (${w.nick})` : '') + (shiftVal ? ` [${shiftVal}]` : '');
      row.style.cssText = `padding:9px 14px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;${isAssigned ? 'color:var(--gold);font-weight:600' : 'color:var(--text)'}`;
      row.innerHTML = `<span>${nm}</span>${isAssigned ? '<span style="font-size:14px">✓</span>' : ''}`;
      row.onmouseenter = () => row.style.background = 'rgba(255,255,255,.06)';
      row.onmouseleave = () => row.style.background = '';
      row.onclick = () => {
        const s2raw = DB.get(key, {});
        // Захист від старого кешу де r.data зберігався як рядок
        const s2 = (s2raw && typeof s2raw === 'object' && !Array.isArray(s2raw)) ? s2raw : {};
        // idx може бути рядком або числом — нормалізуємо
        const idxKey = String(idx);
        const r2 = s2[idxKey] !== undefined ? s2[idxKey] : s2[Number(idx)];
        let arr2 = Array.isArray(r2) ? [...r2.filter(Boolean)] : (r2 ? [r2] : []);
        // Перечитуємо стан прямо зараз (не з замикання)
        const nowAssigned = arr2.includes(w.id);
        if (nowAssigned) {
          arr2 = arr2.filter(id => id !== w.id);
        } else {
          arr2.push(w.id);
        }
        s2[idxKey] = arr2;
        // Видаляємо старий числовий ключ якщо є
        if (s2[Number(idx)] !== undefined && idxKey !== String(Number(idx))) delete s2[Number(idx)];
        DB.set(key, s2);
        picker.remove();
        // Перерендер одразу з локального DB (без очікування Supabase)
        if (dataType === 'daily-zones') {
          const sk = Duties._selectedDateKey('daily');
          Duties._rerenderFromDB('daily-zones', key, sk);
        } else {
          const sk = Duties._selectedDateKey(dataType);
          Duties._rerenderFromDB(dataType, key, sk);
        }
        // Зберегти в Supabase (з дебаунсом)
        Duties._scheduleAutosave(key);
      };
      picker.appendChild(row);
    });

    document.body.appendChild(picker);

    // Позиціонування
    const rect = btn.getBoundingClientRect();
    let top  = rect.bottom + 4;
    let left = rect.left;
    const pw = 220;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + 300 > window.innerHeight - 8) top = rect.top - Math.min(300, top) - 4;
    picker.style.left = left + 'px';
    picker.style.top  = top + 'px';

    // Закрити при кліку поза
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!picker.contains(e.target) && e.target !== btn) {
          picker.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 0);
  },

  _scheduleAutosave(key) {
    // Одразу позначаємо локальний час зміни — poll ігноруватиме старіші дані
    Duties._savingKeys.add(key);
    Duties._localEditTs[key] = Date.now();
    clearTimeout(Duties._saveTimers[key]);
    Duties._saveTimers[key] = setTimeout(() => {
      delete Duties._saveTimers[key];
      Duties._persistKey(key);
    }, 800);
  },

  // Ключі що зараз зберігаються в Supabase — poll не перезаписує їх
  _savingKeys: new Set(),
  // Timestamp останньої локальної зміни — poll ігнорує старіші дані з сервера
  _localEditTs: {},

  // onChange для динамічних слотів — при виборі непорожнього значення,
  // якщо це останній (порожній) слот — автоматично рендеримо новий
  onChangeDynamic(sel) {
    // Спецзначення "Всі на зміні" — призначаємо всіх working на цей обов'язок
    if (sel.value === '__all__') {
      const key  = sel.dataset.key;
      const idx  = sel.dataset.dutyIdx;
      const schedKey = key.replace(/^duties_(handover_)/, '');
      const schedule = DB.get('schedule', {});
      const OFF_SHIFTS = new Set(['Х', 'О', 'С']);
      const allIds = getUsers().filter(u => {
        if (u.role !== 'waiter' && u.role2 !== 'waiter') return false;
        const shift = schedule[`${u.id}_${schedKey}`];
        return shift && shift.trim() !== '' && !OFF_SHIFTS.has(shift);
      }).map(u => u.id);
      const saved = DB.get(key, {});
      saved[idx] = allIds;
      DB.set(key, saved);
      sel.value = ''; // скидаємо селект
      // Перерендерити рядок через ре-рендер таблиці
      const selKey = Duties._selectedDateKey('handover');
      const workingWaiters = Duties._workingWaiters(selKey);
      Duties.render('handover', HANDOVER_DUTIES, key, workingWaiters, selKey);
      return;
    }
    Duties.onChange(sel);
    const key     = sel.dataset.key;
    const idx     = sel.dataset.dutyIdx;
    const type    = sel.dataset.type;
    const slot    = parseInt(sel.dataset.slot || '0');
    const saved   = DB.get(key, {});
    const arr     = saved[idx] || [];
    const filled  = arr.filter(Boolean).length;

    // Якщо вибрали значення на останньому слоті — додати порожній
    if (sel.value && slot === filled - 1) {
      Duties.addSlot(sel.closest('tr').querySelector('button[onclick*="addSlot"]'), idx, type, key);
    }
  },

  addSlot(btn, idx, type, key) {
    const saved   = DB.get(key, {});
    const rawSaved = saved[idx];
    const arr     = Array.isArray(rawSaved) ? rawSaved.filter(Boolean) : (rawSaved ? [rawSaved] : []);
    const MAX     = type === 'daily-zones' ? 4 : 2;
    if (arr.length >= MAX) return;

    // Знаходимо td де лежить кнопка
    const td = btn ? btn.closest('td') : null;
    if (!td) return;

    // Видаляємо стару кнопку +
    const oldBtn = td.querySelector('button');
    if (oldBtn) oldBtn.remove();

    // Новий слот index = поточна кількість заповнених
    const newSlot = arr.length;
    const schedule = DB.get('schedule', {});
    // Дістаємо scheduleDateKey з першого селекта в цій таблиці
    const firstSel = td.closest('table')?.querySelector('select.duty-select');
    const schedKey = firstSel ? (firstSel.dataset.key.replace(/^duties_(daily_zones_|handover_|daily_)/, '')) : '';
    const OFF_SHIFTS = new Set(['Х', 'О', 'С']);
    // Тільки офіціанти зі зміною у цей день
    const waiters = getUsers().filter(u => {
      if (u.role !== 'waiter' && u.role2 !== 'waiter') return false;
      const shift = schedule[`${u.id}_${schedKey}`];
      return shift && shift.trim() !== '' && !OFF_SHIFTS.has(shift);
    });

    const opts = waiters.map(w => {
      const shiftVal = schedule[`${w.id}_${schedKey}`] || '';
      const shiftTag = shiftVal ? ` [${shiftVal}]` : '';
      return `<option value="${w.id}">${w.displayName||w.login}${w.nick?` (${w.nick})`:''} ${shiftTag}</option>`;
    }).join('');

    const newSel = document.createElement('select');
    newSel.className = 'duty-select';
    newSel.dataset.dutyIdx = idx;
    newSel.dataset.slot    = newSlot;
    newSel.dataset.type    = type;
    newSel.dataset.key     = key;
    newSel.style.cssText   = 'width:100%;margin-bottom:4px';
    newSel.addEventListener('change', () => Duties.onChangeDynamic(newSel));
    newSel.innerHTML = `<option value="">+ Додати офіціанта</option>${opts}`;
    td.appendChild(newSel);

    // Додаємо кнопку + знову якщо ще є місце
    if (newSlot + 1 < MAX) {
      const newBtn = document.createElement('button');
      newBtn.style.cssText = 'margin-top:2px;background:none;border:1px dashed rgba(255,255,255,.2);border-radius:6px;color:var(--text-dim);font-size:11px;padding:3px 10px;cursor:pointer;width:100%';
      newBtn.textContent = '＋';
      newBtn.addEventListener('click', () => Duties.addSlot(newBtn, idx, type, key));
      td.appendChild(newBtn);
    }
  },

  _saveTimers: {}, // per-key debounce таймери щоб onChange і onChangeDynamic не скидали один одного

  onChange(sel) {
    const key  = sel.dataset.key;
    const idx  = sel.dataset.dutyIdx;
    const slot = parseInt(sel.dataset.slot || '0');
    const saved = DB.get(key, {});

    const rawSaved = saved[idx];
    const arr = Array.isArray(rawSaved) ? [...rawSaved] : (rawSaved ? [rawSaved] : []);
    arr[slot] = sel.value;
    saved[idx] = arr;
    DB.set(key, saved);

    // Зберегти в Supabase з debounce 800ms — окремий таймер на кожен ключ
    clearTimeout(Duties._saveTimers[key]);
    Duties._saveTimers[key] = setTimeout(() => {
      delete Duties._saveTimers[key];
      Duties._persistKey(key);
    }, 800);
  },

  async _persistKey(key) {
    let type, date;
    if (key.startsWith('duties_daily_zones_')) {
      type = 'daily-zones'; date = key.replace('duties_daily_zones_', '');
    } else if (key.startsWith('duties_handover_')) {
      type = 'handover'; date = key.replace('duties_handover_', '');
    } else if (key.startsWith('duties_daily_')) {
      type = 'daily'; date = key.replace('duties_daily_', '');
    } else { return; }

    const now = new Date().toISOString();
    const data = DB.get(key, {});
    Duties._savingKeys.add(key);
    try {
      await sb.upsert('duties', { type, date, data: JSON.stringify(data), published_at: now }, 'type,date');
      const pubLSKey = `duties_${type}_pub_${date}`;
      DB.set(pubLSKey, Date.now());
      // Знімаємо захист від перезапису — дані вже є на сервері
      delete Duties._localEditTs[key];
    } catch(e) {
      const msg = e.message || String(e);
      console.error('duties save error:', msg);
      // Показуємо конкретну помилку
      if (msg.includes('RLS') || msg.includes('policy') || msg.includes('permission') || msg.includes('42501')) {
        toast('❌ RLS заблокував збереження. Вимкни RLS для таблиці duties в Supabase.', 'error');
      } else if (msg.includes('column') || msg.includes('schema')) {
        toast('❌ Помилка схеми БД: ' + msg.slice(0, 80), 'error');
      } else {
        toast('❌ Помилка збереження: ' + msg.slice(0, 60), 'error');
      }
      throw e;
    } finally {
      Duties._savingKeys.delete(key);
    }
  },

  // ── TTL банер — показує скільки днів залишилось ───────────────────
  renderTTLBanner(type, selKey) {
    const bannerId = `${type}-ttl-banner`;
    let banner = $(bannerId);
    if (!banner) {
      // Вставляємо після duties-note або в кінець сторінки
      const page = $(`page-${type === 'handover' ? 'handover' : 'daily'}`);
      if (!page) return;
      banner = document.createElement('div');
      banner.id = bannerId;
      banner.style.cssText = 'margin-top:12px;font-size:11px;text-align:center;padding:8px 12px;border-radius:8px;';
      page.appendChild(banner);
    }

    const keepDays = type === 'handover' ? 2 : 3;
    const pubLSKey = `duties_${type}_pub_${selKey}`;
    const pubTs = DB.get(pubLSKey);
    const hasData = Object.keys(DB.get(`duties_${type}_${selKey}`, {})).length > 0;

    if (!hasData) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';

    if (!pubTs) {
      banner.style.background = 'rgba(255,255,255,.04)';
      banner.style.color = 'var(--text-muted)';
      banner.style.border = '1px solid rgba(255,255,255,.08)';
      banner.textContent = '📋 Дані є, але час публікації невідомий';
      return;
    }

    const elapsed = Date.now() - pubTs;
    const msLeft = keepDays * 24 * 60 * 60 * 1000 - elapsed;

    if (msLeft <= 0) {
      banner.style.background = 'rgba(224,90,90,.08)';
      banner.style.color = 'var(--danger)';
      banner.style.border = '1px solid rgba(224,90,90,.2)';
      banner.textContent = '🗑️ Термін зберігання вийшов — дані будуть видалені при наступному оновленні';
      return;
    }

    const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));
    const daysLeft  = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    const pubDate   = new Date(pubTs);
    const pubStr    = `${padZ(pubDate.getDate())}.${padZ(pubDate.getMonth()+1)} ${padZ(pubDate.getHours())}:${padZ(pubDate.getMinutes())}`;

    if (hoursLeft <= 6) {
      banner.style.background = 'rgba(224,90,90,.08)';
      banner.style.color = 'rgba(255,150,100,.9)';
      banner.style.border = '1px solid rgba(224,90,90,.2)';
      banner.innerHTML = `⚠️ Видаляється через <b>${hoursLeft} год</b> (опубліковано ${pubStr})`;
    } else {
      banner.style.background = 'rgba(212,175,55,.06)';
      banner.style.color = 'rgba(212,175,55,.6)';
      banner.style.border = '1px solid rgba(212,175,55,.12)';
      banner.innerHTML = `🕐 Зберігається ще <b>${daysLeft === 1 ? '1 день' : daysLeft + ' дні'}</b> (опубліковано ${pubStr})`;
    }
  },

  // Зберегти примусово (при кнопці 💾)
  async _persistAll(storageKey, selKey) {
    await Duties._persistKey(storageKey);
    if (storageKey.includes('_daily_') && !storageKey.includes('zones')) {
      await Duties._persistKey(`duties_daily_zones_${selKey}`);
    }
  },

  // ── Будує текст превʼю: особисті обов'язки + зведення по колегах ──
  _buildPreview(type, storageKey, selKey, dateStr) {
    const author = currentUser.displayName || currentUser.login;
    const workingIds = new Set(Duties._workingWaiters(selKey).map(u => u.id));

    // byUser: uid → { name, destId, myDuties[], myZones[] }
    const byUser = {};
    const ensureUser = uid => {
      if (!byUser[uid]) {
        const u = getUserById(uid);
        byUser[uid] = {
          uid,
          name: u?.displayName || u?.login || uid,
          destId: u?.chat_id || u?.tg_id || null,
          myDuties: [],
          myZones: [],
        };
      }
    };

    if (type === 'handover') {
      const saved = DB.get(storageKey, {});
      HANDOVER_DUTIES.forEach((duty, idx) => {
        const val  = saved[idx];
        const uids = (Array.isArray(val) ? val : (val ? [val] : [])).filter(id => workingIds.has(id));
        uids.forEach(uid => { ensureUser(uid); byUser[uid].myDuties.push(duty); });
      });
    } else {
      const savedDuties = DB.get(storageKey, {});
      const savedZones  = DB.get(`duties_daily_zones_${selKey}`, {});
      DAILY_DUTIES.forEach((duty, idx) => {
        const val  = savedDuties[idx];
        const uids = (Array.isArray(val) ? val : (val ? [val] : [])).filter(id => workingIds.has(id));
        uids.forEach(uid => { ensureUser(uid); byUser[uid].myDuties.push(duty); });
      });
      DAILY_ZONES.forEach((zone, idx) => {
        const val  = savedZones[idx];
        const uids = (Array.isArray(val) ? val : (val ? [val] : [])).filter(id => workingIds.has(id));
        uids.forEach(uid => { ensureUser(uid); byUser[uid].myZones.push(zone); });
      });
    }

    const SEP = '\u2508'.repeat(28); // пунктирний розділювач

    const previews = Object.values(byUser).map(u => {
      let text = '';

      if (type === 'handover') {
        // ── Шапка ──
        text += `\uD83D\uDD04 <b>\u0417\u0434\u0430\u0447\u0430 \u0437\u043c\u0456\u043d\u0438 \u2014 ${dateStr}</b>\n`;
        text += `${SEP}\n`;
        // ── Мої обов'язки ──
        text += `\u{1F44B} <b>\u041f\u0440\u0438\u0432\u0456\u0442, ${u.name}!</b>\n\n`;
        if (u.myDuties.length) {
          text += `\uD83E\uDDF9 <b>\u0422\u0432\u043e\u0457 \u043e\u0431\u043e\u0432'\u044f\u0437\u043a\u0438:</b>\n`;
          u.myDuties.forEach(d => { text += `  \u2023 ${d}\n`; });
        } else {
          text += `\u2139\uFE0F \u0422\u0435\u0431\u0456 \u043e\u0431\u043e\u0432'\u044f\u0437\u043a\u0456 \u043d\u0435 \u043f\u0440\u0438\u0437\u043d\u0430\u0447\u0435\u043d\u043e.\n`;
        }
        text += `\n${SEP}\n\u2014 ${author}`;

      } else {
        // ── Шапка ──
        text += `\u2600\uFE0F <b>\u041E\u0431\u043E\u0432'\u044F\u0437\u043A\u0438 \u0442\u0430 \u0437\u043E\u043D\u0438 \u2014 ${dateStr}</b>\n`;
        text += `${SEP}\n`;
        // ── Мої обов'язки ──
        text += `\uD83D\uDC4B <b>\u041F\u0440\u0438\u0432\u0456\u0442, ${u.name}!</b>\n`;
        if (u.myDuties.length) {
          text += `\n\uD83E\uDDF9 <b>\u0422\u0432\u043E\u0457 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0438:</b>\n`;
          u.myDuties.forEach(d => { text += `  \u2023 ${d}\n`; });
        }
        if (u.myZones.length) {
          text += `\n\uD83D\uDCCD <b>\u0422\u0432\u043E\u044F \u0437\u043E\u043D\u0430:</b>\n`;
          u.myZones.forEach(z => { text += `  \u2023 ${z}\n`; });
        }
        if (!u.myDuties.length && !u.myZones.length) {
          text += `\n\u2139\uFE0F \u0422\u0435\u0431\u0456 \u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u0438 \u043D\u0435 \u043F\u0440\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043E.\n`;
        }
        text += `\n${SEP}\n\u2014 ${author}`;
      }

      return { uid: u.uid, name: u.name, destId: u.destId, text };
    });

    return previews;
  },

  // ── Показати модалку превʼю перед відправкою в Telegram ──────────
  async showPreview(type, storageKey) {
    const selKey = Duties._selectedDateKey(type);
    const [sy, sm, sd] = selKey.split('-').map(Number);
    const dateStr = `${sd} ${MONTHS_UA[sm - 1]} ${sy}`;

    // Зберігаємо якщо ще не збережено (виклик може бути прямим)
    await Duties._persistAll(storageKey, selKey);

    const previews = Duties._buildPreview(type, storageKey, selKey, dateStr);
    const tplKey = `tpl_duties_${type}`;

    const tabsHtml = previews.length > 1
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          ${previews.map((p,i) => `<button onclick="Duties._switchPreviewTab(${i})" id="ptab-${i}"
            style="padding:4px 10px;border-radius:12px;border:1px solid var(--gold-border);background:${i===0?'var(--gold)':'transparent'};color:${i===0?'var(--eden-dark)':'var(--text-dim)'};font-size:11px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif">
            ${p.name}
          </button>`).join('')}
         </div>`
      : '';

    const textareasHtml = previews.map((p,i) => `
      <div id="preview-pane-${i}" style="display:${i===0?'block':'none'}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim)">
            Повідомлення для: <span style="color:var(--gold)">${p.name}</span>
          </div>
          <div style="display:flex;gap:5px">
            <button class="btn btn-ghost btn-sm" onclick="Duties._saveDutyTpl('${tplKey}',${i})">💾 Зберегти шаблон</button>
            <button class="btn btn-ghost btn-sm" onclick="Duties._loadDutyTpl('${tplKey}',${i})">📋 Шаблон</button>
          </div>
        </div>
        <textarea id="preview-text-${i}" class="field" rows="10"
          style="font-family:monospace;font-size:12px;line-height:1.6;resize:vertical;white-space:pre"
        >${p.text}</textarea>
      </div>`).join('');

    showModal(`
      <div class="modal-title">📨 Попередній перегляд</div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:14px">
        Відредагуйте текст якщо потрібно, потім натисніть «Надіслати»
      </div>
      ${tabsHtml}
      ${textareasHtml}
      <div class="modal-footer">
        <button class="btn btn-gold" onclick="Duties._confirmSend('${type}','${storageKey}','${selKey}','${dateStr}',${previews.length})">
          ✈️ Надіслати
        </button>
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
      </div>`);
  },

  _saveDutyTpl(tplKey, idx) {
    const ta = document.getElementById(`preview-text-${idx}`);
    if (!ta) return;
    // Зберігаємо шаблон під ключем типу tpl_duties_handover або tpl_duties_daily
    DB.set(tplKey, ta.value);
    toast('Шаблон збережено ✅', 'success-t');
  },

  _loadDutyTpl(tplKey, idx) {
    const ta = document.getElementById(`preview-text-${idx}`);
    if (!ta) return;
    const tpl = DB.get(tplKey, '');
    if (!tpl) { toast('Немає збереженого шаблону', 'error'); return; }
    ta.value = tpl;
    toast('Шаблон завантажено', 'success-t');
  },

  _switchPreviewTab(idx) {
    document.querySelectorAll('[id^="preview-pane-"]').forEach((el,i) => {
      el.style.display = i === idx ? 'block' : 'none';
    });
    document.querySelectorAll('[id^="ptab-"]').forEach((btn,i) => {
      btn.style.background = i === idx ? 'var(--gold)' : 'transparent';
      btn.style.color = i === idx ? 'var(--eden-dark)' : 'var(--text-dim)';
    });
  },

  async _confirmSend(type, storageKey, selKey, dateStr, count) {
    // Збираємо фінальні тексти з textarea (адмін міг редагувати)
    const previews = Duties._buildPreview(type, storageKey, selKey, dateStr);
    const finalTexts = previews.map((p, i) => {
      const ta = document.getElementById(`preview-text-${i}`);
      return { ...p, text: ta ? ta.value : p.text };
    });

    closeModal();

    // Надсилаємо кожному персонально
    let sent = 0, noTg = [];
    for (const p of finalTexts) {
      if (!p.text.trim()) continue;
      if (p.destId) {
        await tgSendPersonal(p.destId, p.text);
        sent++;
      } else {
        noTg.push(p.name);
      }
    }

    // ── Адмін-звіт: повне зведення хто що робить ──────────────────
    const adminDestId = currentUser.chat_id || currentUser.tg_id;
    if (adminDestId) {
      const SEP  = '┄'.repeat(26);
      const SEP2 = '─'.repeat(26);
      const adminName = currentUser.displayName || currentUser.login;
      const workingIds = new Set(Duties._workingWaiters(selKey).map(u => u.id));

      let adminMsg = '';

      if (type === 'handover') {
        // ════ ЗДАЧА ЗМІНИ ════
        adminMsg += `🔄 <b>ЗДАЧА ЗМІНИ — ${dateStr}</b>\n`;
        adminMsg += `<i>Розіслав: ${adminName}</i>\n`;
        adminMsg += `${SEP2}\n\n`;

        // Зведення: обов'язок → офіціанти
        const saved = DB.get(storageKey, {});
        const dutyRows = [];
        HANDOVER_DUTIES.forEach((duty, idx) => {
          const val  = saved[idx];
          const uids = (Array.isArray(val) ? val : (val ? [val] : [])).filter(id => workingIds.has(id));
          dutyRows.push({ duty, names: uids.map(id => getUserById(id)?.displayName || id) });
        });

        // Таблиця обов'язків
        adminMsg += `🧹 <b>Обов'язки</b>\n${SEP}\n`;
        dutyRows.forEach(r => {
          const who = r.names.length ? r.names.join(', ') : '—';
          adminMsg += `  ▸ ${r.duty}\n    👤 ${who}\n`;
        });

        // Підсумок по кожному офіціанту
        const byPerson = {};
        dutyRows.forEach(r => {
          r.names.forEach(name => {
            if (!byPerson[name]) byPerson[name] = [];
            byPerson[name].push(r.duty);
          });
        });
        if (Object.keys(byPerson).length) {
          adminMsg += `\n${SEP2}\n`;
          adminMsg += `👥 <b>По офіціантах</b>\n${SEP}\n`;
          Object.entries(byPerson).forEach(([name, duties]) => {
            adminMsg += `\n👤 <b>${name}</b> (${duties.length} обов'яз.):\n`;
            duties.forEach(d => { adminMsg += `  • ${d}\n`; });
          });
        }

      } else {
        // ════ ЩОДЕННІ ОБОВ'ЯЗКИ + ЗОНИ ════
        adminMsg += `☀️ <b>ЩОДЕННІ ОБОВʼЯЗКИ ТА ЗОНИ — ${dateStr}</b>\n`;
        adminMsg += `<i>Розіслав: ${adminName}</i>\n`;
        adminMsg += `${SEP2}\n\n`;

        // Обов'язки
        const savedDuties = DB.get(storageKey, {});
        const savedZones  = DB.get(`duties_daily_zones_${selKey}`, {});

        const dutyRows = [];
        DAILY_DUTIES.forEach((duty, idx) => {
          const val  = savedDuties[idx];
          const uids = (Array.isArray(val) ? val : (val ? [val] : [])).filter(id => workingIds.has(id));
          dutyRows.push({ duty, names: uids.map(id => getUserById(id)?.displayName || id) });
        });
        const zoneRows = [];
        DAILY_ZONES.forEach((zone, idx) => {
          const val  = savedZones[idx];
          const uids = (Array.isArray(val) ? val : (val ? [val] : [])).filter(id => workingIds.has(id));
          zoneRows.push({ zone, names: uids.map(id => getUserById(id)?.displayName || id) });
        });

        adminMsg += `🧹 <b>Обов'язки</b>\n${SEP}\n`;
        dutyRows.forEach(r => {
          const who = r.names.length ? r.names.join(', ') : '—';
          adminMsg += `  ▸ ${r.duty}\n    👤 ${who}\n`;
        });

        adminMsg += `\n📍 <b>Зони</b>\n${SEP}\n`;
        zoneRows.forEach(r => {
          const who = r.names.length ? r.names.join(', ') : '—';
          adminMsg += `  ▸ ${r.zone}\n    👤 ${who}\n`;
        });

        // Підсумок по кожному офіціанту
        const byPerson = {};
        dutyRows.forEach(r => {
          r.names.forEach(name => {
            if (!byPerson[name]) byPerson[name] = { duties: [], zones: [] };
            byPerson[name].duties.push(r.duty);
          });
        });
        zoneRows.forEach(r => {
          r.names.forEach(name => {
            if (!byPerson[name]) byPerson[name] = { duties: [], zones: [] };
            byPerson[name].zones.push(r.zone);
          });
        });
        if (Object.keys(byPerson).length) {
          adminMsg += `\n${SEP2}\n`;
          adminMsg += `👥 <b>По офіціантах</b>\n${SEP}\n`;
          Object.entries(byPerson).forEach(([name, data]) => {
            adminMsg += `\n👤 <b>${name}</b>:\n`;
            if (data.duties.length) {
              data.duties.forEach(d => { adminMsg += `  🧹 ${d}\n`; });
            }
            if (data.zones.length) {
              data.zones.forEach(z => { adminMsg += `  📍 ${z}\n`; });
            }
          });
        }
      }

      // Статус розсилки
      adminMsg += `\n${SEP2}\n`;
      adminMsg += `📨 <b>Статус розсилки</b>\n`;
      adminMsg += `✅ Отримали (${sent}): ${finalTexts.filter(p=>p.destId).map(p=>p.name).join(', ') || '—'}\n`;
      if (noTg.length) {
        adminMsg += `❌ Без Telegram (${noTg.length}): ${noTg.join(', ')}\n`;
      }

      await tgSendPersonal(adminDestId, adminMsg);
    }

    toast(`Надіслано ${sent} офіціантам!`, 'success-t');
    Duties.initFromCal(type);
  },

  // _rerenderFromDB — перерендер одразу з локального стану без очікування Supabase
  _rerenderFromDB(dataType, key, selKey) {
    const ww = Duties._workingWaiters(selKey);
    if (dataType === 'daily-zones') {
      Duties.renderZones(key, ww, selKey);
    } else {
      const dList = dataType === 'handover' ? HANDOVER_DUTIES : DAILY_DUTIES;
      Duties.render(dataType, dList, key, ww, selKey);
    }
  },

  // Зберегти + показати превʼю для відправки в Telegram
  async sendTg(type, storageKey) {
    const selKey = Duties._selectedDateKey(type);
    const btn = document.querySelector(`[onclick="Duties.sendTg('${type}','${storageKey}')"]`);
    btnLock(btn);
    try {
      await Duties._persistAll(storageKey, selKey);
      Duties.initFromCal(type);
      await Duties.showPreview(type, storageKey);
    } catch(e) {
      toast('Помилка збереження', 'error');
      console.error(e);
    } finally {
      btnUnlock(btn);
    }
  },

  async clear(type, storageKey) {
    showConfirm('Очистити всі призначення на цей день?', async () => {
      DB.del(storageKey);
      toast('Очищено', 'success-t');
      let sbType, date;
      if (storageKey.startsWith('duties_daily_zones_')) {
        sbType = 'daily-zones'; date = storageKey.replace('duties_daily_zones_', '');
      } else if (storageKey.startsWith('duties_handover_')) {
        sbType = 'handover'; date = storageKey.replace('duties_handover_', '');
      } else if (storageKey.startsWith('duties_daily_')) {
        sbType = 'daily'; date = storageKey.replace('duties_daily_', '');
      }
      if (sbType && date) {
        try { await sb.upsert('duties', { type: sbType, date, data: {} }, 'type,date'); } catch(e) {}
      }
      Duties.initFromCal(type);
    }, { okLabel: '🗑 Очистити', okClass: 'btn-danger' });
  }
};

