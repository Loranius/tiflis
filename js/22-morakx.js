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

      'ДІЇ ЯКІ МОЖЕ РОБИТИ МОРАКС (поверни JSON ТІЛЬКИ якщо явно просять виконати дію):\n\n' +

      '1) ОБМІН ЗМІНИ — якщо поточний юзер хоче помінятись зміною з кимось:\n' +
      '{"intent":"swap_request","targetName":"Ім\'я","targetDate":"YYYY-MM-DD","myDate":"YYYY-MM-DD або null","comment":"текст або null"}\n' +
      'targetDate = дата ЦІЛЬОВОЇ людини яку хочуть взяти. myDate = дата своєї зміни яку віддають (або null якщо без зустрічної).\n\n' +

      '2) ЗАПРОПОНУВАТИ ОБМІН МІЖ ДВОМА ЛЮДЬМИ (тільки якщо адмін або роль sysadmin):\n' +
      '{"intent":"propose_swap","person1":"Ім\'я1","person2":"Ім\'я2","date1":"YYYY-MM-DD","date2":"YYYY-MM-DD або null"}\n' +
      'person1 бере date1 у person2. Якщо date2 — person2 бере date2 у person1.\n\n' +

      '3) АДМІН-ДІЇ (тільки якщо роль admin/sysadmin — явно просять ЗМІНИТИ щось):\n' +
      '{"intent":"admin_action","action":"update_schedule","params":{"userId":"ID","date":"YYYY-MM-DD","shift":"Р"},"description":"текст дії"}\n' +
      'Дії: update_schedule, add_notification, update_duty, fire_user\n\n' +

      'ВАЖЛИВО:\n' +
      '- Якщо НЕ дія — відповідай текстом (НЕ JSON)\n' +
      '- Якщо не вистачає інфо (з ким, коли) — запитай уточнення текстом\n' +
      '- swap_request і propose_swap доступні всім. admin_action — тільки адміну\n' +
      '- Дата сьогодні: ' + today + '\n' +

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

      // Парсимо JSON-інтент з відповіді
      // Покращений парсер що враховує вкладені {}
      let parsedIntent = null;
      if (rawText.includes('"intent"')) {
        try {
          // Знаходимо перший { і знаходимо відповідну закриваючу }
          const start = rawText.indexOf('{');
          if (start >= 0) {
            let depth = 0, end = -1;
            for (let i = start; i < rawText.length; i++) {
              if (rawText[i] === '{') depth++;
              else if (rawText[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
            }
            if (end > start) {
              const candidate = JSON.parse(rawText.slice(start, end + 1));
              if (candidate && candidate.intent) parsedIntent = candidate;
            }
          }
        } catch(e) {}
      }

      // ── ОБМІН ЗМІНИ (сам юзер хоче помінятись) ──────────────────
      if (parsedIntent?.intent === 'swap_request') {
        await Morakx._handleSwapRequest(parsedIntent);
        Morakx._history.push({ role: 'assistant', content: 'Обробляю запит на обмін...' });
        return;
      }

      // ── ПРОПОЗИЦІЯ ОБМІНУ МІЖ ДВОМА ЛЮДЬМИ (адмін) ─────────────
      if (parsedIntent?.intent === 'propose_swap') {
        await Morakx._handleProposeSwap(parsedIntent);
        Morakx._history.push({ role: 'assistant', content: 'Пропозицію обміну надіслано.' });
        return;
      }

      // ── АДМІН-ДІЯ (зміна графіку, сповіщення тощо) ──────────────
      if (parsedIntent?.intent === 'admin_action' && parsedIntent.action) {
        const desc = parsedIntent.description || parsedIntent.action;
        await Morakx._requestApproval({ action: parsedIntent.action, params: parsedIntent.params || {} }, desc);
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

  // ── Обмін зміни (сам юзер) ──────────────────────────────────────
  async _handleSwapRequest(intent) {
    const { targetName, targetDate, myDate, comment } = intent;

    // Знаходимо цільового юзера локально
    const usersRaw = DB.get('users', []);
    const users = Array.isArray(usersRaw) ? usersRaw : Object.values(usersRaw);
    const tName = (targetName || '').toLowerCase().trim();
    const targetUser = users.find(u => {
      const dn = (u.display_name || u.displayName || u.login || '').toLowerCase();
      return dn.includes(tName) || tName.includes(dn.split(' ')[0]);
    });

    if (!targetUser) {
      Morakx._addMsg('bot', `😕 Не знайшов офіціанта «${targetName}» в системі. Перевір ім'я.`);
      return;
    }

    const tUserName = targetUser.display_name || targetUser.displayName || targetUser.login;

    const _dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!_dateRe.test(targetDate || '')) {
      Morakx._addMsg('bot', `❓ Не зрозумів дату «${targetDate}». Вкажи конкретніше, наприклад: «хочу помінятись з ${tUserName}, він/вона бере моє 25 червня».`);
      return;
    }
    if (myDate && !_dateRe.test(myDate)) {
      Morakx._addMsg('bot', `❓ Не зрозумів дату «${myDate}». Вкажи конкретніше.`);
      return;
    }
    const schedMap = DB.get('schedule', {});
    const targetShift = (schedMap[targetUser.id + '_' + targetDate] || 'Х').trim();
    const fromShift   = myDate ? (schedMap[(currentUser && currentUser.id) + '_' + myDate] || 'Х').trim() : null;

    const MONTHS = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
    const fmtD = (d) => { if (!d) return '—'; const [,m,day] = d.split('-').map(Number); return `${day} ${MONTHS[m-1]}`; };

    const _previewText =
      `🔄 Запит на обмін\n\n` +
      `👤 З ким: ${tUserName}\n` +
      `📅 Ти береш: ${fmtD(targetDate)} [${targetShift}]\n` +
      (myDate ? `🔁 ${tUserName} бере: ${fmtD(myDate)} [${fromShift}]\n` : `ℹ️ Без зустрічної зміни\n`) +
      (comment ? `💬 ${comment}\n` : '');

    try {
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
        body: JSON.stringify({
          action:      'morakx_swap_request',
          fromId:      (currentUser && currentUser.id) || '',
          fromName:    (currentUser && (currentUser.displayName || currentUser.login)) || '',
          targetId:    targetUser.id,
          targetName:  tUserName,
          targetDate,
          targetShift,
          myDate:      myDate || null,
          fromShift:   fromShift || null,
          comment:     comment || null,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'swap error');
      Morakx._addMsg('bot', _previewText + `\n✅ Надіслано ${tUserName} в Telegram. Як тільки відповість — бот повідомить.`);
    } catch(e) {
      console.error('swap request error:', e);
      Morakx._addMsg('bot', _previewText + '\n\n😔 Помилка: ' + (e.message || 'перевір підключення'));
    }
  },

  // ── Пропозиція обміну між двома людьми (адмін) ───────────────────
  async _handleProposeSwap(intent) {
    const { person1, person2, date1, date2 } = intent;

    const usersRaw = DB.get('users', []);
    const users = Array.isArray(usersRaw) ? usersRaw : Object.values(usersRaw);
    const findU = (name) => {
      const n = (name || '').toLowerCase().trim();
      return users.find(u => {
        const dn = (u.display_name || u.displayName || u.login || '').toLowerCase();
        return dn.includes(n) || n.includes(dn.split(' ')[0]);
      });
    };

    const p1 = findU(person1);
    const p2 = findU(person2);

    if (!p1 || !p2) {
      Morakx._addMsg('bot', `😕 Не знайшов: «${!p1 ? person1 : person2}». Перевір ім'я.`);
      return;
    }

    const schedMap = DB.get('schedule', {});
    const MONTHS = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
    const fmtD = (d) => { if (!d) return '—'; const [,m,day] = d.split('-').map(Number); return `${day} ${MONTHS[m-1]}`; };

    const p1Name = p1.display_name || p1.displayName || p1.login;
    const p2Name = p2.display_name || p2.displayName || p2.login;
    const sh1 = (schedMap[p2.id + '_' + date1] || 'Х').trim(); // зміна p2 яку бере p1
    const sh2 = date2 ? (schedMap[p1.id + '_' + date2] || 'Х').trim() : null;

    // Валідація дат
    const _pDateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!_pDateRe.test(date1 || '')) {
      Morakx._addMsg('bot', `❓ Не зрозумів дату «${date1}». Вкажи у форматі 25 червня.`);
      return;
    }
    if (date2 && !_pDateRe.test(date2)) {
      Morakx._addMsg('bot', `❓ Не зрозумів дату «${date2}». Вкажи у форматі 25 червня.`);
      return;
    }

    const _propPreview =
      `🔄 Пропозиція обміну\n\n` +
      `👤 ${p1Name} бере: ${fmtD(date1)} [${sh1}] від ${p2Name}\n` +
      (date2 ? `🔁 ${p2Name} бере: ${fmtD(date2)} [${sh2}] від ${p1Name}\n` : `ℹ️ Без зустрічної\n`);

    try {
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
        body: JSON.stringify({
          action:    'morakx_propose_swap',
          adminName: (currentUser && (currentUser.displayName || currentUser.login)) || '',
          p1Id: p1.id, p1Name, p1TgId: p1.tg_id || p1.chat_id || null,
          p2Id: p2.id, p2Name, p2TgId: p2.tg_id || p2.chat_id || null,
          date1, shift1: sh1,
          date2: date2 || null, shift2: sh2 || null,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'propose error');
      Morakx._addMsg('bot',
        _propPreview +
        `\n✅ Запит надіслано ${p1Name} в Telegram.\n` +
        `${p2Name} також отримає повідомлення.`
      );
    } catch(e) {
      console.error('propose swap error:', e);
      Morakx._addMsg('bot', _propPreview + '\n\n😔 Помилка: ' + (e.message || 'перевір підключення'));
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

  _pollTimers: {},

  _pollApproval(actionId, attempts = 0) {
    if (Morakx._pollTimers[actionId]) clearTimeout(Morakx._pollTimers[actionId]);
    if (attempts > 60) { delete Morakx._pollTimers[actionId];
      Morakx._addMsg('bot', '⏰ Діма не відповів протягом 5 хвилин. Дія скасована.');
      return;
    }
    Morakx._pollTimers[actionId] = setTimeout(async () => {
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
        delete Morakx._pollTimers[actionId];
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
