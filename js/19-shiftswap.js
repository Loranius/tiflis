// ╔═══════════════════════════════════════════════════════════════╗
// ║  [12b/13]  ОБМІН ЗМІНАМИ (ShiftSwap)                          ║
// ╚═══════════════════════════════════════════════════════════════╝
/*
  Схема роботи:
  1. Офіціант бачить клікабельні зміни інших → клікає → відкривається модалка
  2. У модалці: чия зміна, на яку дату, і список СВОЇХ змін для обміну
     (або опція "Просто попросити вихідний" без відповідної зміни)
  3. Натискає "Відправити запит" → запис у settings['shift_swaps'] (Supabase)
  4. Цільовий офіціант отримує TG-повідомлення з деталями
  5. Він заходить у "Мої обміни" → там кнопки Прийняти / Відхилити
  6. Після прийняття — зміни в schedule міняються місцями і обидва отримують TG
  7. Адміни бачать всі обміни та можуть приймати/відхиляти самі
*/

const SWAPS_KEY = 'shift_swaps'; // ключ у settings

const ShiftSwap = {

  // ── Отримати всі обміни ──────────────────────────────────────
  getAll() {
    return DB.get(SWAPS_KEY, []);
  },

  // ── Зберегти масив обмінів у Supabase + локально ────────────
  async _saveSwaps(swaps) {
    DB.set(SWAPS_KEY, swaps);
    try {
      await sb.upsert('settings', { key: SWAPS_KEY, value: JSON.stringify(swaps) }, 'key');
    } catch(e) { console.error('ShiftSwap save error:', e); }
  },

  // ── Генерація унікального ID ─────────────────────────────────
  _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  },

  // ── Оновити кнопку "Мої обміни" з лічильником pending ───────
  _updateMySwapsBtn() {
    const btn = $('my-swaps-btn');
    if (!btn || !currentUser) return;
    const swaps = ShiftSwap.getAll();
    // Pending запити до мене
    const incoming = swaps.filter(s =>
      s.status === 'pending' && s.targetId === currentUser.id
    ).length;
    if (incoming > 0) {
      btn.innerHTML = `⇄ Мої обміни <span style="background:var(--danger);color:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;margin-left:4px">${incoming}</span>`;
    } else {
      btn.innerHTML = `⇄ Мої обміни`;
    }
  },

  // ── Модалка: пропозиція обміну ───────────────────────────────
  openProposalModal(targetUserId, targetDate, targetShift, targetName) {
    if (!currentUser) return;
    if (isAdmin(currentUser)) return;

    const schedule = DB.get('schedule', {});
    const n = NOW();
    const todayStr = dateKey(n.getFullYear(), n.getMonth(), n.getDate());

    // Визначити чи обмін можливий за типом: тільки Р↔Х, Х↔Р або забрати Р (без обміну)
    const isTargetWork = ['Р','СН','Б','С','Р/Б','СН/Б'].includes(targetShift);
    const isTargetOff  = ['Х','О'].includes(targetShift);

    // Зібрати свої зміни на дати >= today (крім тієї самої дати у своєму рядку)
    const myEntries = [];
    // Перебираємо всі ключі з поточного місяця і наступних 3 місяців
    for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
      let y = n.getFullYear(), m = n.getMonth() + monthOffset;
      if (m > 11) { m -= 12; y++; }
      const days = new Date(y, m+1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const dk = dateKey(y, m, d);
        if (dk < todayStr) continue;
        const key = `${currentUser.id}_${dk}`;
        const val = schedule[key] || '';
        if (!val) continue;
        myEntries.push({ date: dk, shift: val });
      }
    }

    // Визначаємо що пропонуємо: "дати свою зміну" (swap) або "просто взяти"
    // Можна swap: якщо у мене є зміни що підходять за типом
    // Можна "просто забрати": якщо targetShift = Р (робочий) і я хочу його прибрати
    //   — це означає targetShift стане Х, мій день не змінюється (нема відповідного обміну)

    const MONTHS_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
    const fmtDate = (dk) => {
      const [y,m,d] = dk.split('-').map(Number);
      const dow = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(y,m-1,d).getDay()];
      return `${d} ${MONTHS_SHORT[m-1]} (${dow})`;
    };

    const shiftColor = (v) => SHIFT_COLORS[v] || 'var(--text-dim)';
    const shiftBg    = (v) => {
      const c = {
        'Р':'rgba(90,175,122,.12)', 'Х':'rgba(224,90,90,.12)', 'О':'rgba(176,96,64,.12)',
        'СН':'rgba(126,200,227,.12)', 'Б':'rgba(212,175,55,.12)', 'С':'rgba(200,144,232,.12)',
        'Р/Б':'rgba(240,160,80,.12)', 'СН/Б':'rgba(128,200,176,.12)',
      };
      return c[v] || 'rgba(255,255,255,.06)';
    };

    // Фільтр: для обміну потрібна своя зміна протилежного типу
    // (якщо targetShift = Р → моя = Х; якщо target = Х → моя = Р/СН/Б/...)
    const compatibleEntries = myEntries.filter(e => {
      if (isTargetWork) return ['Х','О'].includes(e.shift); // беру чужий Р → даю свій Х
      if (isTargetOff)  return ['Р','СН','Б','С','Р/Б','СН/Б'].includes(e.shift); // беру чужий Х → даю свій Р
      return false;
    });

    let myShiftOptions = '';
    if (compatibleEntries.length) {
      myShiftOptions = compatibleEntries.map(e => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--gold-border);border-radius:8px;cursor:pointer;margin-bottom:6px;transition:all .15s;background:${shiftBg(e.shift)}"
          onclick="this.closest('.swap-options').querySelectorAll('label').forEach(l=>l.style.borderColor='var(--gold-border)');this.style.borderColor='var(--gold)'">
          <input type="radio" name="my-swap-entry" value="${e.date}" style="accent-color:var(--gold)">
          <div class="swap-shift-box" style="background:${shiftBg(e.shift)};border:1px solid ${shiftColor(e.shift)}40;color:${shiftColor(e.shift)}">${e.shift}</div>
          <span style="font-size:12px;font-weight:600;color:var(--text)">${fmtDate(e.date)}</span>
        </label>`).join('');
    }

    // Опція "без відповідної зміни" = просто попросити вихідний у колеги
    const noSwapLabel = isTargetWork
      ? `😴 Просто попросити вихідний (без обміну)` 
      : `✅ Просто попросити робочий (без обміну)`;

    const html = `
      <div class="modal-title">⇄ Запит на обмін</div>

      <!-- Мета обміну: чия зміна -->
      <div style="background:rgba(0,0,0,.25);border:1px solid var(--gold-border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);margin-bottom:8px;font-weight:700">Зміна яку хочу отримати</div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="swap-shift-box" style="background:${shiftBg(targetShift)};border:1px solid ${shiftColor(targetShift)}50;color:${shiftColor(targetShift)};font-size:14px">${targetShift}</div>
          <div>
            <div style="font-size:13px;font-weight:700">${esc(targetName)}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${fmtDate(targetDate)}</div>
          </div>
        </div>
      </div>

      <!-- Що пропоную взамін -->
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:10px">Що пропоную взамін</div>
      <div class="swap-options" style="max-height:240px;overflow-y:auto;margin-bottom:12px">
        ${myShiftOptions || ''}
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--gold-border);border-radius:8px;cursor:pointer;margin-bottom:6px;transition:all .15s"
          onclick="this.closest('.swap-options').querySelectorAll('label').forEach(l=>l.style.borderColor='var(--gold-border)');this.style.borderColor='var(--gold)'">
          <input type="radio" name="my-swap-entry" value="__none__" style="accent-color:var(--gold)" ${!compatibleEntries.length ? 'checked' : ''}>
          <span style="font-size:12px;font-weight:600;color:var(--text-dim)">${noSwapLabel}</span>
        </label>
      </div>

      <!-- Коментар -->
      <div class="form-group" style="margin-bottom:16px">
        <label class="lbl">Коментар (необов'язково)</label>
        <input type="text" id="swap-comment" class="field" placeholder="Наприклад: сімейні обставини...">
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
        <button class="btn btn-gold" onclick="ShiftSwap.submitProposal('${targetUserId}','${targetDate}','${targetShift}','${esc(targetName)}')">
          📨 Надіслати запит
        </button>
      </div>`;

    showModal(html);
  },

  // ── Відправити запит ─────────────────────────────────────────
  async submitProposal(targetUserId, targetDate, targetShift, targetName) {
    const radio = document.querySelector('input[name="my-swap-entry"]:checked');
    if (!radio) { toast('Оберіть варіант обміну', 'error'); return; }
    const myDate  = radio.value === '__none__' ? null : radio.value;

    const schedule = DB.get('schedule', {});
    const myShift  = myDate ? (schedule[`${currentUser.id}_${myDate}`] || '') : null;
    const comment  = $('swap-comment')?.value.trim() || '';

    const swap = {
      id:          ShiftSwap._uid(),
      status:      'pending',         // pending | accepted | declined | cancelled
      createdAt:   new Date().toISOString(),
      // Ініціатор
      fromId:      currentUser.id,
      fromName:    currentUser.displayName || currentUser.login,
      fromDate:    myDate,
      fromShift:   myShift,
      // Адресат
      targetId:    targetUserId,
      targetName:  targetName,
      targetDate:  targetDate,
      targetShift: targetShift,
      // Доп.
      comment,
      respondedAt: null,
    };

    const swaps = ShiftSwap.getAll();
    swaps.push(swap);
    await ShiftSwap._saveSwaps(swaps);

    closeModal();

    // TG до цільового офіціанта — з inline-кнопками підтвердження
    const targetUser = getUsers().find(u => u.id === targetUserId);
    const destId = targetUser?.chat_id || targetUser?.tg_id;
    if (destId) {
      const MONTHS_UA2 = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
      const fmtDateUA = (dk) => {
        if (!dk) return '—';
        const [y,m,d] = dk.split('-').map(Number);
        return `${d} ${MONTHS_UA2[m-1]}`;
      };
      const swapLine = myDate
        ? `\n🔄 Пропонує свій <b>${myShift}</b> (${fmtDateUA(myDate)}) взамін`
        : `\n😴 Просить без відповідного обміну`;

      const msg = [
        `╔══════════════════╗`,
        `  ⇄ <b>ЗАПИТ НА ОБМІН ЗМІНИ</b>`,
        `╚══════════════════╝`,
        ``,
        `👤 <b>${esc(swap.fromName)}</b> хоче отримати ваш:`,
        `📅 <b>${fmtDateUA(targetDate)}</b> — <b>${targetShift}</b>`,
        swapLine,
        comment ? `\n💬 ${esc(comment)}` : '',
        ``,
        `<i>Портал персоналу · Тифліс</i>`,
      ].filter(l => l !== null).join('\n');

      const buttons = [[
        { text: '✅ Прийняти', callback_data: `swap_accept:${swap.id}` },
        { text: '❌ Відхилити', callback_data: `swap_decline:${swap.id}` },
      ]];

      // Спробувати через Edge Function (підтримує inline-кнопки)
      let sentWithButtons = false;
      try {
        const res = await fetch(EDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
          body: JSON.stringify({ action: 'send_swap_request', chat_id: destId, text: msg, buttons }),
        });
        const data = await res.json();
        sentWithButtons = data.ok;
      } catch(e) { /* fallback нижче */ }

      // Fallback: напряму через Bot API з кнопками
      if (!sentWithButtons) {
        const token = getTgToken();
        if (token) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: destId, text: msg, parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons },
              }),
            });
          } catch(e) { console.warn('TG inline send failed:', e); }
        }
      }
    }

    ShiftSwap._updateMySwapsBtn();
    toast('Запит надіслано ✅', 'success-t');
  },

  // ── Модалка: мої обміни ──────────────────────────────────────
  openMySwaps() {
    const swaps = ShiftSwap.getAll();
    if (!currentUser) return;

    const mySwaps = swaps.filter(s =>
      s.fromId === currentUser.id || s.targetId === currentUser.id
    ).sort((a,b) => b.createdAt.localeCompare(a.createdAt));

    // Адміни бачать усі
    const showSwaps = isAdmin(currentUser)
      ? swaps.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt))
      : mySwaps;

    const MONTHS_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
    const fmtDate = (dk) => {
      if (!dk) return '—';
      const [y,m,d] = dk.split('-').map(Number);
      const dow = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(y,m-1,d).getDay()];
      return `${d} ${MONTHS_SHORT[m-1]} (${dow})`;
    };
    const shiftColor = (v) => SHIFT_COLORS[v] || 'var(--text-dim)';
    const shiftBg    = (v) => {
      const c = { 'Р':'rgba(90,175,122,.15)','Х':'rgba(224,90,90,.15)','О':'rgba(176,96,64,.15)','СН':'rgba(126,200,227,.15)','Б':'rgba(212,175,55,.15)','С':'rgba(200,144,232,.15)','Р/Б':'rgba(240,160,80,.15)','СН/Б':'rgba(128,200,176,.15)' };
      return c[v] || 'rgba(255,255,255,.06)';
    };

    const statusLabel = (s) => {
      const m = { pending:'⏳ Очікує', accepted:'✅ Прийнято', declined:'❌ Відхилено', cancelled:'🚫 Скасовано' };
      return m[s] || s;
    };
    const statusClass = (s) => `swap-status-${s}`;

    const isMine  = (sw) => sw.fromId   === currentUser.id;
    const isTarget= (sw) => sw.targetId === currentUser.id;

    const cardsHtml = showSwaps.length ? showSwaps.map(sw => {
      const canRespond = isTarget(sw) && sw.status === 'pending';
      const canCancel  = (isMine(sw) || isAdmin(currentUser)) && sw.status === 'pending';
      const canAdminAct= false; // адмін не може приймати/відхиляти замість адресата

      const direction = isMine(sw) ? '📤 Ви запропонували' : `📥 Запит від <b>${esc(sw.fromName)}</b>`;

      return `
        <div class="swap-card" id="swap-card-${sw.id}">
          <div class="swap-card-header">
            <span style="font-size:11px;color:var(--text-dim)">${direction}</span>
            <span class="swap-status-badge ${statusClass(sw.status)}">${statusLabel(sw.status)}</span>
          </div>

          <!-- Деталі обміну -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <!-- Цільова зміна -->
            <div style="flex:1;min-width:100px;background:rgba(0,0,0,.2);border-radius:8px;padding:8px 10px">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:4px">Хоче отримати</div>
              <div style="display:flex;align-items:center;gap:6px">
                <div class="swap-shift-box" style="background:${shiftBg(sw.targetShift)};border:1px solid ${shiftColor(sw.targetShift)}50;color:${shiftColor(sw.targetShift)}">${sw.targetShift}</div>
                <div>
                  <div style="font-size:11px;font-weight:700">${esc(sw.targetName)}</div>
                  <div style="font-size:10px;color:var(--text-dim)">${fmtDate(sw.targetDate)}</div>
                </div>
              </div>
            </div>

            ${sw.fromDate ? `
            <div style="font-size:18px;color:var(--gold)">⇄</div>
            <!-- Зустрічна зміна -->
            <div style="flex:1;min-width:100px;background:rgba(0,0,0,.2);border-radius:8px;padding:8px 10px">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:4px">Пропонує взамін</div>
              <div style="display:flex;align-items:center;gap:6px">
                <div class="swap-shift-box" style="background:${shiftBg(sw.fromShift)};border:1px solid ${shiftColor(sw.fromShift)}50;color:${shiftColor(sw.fromShift)}">${sw.fromShift}</div>
                <div>
                  <div style="font-size:11px;font-weight:700">${esc(sw.fromName)}</div>
                  <div style="font-size:10px;color:var(--text-dim)">${fmtDate(sw.fromDate)}</div>
                </div>
              </div>
            </div>` : `<div style="font-size:11px;color:var(--text-dim);font-style:italic;flex:1;text-align:center">😴 Без зустрічної зміни</div>`}
          </div>

          ${sw.comment ? `<div style="font-size:11px;color:var(--text-dim);font-style:italic;margin-bottom:8px">💬 ${esc(sw.comment)}</div>` : ''}

          <!-- Кнопки дій -->
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${canRespond || canAdminAct ? `
              <button class="btn btn-sm" style="background:rgba(90,175,122,.15);color:var(--success);border:1px solid rgba(90,175,122,.3)"
                onclick="ShiftSwap.respond('${sw.id}','accepted')">✅ Прийняти</button>
              <button class="btn btn-danger btn-sm"
                onclick="ShiftSwap.respond('${sw.id}','declined')">❌ Відхилити</button>
            ` : ''}
            ${canCancel ? `
              <button class="btn btn-ghost btn-sm"
                onclick="ShiftSwap.respond('${sw.id}','cancelled')">🚫 Скасувати</button>
            ` : ''}
          </div>
        </div>`;
    }).join('') : `
      <div style="text-align:center;padding:40px 20px;color:var(--text-dim)">
        <div style="font-size:40px;margin-bottom:12px">⇄</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">Немає запитів</div>
        <div style="font-size:11px;margin-top:6px">Натисніть на зміну колеги в графіку щоб запропонувати обмін</div>
      </div>`;

    const title = isAdmin(currentUser) ? 'Всі обміни змін' : 'Мої обміни';
    showModal(`
      <div class="modal-title">⇄ ${title}</div>
      <div style="max-height:60vh;overflow-y:auto">${cardsHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Закрити</button>
      </div>`);
  },

  // ── Прийняти / Відхилити / Скасувати ────────────────────────
  async respond(swapId, decision) {
    const swaps = ShiftSwap.getAll();
    const idx = swaps.findIndex(s => s.id === swapId);
    if (idx < 0) { toast('Обмін не знайдено', 'error'); return; }
    const swap = swaps[idx];

    swaps[idx] = { ...swap, status: decision, respondedAt: new Date().toISOString() };
    await ShiftSwap._saveSwaps(swaps);

    // Якщо прийнято — виконати обмін у graphіку
    if (decision === 'accepted') {
      await ShiftSwap._executeSwap(swap);
    }

    // TG сповіщення ініціатору
    if (decision !== 'cancelled') {
      const fromUser = getUsers().find(u => u.id === swap.fromId);
      const destId = fromUser?.chat_id || fromUser?.tg_id;
      const MONTHS_UA2 = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
      const fmtDateUA = (dk) => { if(!dk) return '—'; const[y,m,d]=dk.split('-').map(Number); return `${d} ${MONTHS_UA2[m-1]}`; };
      if (destId) {
        const icon = decision === 'accepted' ? '✅' : '❌';
        const label= decision === 'accepted' ? 'ПРИЙНЯТО' : 'ВІДХИЛЕНО';
        const msg = `${icon} <b>Обмін ${label}</b>\n\n${esc(swap.targetName)} ${decision === 'accepted' ? 'погодився(лась)' : 'відхилив(ла)'} ваш запит:\n📅 ${fmtDateUA(swap.targetDate)} — <b>${swap.targetShift}</b>\n\n<i>Портал персоналу · Тифліс</i>`;
        await tgSendPersonal(destId, msg);
      }

      // TG сповіщення адмінам (тільки при прийнятті або відхиленні, не при скасуванні)
      const admins = DB.get('users', []).filter(u => !u.fired && isAdmin(u));
      const swapLine = swap.fromDate
        ? `🔄 ${esc(swap.fromName)}: <b>${swap.fromShift}</b> (${fmtDateUA(swap.fromDate)}) ↔ ${esc(swap.targetName)}: <b>${swap.targetShift}</b> (${fmtDateUA(swap.targetDate)})`
        : `😴 ${esc(swap.fromName)} забрав(ла) у ${esc(swap.targetName)}: <b>${swap.targetShift}</b> (${fmtDateUA(swap.targetDate)})`;
      const adminIcon  = decision === 'accepted' ? '✅' : '❌';
      const adminLabel = decision === 'accepted' ? 'ОБМІН ЗМІНАМИ ВІДБУВСЯ' : 'ОБМІН ВІДХИЛЕНО';
      const adminMsg = [
        `╔══════════════════╗`,
        `  ${adminIcon} <b>${adminLabel}</b>`,
        `╚══════════════════╝`,
        ``,
        swapLine,
        swap.comment ? `\n💬 ${esc(swap.comment)}` : '',
        ``,
        `<i>Портал персоналу · Тифліс</i>`,
      ].filter(Boolean).join('\n');
      for (const adm of admins) {
        const admChatId = adm.chat_id || adm.tg_id;
        if (admChatId) await tgSendPersonal(admChatId, adminMsg);
      }
    }

    // Оновити модалку
    closeModal();
    toast(decision === 'accepted' ? '✅ Обмін виконано' : decision === 'declined' ? '❌ Відхилено' : '🚫 Скасовано', 'success-t');
    ShiftSwap._updateMySwapsBtn();

    // Оновити графік якщо відкритий
    if ($('page-schedule')?.classList.contains('active')) {
      Schedule.renderTable(scheduleActiveRole, Schedule.calYear, Schedule.calMonth);
    }
  },

  // ── Виконати обмін: поміняти зміни в schedule ────────────────
  async _executeSwap(swap) {
    const schedule = DB.get('schedule', {});

    // Записати цільову зміну в schedule ініціатора
    const fromKey   = `${swap.fromId}_${swap.targetDate}`;
    const targetKey = `${swap.targetId}_${swap.targetDate}`;

    // Ініціатор отримує зміну адресата
    schedule[fromKey] = swap.targetShift;
    await Schedule._saveToSupabase(swap.fromId, swap.targetDate, swap.targetShift);

    // Якщо є зустрічна зміна — адресат отримує зміну ініціатора в інший день
    if (swap.fromDate) {
      const fromSwapKey   = `${swap.fromId}_${swap.fromDate}`;
      const targetSwapKey = `${swap.targetId}_${swap.fromDate}`;
      // Зберегти поточні значення для обміну
      const oldFromSwapVal   = schedule[fromSwapKey]   || '';
      const oldTargetSwapVal = schedule[targetSwapKey] || '';
      // Адресат отримує зміну ініціатора (на дату ініціатора)
      schedule[targetSwapKey] = swap.fromShift;
      await Schedule._saveToSupabase(swap.targetId, swap.fromDate, swap.fromShift);
      // Ініціатор на своїй даті отримує поточну зміну адресата (зазвичай Х або порожньо)
      schedule[fromSwapKey] = oldTargetSwapVal || 'Х';
      await Schedule._saveToSupabase(swap.fromId, swap.fromDate, oldTargetSwapVal || 'Х');

      // Адресат на своїй початковій даті (targetDate) отримує зміну ініціатора (fromShift)
      // — це і є суть обміну: кожен бере зміну іншого на своїй даті
      schedule[targetKey] = swap.fromShift || 'Х';
      await Schedule._saveToSupabase(swap.targetId, swap.targetDate, swap.fromShift || 'Х');
    } else {
      // Без зустрічного: адресат на своїй даті отримує Х (замість робочої)
      const isTargetWork = ['Р','СН','Б','С','Р/Б','СН/Б'].includes(swap.targetShift);
      const newTargetVal = isTargetWork ? 'Х' : 'Р'; // якщо забирали вихідний — даємо робочий
      schedule[targetKey] = newTargetVal;
      await Schedule._saveToSupabase(swap.targetId, swap.targetDate, newTargetVal);
    }

    DB.set('schedule', schedule);
  },

  // ── Завантажити обміни з Supabase ───────────────────────────
  async pullFromServer() {
    try {
      const settings = await sb.query('settings', { filter: { key: SWAPS_KEY } });
      if (settings && settings.length > 0) {
        const parsed = JSON.parse(settings[0].value || '[]');
        DB.set(SWAPS_KEY, parsed);
        ShiftSwap._updateMySwapsBtn();
      }
    } catch(e) { console.warn('ShiftSwap pull error:', e); }
  },
};

