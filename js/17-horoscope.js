// ╔═══════════════════════════════════════════════════════════════╗
// ║  HOROSCOPE MODULE                                             ║
// ╚═══════════════════════════════════════════════════════════════╝
const Horoscope = {
  _loading: false,

  _renderCard(data) {
    const moodColors = { '😊':'rgba(90,175,122,.12)', '⚡':'rgba(240,160,80,.12)', '💫':'rgba(126,200,227,.12)', '❤️':'rgba(236,72,153,.12)', '💰':'rgba(212,175,55,.12)' };
    return `
      <div style="background:linear-gradient(135deg,rgba(22,56,50,.6) 0%,rgba(14,36,32,.8) 100%);border:1px solid var(--gold-border);border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(90deg,rgba(212,175,55,.1),transparent);padding:14px 16px;border-bottom:1px solid rgba(212,175,55,.15);display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:24px">${data.sign?.split(' ')[0]||'🔮'}</span>
            <div>
              <div style="font-size:13px;font-weight:800;color:var(--gold)">${data.sign||''}</div>
              <div style="font-size:10px;color:var(--text-dim)">${data.role ? data.role + ' · ' : ''}${data.date||''}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            ${(data.energy||[]).map(e=>`<span style="font-size:18px">${e}</span>`).join('')}
          </div>
        </div>
        <div style="padding:16px">
          <p style="font-size:14px;line-height:1.7;color:var(--text);margin-bottom:14px">${data.general||''}</p>
          ${data.work ? `<div style="background:rgba(90,175,122,.08);border:1px solid rgba(90,175,122,.2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--success);margin-bottom:4px">💼 Робота & Зміна</div>
            <div style="font-size:12px;color:var(--text-dim);line-height:1.6">${data.work}</div>
          </div>` : ''}
          ${data.civil ? `<div style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#a78bfa;margin-bottom:4px">🏠 Особисте життя</div>
            <div style="font-size:12px;color:var(--text-dim);line-height:1.6">${data.civil}</div>
          </div>` : ''}
          ${data.tip ? `<div style="background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);margin-bottom:4px">⭐ Порада дня</div>
            <div style="font-size:12px;color:var(--text-dim);line-height:1.6">${data.tip}</div>
          </div>` : ''}
          ${data.guest_type ? `<div style="background:rgba(236,72,153,.07);border:1px solid rgba(236,72,153,.2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#ec4899;margin-bottom:4px">👤 Гість дня</div>
            <div style="font-size:12px;color:var(--text-dim);line-height:1.6">${data.guest_type}</div>
          </div>` : ''}
          ${data.shift_prediction ? `<div style="background:rgba(126,200,227,.07);border:1px solid rgba(126,200,227,.2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#7ec8e3;margin-bottom:4px">🔮 Передбачення зміни</div>
            <div style="font-size:12px;color:var(--text-dim);line-height:1.6">${data.shift_prediction}</div>
          </div>` : ''}
          ${data.civil_prediction ? `<div style="background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fbbf24;margin-bottom:4px">🌙 Передбачення вечора</div>
            <div style="font-size:12px;color:var(--text-dim);line-height:1.6">${data.civil_prediction}</div>
          </div>` : ''}
          ${data.lucky ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            ${data.lucky.number !== undefined ? `<span style="background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.2);border-radius:8px;padding:4px 10px;font-size:11px;color:var(--gold)">🍀 Число: ${data.lucky.number}</span>` : ''}
            ${data.lucky.color ? `<span style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:4px 10px;font-size:11px;color:var(--text-dim)">🎨 Колір: ${data.lucky.color}</span>` : ''}
            ${data.lucky.time ? `<span style="background:rgba(126,200,227,.08);border:1px solid rgba(126,200,227,.2);border-radius:8px;padding:4px 10px;font-size:11px;color:#7ec8e3">⏰ Час: ${data.lucky.time}</span>` : ''}
            ${data.lucky.table !== undefined ? `<span style="background:rgba(90,175,122,.08);border:1px solid rgba(90,175,122,.2);border-radius:8px;padding:4px 10px;font-size:11px;color:var(--success)">🪑 Столик: ${data.lucky.table}</span>` : ''}
          </div>` : ''}
        </div>
      </div>`;
  },

  // Повертає рольовий контекст для промпту
  _getRoleContext(role) {
    const ctx = {
      waiter: {
        title: 'офіціанта',
        workLabel: 'Зміна офіціанта',
        workHint: 'обслуговування столів, гості, чайові, командна робота в залі',
        tipHint: 'порада дня для офіціанта — про гостей, замовлення, настрій у залі',
        guestHint: 'який гість-персонаж буде головним випробуванням офіціанта сьогодні — 1 влучне речення',
        shiftHint: 'містичне передбачення про зміну: гості, замовлення, чайові',
        tableField: true,
      },
      barman: {
        title: 'бармена',
        workLabel: 'Зміна бармена',
        workHint: 'коктейлі, барна стійка, швидкість приготування, постійні гості бару',
        tipHint: 'порада дня для бармена — про напої, гостей за стійкою, вайб бару',
        guestHint: 'який гість-персонаж прийде до барної стійки і дасть прикуритися — 1 влучне речення',
        shiftHint: 'містичне передбачення про зміну: коктейлі, бар, компанії',
        tableField: false,
      },
      sommelier: {
        title: "сомельє",
        workLabel: "Зміна сомельє",
        workHint: "винна карта, пейринг із стравами, презентація вин гостям, дегустації",
        tipHint: "порада дня для сомельє — про вина, гостей, правильний момент для рекомендації",
        guestHint: "який гість-персонаж запитає про «найдорожче вино» або скаже «мені щось без алкоголю» — 1 речення",
        shiftHint: "містичне передбачення: яке вино стане зіркою зміни і що скажуть зорі про дегустацію",
        tableField: false,
      },
      admin: {
        title: 'адміністратора',
        workLabel: 'Керування рестораном',
        workHint: 'координація команди, вирішення конфліктів, управлінські рішення, атмосфера в колективі',
        tipHint: 'порада дня для адміністратора — про команду, рішення, лідерство',
        guestHint: 'який тип гостя або ситуація вимагатиме особистого втручання адміністратора — 1 речення',
        shiftHint: 'містичне передбачення про зміну: команда, гості, несподівані ситуації',
        tableField: false,
      },
      cook: {
        title: 'кухаря',
        workLabel: 'Зміна на кухні',
        workHint: 'приготування страв, темп на кухні, командна робота з офіціантами, якість страв',
        tipHint: 'порада дня для кухаря — про страви, темп роботи, натхнення на кухні',
        guestHint: 'яке замовлення або ситуація на кухні стане головним випробуванням — 1 влучне речення',
        shiftHint: 'містичне передбачення про зміну: страви, кухня, темп роботи',
        tableField: false,
      },
    };
    // Для невідомих ролей — загальний
    return ctx[role] || ctx.waiter;
  },

  // ── Виклик Edge Function з передачею знаку — база гороскопу фетчиться там ──
  async _callClaude(zodiac, role) {
    const roleCtx = Horoscope._getRoleContext(role || 'waiter');
    const today = new Date().toLocaleDateString('uk-UA', {weekday:'long', day:'numeric', month:'long'});
    const tableFieldLine = roleCtx.tableField
      ? '"lucky": { "number": число від 1 до 99, "color": "колір", "time": "ЧЧ:ХХ", "table": число від 1 до 20 }'
      : '"lucky": { "number": число від 1 до 99, "color": "колір", "time": "ЧЧ:ХХ" }';

    const prompt = 'КРИТИЧНО ВАЖЛИВО: відповідай ВИКЛЮЧНО українською мовою. Жодних англійських слів, жодного іншого алфавіту крім українського та емодзі.\n\n'
      + 'Ти астролог-гуморист для команди ресторану "Тифліс". На основі реального астрологічного прогнозу — адаптуй його для ' + roleCtx.title + ' зі знаком ' + zodiac + ' на сьогодні (' + today + ').\n\n'
      + 'ВАЖЛИВО: не перекладай дослівно — переосмисли планетарні впливи крізь призму ресторанної роботи і особистого життя ' + roleCtx.title + '. Збережи суть і настрій астрологічного прогнозу.\n\n'
      + 'Гороскоп охоплює ДВА напрямки:\n'
      + '1. РОБОТА: ' + roleCtx.workHint + '\n'
      + '2. ЦИВІЛЬНЕ ЖИТТЯ: стосунки, здоров\'я, фінанси, хобі поза роботою\n\n'
      + 'Стиль: з теплом і легким гумором, але не банально — реальний астрологічний настрій дня має відчуватись.\n\n'
      + 'Відповідь ЛИШЕ у форматі JSON (без markdown, без пояснень):\n'
      + '{\n'
      + '  "sign": "' + zodiac + '",\n'
      + '  "role": "' + roleCtx.title + '",\n'
      + '  "date": "' + today + '",\n'
      + '  "energy": ["одне або два емодзі що відображають астрологічний настрій дня"],\n'
      + '  "general": "суть астрологічного дня адаптована для ' + roleCtx.title + ' — 2-3 речення",\n'
      + '  "work": "планетарні впливи у контексті роботи: ' + roleCtx.workHint + ' — 1-2 речення",\n'
      + '  "civil": "планетарні впливи у особистому житті поза роботою — 1-2 речення",\n'
      + '  "tip": "' + roleCtx.tipHint + ' — спирайся на астрологічний настрій дня",\n'
      + '  "guest_type": "' + roleCtx.guestHint + '",\n'
      + '  "shift_prediction": "' + roleCtx.shiftHint + '",\n'
      + '  "civil_prediction": "містичне передбачення для вечора — 1 речення",\n'
      + '  ' + tableFieldLine + '\n'
      + '}';

    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
      body: JSON.stringify({ action: 'generate_horoscope', prompt, zodiac })
    });
    if (!resp.ok) throw new Error('Edge Function error: ' + resp.status);
    const envelope = await resp.json();
    if (!envelope.ok) throw new Error(envelope.error || 'generate_horoscope failed');
    const text = (envelope.text || '').replace(/```json|```/g,'').trim();
    const sanitized = text.replace(/[⺀-⿿　-鿿가-퟿切-﫿︰-﹏]/g, '');
    try {
      return JSON.parse(sanitized);
    } catch(e) {
      console.error('Horoscope JSON parse error. Raw:', sanitized);
      throw new Error('Не вдалося розпарсити відповідь від AI');
    }
  },

  async generate() {
    if (Horoscope._loading) return;
    const zodiac = currentUser?.zodiac;
    if (!zodiac) { toast('Додай знак зодіаку в профіль', 'error'); return; }
    const role = currentUser?.role || 'waiter';
    await Horoscope._doGenerate(zodiac, role, 'horoscope-result', 'horoscope-gen-btn');
  },

  async generateFor(zodiac) {
    if (Horoscope._loading) return;
    const role = currentUser?.role || 'waiter';
    const cacheKey = 'horoscope_cache_' + new Date().toISOString().slice(0,10) + '_' + zodiac + '_' + role;
    const cached = (() => { try { return JSON.parse(localStorage.getItem(cacheKey)||'null'); } catch(e) { return null; } })();
    if (cached) { showModal(`<div class="modal-title">🔮 ${zodiac}</div>${Horoscope._renderCard(cached)}<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Закрити</button></div>`); return; }

    showModal(`<div class="modal-title">🔮 ${zodiac}</div><div id="modal-horoscope-loading" style="text-align:center;padding:40px"><div style="font-size:32px;margin-bottom:12px">🔮</div><div style="color:var(--text-dim);font-size:13px">Зорі говорять...</div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Закрити</button></div>`);
    Horoscope._loading = true;
    try {
      const result = await Horoscope._callClaude(zodiac, role);
      localStorage.setItem(cacheKey, JSON.stringify(result));
      const container = $('modal-horoscope-loading');
      if (container) container.outerHTML = Horoscope._renderCard(result);
    } catch(e) {
      console.error(e);
      const container = $('modal-horoscope-loading');
      if (container) container.innerHTML = '<div style="color:var(--danger);text-align:center;padding:20px">Помилка генерації. Спробуй ще раз.</div>';
    } finally { Horoscope._loading = false; }
  },

  async _doGenerate(zodiac, role, resultId, btnId) {
    Horoscope._loading = true;
    const btn = $(btnId);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Зорі говорять...'; }
    const resultEl = $(resultId);
    if (resultEl) resultEl.innerHTML = '<div style="text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:12px;animation:spin 2s linear infinite;display:inline-block">🔮</div><div style="color:var(--text-dim);font-size:13px;margin-top:8px">Читаємо зірки...</div></div>';
    try {
      const result = await Horoscope._callClaude(zodiac, role);
      const cacheKey = 'horoscope_cache_' + new Date().toISOString().slice(0,10) + '_' + zodiac + '_' + role;
      localStorage.setItem(cacheKey, JSON.stringify(result));
      if (resultEl) resultEl.innerHTML = Horoscope._renderCard(result);
      if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Оновити гороскоп'; }
    } catch(e) {
      console.error(e);
      if (resultEl) resultEl.innerHTML = '<div style="color:var(--danger);text-align:center;padding:20px">❌ Помилка. Перевір з\'єднання та спробуй ще раз.</div>';
      if (btn) { btn.disabled = false; btn.innerHTML = '✨ Спробувати ще раз'; }
      toast('Помилка генерації гороскопу', 'error');
    } finally { Horoscope._loading = false; }
  },

  // ── Гороскоп для вихідного дня ────────────────────────────────────────
  async _callClaudeOffDay(zodiac) {
    const today = new Date().toLocaleDateString('uk-UA', {weekday:'long', day:'numeric', month:'long'});

    const prompt = 'КРИТИЧНО ВАЖЛИВО: відповідай ВИКЛЮЧНО українською мовою. Жодних англійських слів, жодного іншого алфавіту крім українського та емодзі.\n\n'
      + 'Ти астролог-гуморист. На основі реального астрологічного прогнозу — адаптуй його для людини зі знаком ' + zodiac + ' на сьогодні (' + today + ').\n'
      + 'Сьогодні у неї ВИХІДНИЙ день — жодних згадок роботи, ресторану, гостей, зміни.\n'
      + 'Тільки особисте: кохання, друзі, прогулянки, здоров\'я, хобі, фінанси, настрій, відпочинок.\n\n'
      + 'ВАЖЛИВО: не перекладай дослівно — переосмисли астрологічний настрій дня крізь призму особистого вихідного.\n\n'
      + 'Стиль: з теплом і легким гумором, реальний астрологічний настрій має відчуватись.\n\n'
      + 'Відповідь ЛИШЕ у форматі JSON (без markdown, без пояснень):\n'
      + '{\n'
      + '  "sign": "' + zodiac + '",\n'
      + '  "date": "' + today + '",\n'
      + '  "energy": ["одне або два емодзі астрологічного настрою дня"],\n'
      + '  "general": "суть астрологічного дня для вихідного — 2-3 речення",\n'
      + '  "civil": "планетарні впливи у особистому дні — стосунки, друзі, прогулянки 1-2 речення",\n'
      + '  "tip": "порада для приємного вихідного спираючись на астрологічний настрій — 1 речення",\n'
      + '  "civil_prediction": "містичне передбачення для вечора вихідного — 1 речення",\n'
      + '  "lucky": { "number": число від 1 до 99, "color": "колір", "time": "ЧЧ:ХХ" }\n'
      + '}';

    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
      body: JSON.stringify({ action: 'generate_horoscope', prompt, zodiac })
    });
    if (!resp.ok) throw new Error('Edge Function error: ' + resp.status);
    const envelope = await resp.json();
    if (!envelope.ok) throw new Error(envelope.error || 'generate_horoscope failed');
    const text = (envelope.text || '').replace(/```json|```/g,'').trim();
    const sanitized = text.replace(/[⺀-⿿　-鿿가-퟿切-﫿︰-﹏]/g, '');
    try {
      return JSON.parse(sanitized);
    } catch(e) {
      console.error('Horoscope (off-day) JSON parse error. Raw:', sanitized);
      throw new Error('Не вдалося розпарсити відповідь від AI');
    }
  },

  // ── Щоранковий розсил о 11:00 ─────────────────────────────────────────
  async sendMorningHoroscopes() {
    const users = getUsers().filter(u => !u.fired && (u.chat_id || u.tg_id) && u.zodiac);
    if (!users.length) return;
    const today = new Date().toLocaleDateString('uk-UA', {weekday:'long', day:'numeric', month:'long'});
    const todayISO = new Date().toISOString().slice(0,10);
    const scheduleMap = DB.get('schedule', {});
    const WORKING_SHIFTS = ['Р', 'СН', 'Б', 'С', 'Р/Б', 'СН/Б'];

    const workingUsers = [];
    const offUsers     = [];
    for (const u of users) {
      const shift = (scheduleMap[`${u.id}_${todayISO}`] || '').trim();
      if (WORKING_SHIFTS.includes(shift)) workingUsers.push(u);
      else offUsers.push(u);
    }

    // ── Робочий гороскоп: групуємо по знак+роль ──────────────────────────
    const bySignRole = {};
    for (const u of workingUsers) {
      const role = u.role || 'waiter';
      const key = `${u.zodiac}::${role}`;
      if (!bySignRole[key]) bySignRole[key] = { zodiac: u.zodiac, role, members: [] };
      bySignRole[key].members.push(u);
    }
    for (const { zodiac, role, members } of Object.values(bySignRole)) {
      try {
        const result = await Horoscope._callClaude(zodiac, role);
        const cacheKey = 'horoscope_cache_' + todayISO + '_' + zodiac + '_' + role;
        try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(e) {}
        const roleCtx = Horoscope._getRoleContext(role);
        const msg = [
          `🔮 <b>Гороскоп на сьогодні</b>`,
          `${zodiac} · ${roleCtx.title} · ${today}`,
          ``,
          result.general,
          ``,
          result.work            ? `💼 <b>${roleCtx.workLabel}:</b> <i>${result.work}</i>`          : '',
          result.shift_prediction? `🔮 <i>${result.shift_prediction}</i>`                           : '',
          ``,
          result.civil           ? `🏠 <b>Особисте:</b> <i>${result.civil}</i>`                     : '',
          result.civil_prediction? `🌙 <i>${result.civil_prediction}</i>`                           : '',
          ``,
          result.tip   ? `⭐ ${result.tip}` : '',
          result.lucky ? `🍀 Щасливе число: <b>${result.lucky.number}</b> · Колір: ${result.lucky.color}${result.lucky.table ? ` · Столик: ${result.lucky.table}` : ''}` : '',
          ``,
          `<i>Портал персоналу · Тифліс</i>`
        ].filter(Boolean).join('\n');
        for (const u of members) {
          const destId = u.chat_id || u.tg_id;
          await tgSendPersonal(destId, msg);
        }
      } catch(e) { console.warn('Horoscope (work) send error for', zodiac, role, e); }
    }

    // ── Особистий гороскоп (вихідний): групуємо тільки по знаку ─────────
    const bySignOff = {};
    for (const u of offUsers) {
      if (!bySignOff[u.zodiac]) bySignOff[u.zodiac] = [];
      bySignOff[u.zodiac].push(u);
    }
    for (const [zodiac, members] of Object.entries(bySignOff)) {
      try {
        const result = await Horoscope._callClaudeOffDay(zodiac);
        const cacheKey = 'horoscope_cache_' + todayISO + '_' + zodiac + '_offday';
        try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(e) {}
        const msg = [
          `🌿 <b>Гороскоп на сьогодні</b> — твій вихідний!`,
          `${zodiac} · ${today}`,
          ``,
          result.general,
          ``,
          result.civil            ? `💛 <b>День:</b> <i>${result.civil}</i>`            : '',
          result.civil_prediction ? `🌙 <i>${result.civil_prediction}</i>`               : '',
          ``,
          result.tip   ? `⭐ ${result.tip}` : '',
          result.lucky ? `🍀 Щасливе число: <b>${result.lucky.number}</b> · Колір: ${result.lucky.color}` : '',
          ``,
          `<i>Портал персоналу · Тифліс</i>`
        ].filter(Boolean).join('\n');
        for (const u of members) {
          const destId = u.chat_id || u.tg_id;
          await tgSendPersonal(destId, msg);
        }
      } catch(e) { console.warn('Horoscope (off-day) send error for', zodiac, e); }
    }
  },
};
