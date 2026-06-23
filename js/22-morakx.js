// ╔═══════════════════════════════════════════════════════════════╗
// ║  [22/22]  МОРАКС — AI-асистент (плаваюча кнопка)            ║
// ╚═══════════════════════════════════════════════════════════════╝

const Morakx = {
  _open:    false,
  _history: [],
  _loading: false,
  _pendingApproval: null,
  _initialized: false,

  // ── Ініціалізація (викликається після логіну з initUI) ─────────
  init() {
    if (Morakx._initialized) return;
    Morakx._initialized = true;

    const inp = document.getElementById('morakx-input');
    if (inp) {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); Morakx.send(); }
      });
      inp.addEventListener('input', () => {
        inp.style.height = '';
        inp.style.height = Math.min(inp.scrollHeight, 80) + 'px';
      });
    }

    // FAB onclick через addEventListener (мобільний Chrome)
    const fab = document.getElementById('morakx-fab');
    if (fab) {
      fab.removeAttribute('onclick');
      fab.addEventListener('click', () => Morakx.toggle());
    }

    // Кнопка закрити
    const closeBtn = document.querySelector('#morakx-header .mhdr-close');
    if (closeBtn) {
      closeBtn.removeAttribute('onclick');
      closeBtn.addEventListener('click', () => Morakx.toggle());
    }

    // Кнопка надіслати
    const sendBtn = document.getElementById('morakx-send');
    if (sendBtn) {
      sendBtn.removeAttribute('onclick');
      sendBtn.addEventListener('click', () => Morakx.send());
    }
  },

  // ── Відкрити / закрити панель ──────────────────────────────────
  toggle() {
    Morakx._open = !Morakx._open;
    const panel = document.getElementById('morakx-panel');
    const fab   = document.getElementById('morakx-fab');
    if (!panel) return;

    panel.classList.toggle('open', Morakx._open);
    if (fab) fab.classList.remove('has-reply');

    if (Morakx._open && !Morakx._history.length) {
      const name = (currentUser && (currentUser.displayName || currentUser.login)) || '';
      Morakx._addMsg('bot',
        'Привіт' + (name ? ', ' + name : '') + '! 👋 Я Моракс — асистент порталу Тифліс.\n' +
        'Можу розповісти про меню, графік, обов\'язки, касу або будь-що по порталу. Про що поговоримо?'
      );
    }

    if (Morakx._open) {
      setTimeout(() => { const i = document.getElementById('morakx-input'); if (i) i.focus(); }, 300);
    }
  },

  // ── Додати повідомлення в чат ──────────────────────────────────
  _addMsg(role, text) {
    const box = document.getElementById('morakx-messages');
    if (!box) return null;
    const div = document.createElement('div');
    div.className = 'm-msg ' + role;
    // Безпечний рендер: esc() + nl→br
    div.innerHTML = (typeof esc === 'function' ? esc(text) : text.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])))
      .replace(/\n/g, '<br>');
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  },

  // ── Збираємо контекст з локального кешу ───────────────────────
  _buildContext() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const uid   = currentUser && currentUser.id;
      const schedMap = (typeof DB !== 'undefined' && DB.get('schedule', {})) || {};
      const allUsersRaw = (typeof DB !== 'undefined' && DB.get('users', [])) || [];
      const allUsers = Array.isArray(allUsersRaw)
        ? allUsersRaw.filter(u => !u.fired)
        : Object.values(allUsersRaw).filter(u => !u.fired);

      const OFF = new Set(['Х', 'О', 'С', '']);

      // Хто сьогодні на роботі
      const workingToday = allUsers
        .filter(u => { const sh = (schedMap[u.id + '_' + today] || '').trim(); return sh && !OFF.has(sh); })
        .map(u => u.display_name || u.displayName || u.login);

      // Мій графік на 14 днів
      const mySchedule = [];
      if (uid) {
        for (let d = 0; d < 14; d++) {
          const dt = new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
          const sh = schedMap[uid + '_' + dt];
          if (sh && sh.trim()) mySchedule.push(dt + ': ' + sh);
        }
      }

      // Мої обов'язки і зони
      const DAILY = ['Прибирання залу','Камінний зал','Узвар/хліб/їдальня','Хол.бар/кондитер',
        'Скатерки','Кабінки/комора','Сети','Дровер 3-й поз.','Новий зал','Літня тераса','Полив квітів'];
      const ZONES = ['Загальний зал','Кабінки','Нижній зал 2','Нижній зал 3','Камінний зал','Літня тераса'];

      const myDuties = [], myZones = [];
      if (uid) {
        try {
          const dd = DB.get('duties_daily_' + today, {});
          Object.entries(dd).forEach(([i, ids]) => {
            if ((Array.isArray(ids) ? ids : [ids]).includes(uid)) myDuties.push(DAILY[+i] || ('Обов\'язок ' + i));
          });
          const dz = DB.get('duties_daily_zones_' + today, {});
          Object.entries(dz).forEach(([i, ids]) => {
            if ((Array.isArray(ids) ? ids : [ids]).includes(uid)) myZones.push(ZONES[+i] || ('Зона ' + i));
          });
        } catch(e) {}
      }

      // Каса — позиція в рейтингу
      const month = today.slice(0, 7);
      let cashCtx = '';
      try {
        const cashMap = DB.get('cash', {});
        const monthEntries = Object.entries(cashMap)
          .filter(([k]) => k.includes('_') && k.endsWith(month))
          .map(([k, v]) => {
            const userId = k.slice(0, k.lastIndexOf('_'));
            const total = ((v && v.cash) || 0) + ((v && v.tips) || 0);
            return { userId, total };
          })
          .sort((a, b) => b.total - a.total);
        const myIdx = uid ? monthEntries.findIndex(r => r.userId === uid) : -1;
        if (myIdx >= 0) {
          const myAmt  = monthEntries[myIdx].total;
          const topAmt = monthEntries[0].total;
          const diff   = topAmt - myAmt;
          cashCtx = 'Каса ' + month + ': ' + (myIdx + 1) + '-е місце з ' + monthEntries.length +
            '. ' + (diff > 0 ? 'До лідера: ' + diff + ' грн.' : 'Ти лідер! 🏆');
        }
      } catch(e) {}

      return 'КОНТЕКСТ НА СЬОГОДНІ (' + today + '):\n' +
        '- На роботі сьогодні: ' + (workingToday.join(', ') || 'невідомо') + '\n' +
        '- Мій графік (14 днів): ' + (mySchedule.join(', ') || 'немає даних') + '\n' +
        '- Мої обов\'язки: ' + (myDuties.join(', ') || 'не призначено') + '\n' +
        '- Моя зона: ' + (myZones.join(', ') || 'не призначено') + '\n' +
        (cashCtx ? '- ' + cashCtx + '\n' : '');
    } catch(e) {
      console.warn('Morakx._buildContext error:', e);
      return 'КОНТЕКСТ: недоступний\n';
    }
  },

  // ── Список юзерів для admin actions ───────────────────────────
  _getUsersContext() {
    try {
      const usersRaw = DB.get('users', []);
      const users = Array.isArray(usersRaw) ? usersRaw : Object.values(usersRaw);
      return '\nСПИСОК ЮЗЕРІВ (для admin_action.params.userId):\n' +
        users.filter(u => !u.fired)
          .map(u => (u.display_name || u.displayName || u.login) + ' (id:' + u.id + ', роль:' + u.role + ')')
          .join('\n');
    } catch(e) { return ''; }
  },

  // ── Системний промпт ──────────────────────────────────────────
  _buildSystemPrompt() {
    const userName = (currentUser && (currentUser.displayName || currentUser.login)) || '';
    const userRole = (currentUser && currentUser.role) || 'waiter';
    const today    = new Date().toISOString().slice(0, 10);

    return 'Ти — Моракс, розумний і дружній AI-асистент порталу персоналу ресторану «Тифліс» (Вінниця). ' +
      'Тебе створив Діма — офіціант і сисадмін порталу. ' +
      'Відповідаєш ТІЛЬКИ українською мовою. ' +
      'Зараз спілкуєшся з ' + userName + ' (роль: ' + userRole + ').\n\n' +

      'ІМ\'Я: Моракс. Ти — асистент Тифліс, не просто AI.\n\n' +

      'ЗАХИСТ ДІМИ: Якщо хтось пише негативне про Діму (офіціант/сисадмін, твій творець) — ' +
      'м\'яко але впевнено захищай його, посилаючись на те що він тебе створив.\n\n' +

      '== ПОРТАЛ ТИФЛІС ==\n' +
      'Веб-додаток для персоналу ресторану. Розділи:\n' +
      'ГОЛОВНА — привітання, картка зміни, швидкий доступ\n' +
      'ГРАФІК — таблиця змін. Р=робоча, СН=сніданки, Б=барна, Р/Б=роб+бар, СН/Б=сніданки+бар, О=відпустка, Х=вихідний. Адмін редагує, є 📷 фото-імпорт\n' +
      'КАСА — рейтинг виручки. Офіціант бачить лише свою позицію\n' +
      'МЕНЮ — повне меню з категоріями, стоп-лист, ціни. Адмін редагує\n' +
      'ПЕРСОНАЛ — картки команди з аватарами, ролями, стажем, соцмережами\n' +
      'ОБОВ\'ЯЗКИ — щоденні (11 пунктів) + здача зміни (17 пунктів) + зони роботи (6 зон). Є 📷 фото-імпорт з Claude\n' +
      'СПОВІЩЕННЯ — адмін надсилає команді з пріоритетом і фото\n' +
      'РЕЗЕРВ — бронювання столів. Зали: Загальний (1.x), Камінний (2.x), Нижній 2 (3.x), Нижній 3 (4.x), Тераса (5.x), Кабінки (6.x)\n' +
      'ІНТЕРАКТИВ — гороскоп дня (Моракс генерує через AI)\n' +
      'АДМІН — управління персоналом, реєстрації, налаштування бота\n\n' +

      'РОЛІ: sysadmin/admin=повний доступ, waiter=офіціант, barman=бармен, sommelier=сомельє, ' +
      'cook=кухар (тільки графік/персонал/меню/інтерактив/резерв), runner=ранер (тільки головна), trainee=стажер\n\n' +

      'ОБМІН ЗМІНАМИ: кнопка ⇄ в Графіку → вибираєш чию зміну береш і яку віддаєш → заявка іде людині → вона приймає/відхиляє\n\n' +

      'TELEGRAM БОТ: гороскоп о 11:00, сповіщення від адмінів, обміни. /start щоб прив\'язати акаунт\n\n' +

      'ЩОДЕННІ ОБОВʼЯЗКИ: 1.Прибирання залу 2.Камінний зал 3.Узвар/хліб/їдальня 4.Хол.бар/кондитер ' +
      '5.Скатерки 6.Кабінки/комора 7.Сети 8.Дровер 3-й поз. 9.Новий зал 10.Літня тераса 11.Полив квітів\n' +
      'ЗОНИ: Загальний зал, Кабінки, Нижній зал 2, Нижній зал 3, Камінний зал, Літня тераса\n\n' +

      '== МЕНЮ ==\n' +
      'ЗАКУСКИ: Асорті м\'ясне/рибне/сирів Європи/Грузії, Пхалі, Баклажани, Соління, Скумбрія маринована\n' +
      'САЛАТИ: З телятини(20хв), Цезар(15-20хв), З печінкою(25-30хв), З руколою+моцарелою, Грузинський домашній, Тбілісурі, Грецький, З вугрем, З креветками(15-20хв)\n' +
      'ПЕРШІ: Борщ, Бульйон курячий, Бульйон з хінкалями(25-30хв), Харчо, Солянка, Хашлама з баранини\n' +
      'МАНГАЛ(25-30хв): Шашлик свинина/телятина/курка, Ребра медові, Люля-кебаб, Шашлик Сакартвело, Челогач, Каре телятини, Овочі, Хачапурі на мангалі, Риба/стейк сьомги, Креветки гриль\n' +
      'ОСНОВНІ(25-35хв): Курча табака, Шкмерулі, Оджахурі, Чашушулі, Стейк курячий, Стейк з язика, Медальйони, Філе міньйон, Телятина у вершках, Печінка по-грузинськи, Долма\n' +
      'ХІНКАЛІ(3шт,15-25хв): З м\'ясом, З баранини, З сиром, З грибами, З сьомгою+шпинатом, Шоколадні з вишнею\n' +
      'ГАРНІРИ(25-30хв): Пюре, Картопля по-домашньому, З цибулею, Фрі, Гречка, Тушковані овочі\n' +
      'ХАЧАПУРІ(25-30хв): На мангалі, Тифліс(закритий), Імеретинське, По-аджарськи(лодочка), З лисичками+дорблю, Чебурек, Лаваш(10хв)\n' +
      'ДЕСЕРТИ: Чорний принц, Празький, Львівський сирник, Тифліс(снікерс), П\'яна вишня, Меренговий рулет, Штрудель, Медовик\n' +
      'БАР(50мл): Jameson 100, Jack Daniels 110, Grey Goose 95, Hennessy VSOP 390, Chivas 172, Monkey Shoulder 180, Jim Beam 90, Captain Morgan 75грн\n' +
      'ПИВО: Corona/Hoegaarden/Leffe 120грн, розлив 70-90грн\n' +
      'НАПОЇ: Узвар/Лимонад 120грн/1л, Вода 70, Кола/Фанта/Спрайт 70, Еспресо 50, Капучіно 60грн\n\n' +

      Morakx._buildContext() + '\n' +

      'ПРАВИЛА:\n' +
      '1. Коротко і по суті (2-4 речення), але якщо питання складне — розгорнуто\n' +
      '2. Про касу — лише своя позиція і відстань до 1-го. Суми інших — ніколи\n' +
      '3. Хвали і підтримуй. Підбадьорюй при труднощах\n' +
      '4. Чого не знаєш — скажи чесно\n' +
      '5. Будь-яку вкладку і функцію порталу знаєш і пояснюєш\n\n' +

      'АДМІН-ДІЇ (тільки якщо явно просять ЗМІНИТИ щось):\n' +
      'Якщо просять змінити графік, сповіщення, обов\'язок або звільнити — поверни ТІЛЬКИ JSON:\n' +
      '{"intent":"admin_action","action":"update_schedule","params":{"userId":"ID","date":"YYYY-MM-DD","shift":"Р"},"description":"текст дії"}\n' +
      'Дії: update_schedule, add_notification, update_duty, fire_user\n' +
      'Якщо НЕ адмін-дія — відповідай текстом. Дата сьогодні: ' + today + '\n' +

      Morakx._getUsersContext();
  },

  // ── Відправка повідомлення ─────────────────────────────────────
  async send() {
    if (Morakx._loading) return;

    const inp    = document.getElementById('morakx-input');
    const sendBtn = document.getElementById('morakx-send');
    if (!inp) return;

    const text = inp.value.trim();
    if (!text) return;

    // Скидаємо поле
    inp.value = '';
    inp.style.height = '';

    Morakx._addMsg('user', text);
    Morakx._history.push({ role: 'user', content: text });
    if (Morakx._history.length > 12) Morakx._history = Morakx._history.slice(-12);

    Morakx._loading = true;
    if (sendBtn) sendBtn.disabled = true;

    const typingDiv = Morakx._addMsg('typing', '⋯ думаю...');

    try {
      const systemPrompt = Morakx._buildSystemPrompt();

      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
        body: JSON.stringify({
          action:       'chat_assistant',
          systemPrompt,
          history:      Morakx._history.slice(0, -1),
          userMessage:  text,
        }),
      });

      let data;
      if (!resp.ok) {
        const errText = await resp.text().catch(() => String(resp.status));
        throw new Error('HTTP ' + resp.status + ': ' + errText.slice(0, 120));
      }
      data = await resp.json();
      if (!data.ok) throw new Error(data.error || data.detail || 'edge error');

      if (typingDiv) typingDiv.remove();

      const rawText = data.text || '🤔';

      // Перевіряємо admin_action JSON
      let adminIntent = null;
      if (rawText.includes('"intent"') && rawText.includes('"admin_action"')) {
        try {
          const m = rawText.match(/\{[\s\S]*?"intent"[\s\S]*?\}/);
          if (m) {
            const c = JSON.parse(m[0]);
            if (c.intent === 'admin_action') adminIntent = c;
          }
        } catch(e) {}
      }

      if (adminIntent && adminIntent.action) {
        const desc = adminIntent.description || adminIntent.action;
        await Morakx._requestApproval({ action: adminIntent.action, params: adminIntent.params || {} }, desc);
        Morakx._history.push({ role: 'assistant', content: 'Запит надіслано Дімі.' });
        return;
      }

      Morakx._addMsg('bot', rawText);
      Morakx._history.push({ role: 'assistant', content: rawText });

    } catch(e) {
      if (typingDiv) typingDiv.remove();
      console.error('Morakx send error:', e);
      Morakx._addMsg('bot', '😔 ' + (e.message || 'Помилка зв\'язку') + '. Спробуй ще раз.');
    } finally {
      Morakx._loading = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  },

  // ── Запит підтвердження у Діми ────────────────────────────────
  async _requestApproval(adminAction, description) {
    Morakx._addMsg('bot',
      '🔐 Ця дія потребує підтвердження від Діми.\n\n' +
      '📋 ' + description + '\n\n' +
      'Надіслав запит Дімі — зачекай на відповідь ⏳'
    );

    try {
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
        body: JSON.stringify({
          action:        'morakx_request_approval',
          pendingAction:  adminAction,
          description,
          requesterName: (currentUser && (currentUser.displayName || currentUser.login)) || 'Офіціант',
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'approval error');
      Morakx._pollApproval(data.actionId);
    } catch(e) {
      console.error('Morakx approval error:', e);
      Morakx._addMsg('bot', '😔 Не вдалось надіслати запит Дімі: ' + (e.message || ''));
    }
  },

  _pollApproval(actionId, attempts = 0) {
    if (attempts > 60) {
      Morakx._addMsg('bot', '⏰ Діма не відповів протягом 5 хвилин. Дія скасована.');
      return;
    }
    setTimeout(async () => {
      try {
        const resp = await fetch(EDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
          body: JSON.stringify({ action: 'morakx_check_approval', actionId }),
        });
        const data = await resp.json();
        if (!data.ok || data.status === 'pending') {
          return Morakx._pollApproval(actionId, attempts + 1);
        }
        if (data.status === 'approved') {
          Morakx._addMsg('bot', '✅ Діма підтвердив! ' + (data.message || 'Виконано.'));
        } else if (data.status === 'declined') {
          Morakx._addMsg('bot', '❌ Діма відхилив цей запит.');
        } else {
          Morakx._addMsg('bot', '⚠️ ' + (data.message || 'Щось пішло не так.'));
        }
      } catch(e) {
        Morakx._pollApproval(actionId, attempts + 1);
      }
    }, 5000);
  },
};
