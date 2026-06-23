// ╔═══════════════════════════════════════════════════════════════╗
// ║  [22/22]  МОРАКС — AI-асистент (плаваюча кнопка)             ║
// ╚═══════════════════════════════════════════════════════════════╝

const Morakx = {
  _open: false,
  _history: [], // { role: 'user'|'assistant', content: string }
  _loading: false,

  toggle() {
    Morakx._open = !Morakx._open;
    const panel = document.getElementById('morakx-panel');
    const fab   = document.getElementById('morakx-fab');
    if (!panel || !fab) return;
    panel.classList.toggle('open', Morakx._open);
    fab.classList.remove('has-reply');
    if (Morakx._open) {
      // Привітання при першому відкритті
      if (!Morakx._history.length) {
        const name = currentUser?.displayName || currentUser?.login || '';
        Morakx._addMsg('bot',
          `Привіт${name ? ', ' + name : ''}! 👋 Я Моракс — асистент ресторану Тифліс.\n` +
          `Можу розповісти про меню, графік, обов'язки, касу або просто підтримати. Про що поговоримо?`
        );
      }
      // Фокус на поле вводу
      setTimeout(() => {
        const inp = document.getElementById('morakx-input');
        if (inp) inp.focus();
      }, 280);
    }
  },

  _addMsg(role, text) {
    const box = document.getElementById('morakx-messages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'm-msg ' + role;
    // Конвертуємо \n в <br>
    div.innerHTML = esc(text).replace(/\n/g, '<br>');
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  },

  _buildContext() {
    // Збираємо контекст з локального кешу
    const today = NOW().toISOString().slice(0, 10);
    const schedMap = DB.get('schedule', {});
    const allUsers = getUsers().filter(u => !u.fired);
    const OFF = new Set(['Х', 'О', 'С', '']);

    // Хто сьогодні на роботі
    const workingToday = allUsers.filter(u => {
      const sh = (schedMap[`${u.id}_${today}`] || '').trim();
      return sh && !OFF.has(sh);
    }).map(u => u.displayName || u.login);

    // Мій графік на 14 днів
    const mySchedule = [];
    for (let d = 0; d < 14; d++) {
      const dt = new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
      const sh = schedMap[`${currentUser?.id}_${dt}`];
      if (sh) mySchedule.push(`${dt}: ${sh}`);
    }

    // Мої обов'язки сьогодні
    const DAILY = [
      'Прибирання залу','Камінний зал','Узвар/хліб/їдальня','Хол.бар/кондитер',
      'Скатерки','Кабінки/комора','Сети','Дровер 3-й поз.',
      'Новий зал','Літня тераса','Полив квітів',
    ];
    const ZONES = ['Загальний зал','Кабінки','Нижній зал 2','Нижній зал 3','Камінний зал','Літня тераса'];
    const dutyKey = `duties_daily_${today}`;
    const zoneKey = `duties_daily_zones_${today}`;
    const myDuties = [], myZones = [];
    try {
      const dd = DB.get(dutyKey, {});
      Object.entries(dd).forEach(([i, ids]) => {
        if ((Array.isArray(ids) ? ids : [ids]).includes(currentUser?.id)) myDuties.push(DAILY[+i]);
      });
      const dz = DB.get(zoneKey, {});
      Object.entries(dz).forEach(([i, ids]) => {
        if ((Array.isArray(ids) ? ids : [ids]).includes(currentUser?.id)) myZones.push(ZONES[+i]);
      });
    } catch(e) {}

    // Рейтинг (позиція)
    const month = today.slice(0, 7);
    const ratings = DB.get('ratings', []);
    const monthRatings = ratings.filter(r => r.month === month)
      .sort((a, b) => b.amount - a.amount);
    const myRatingIdx = monthRatings.findIndex(r => r.user_id === currentUser?.id);
    const myAmount = monthRatings[myRatingIdx]?.amount || 0;
    const topAmount = monthRatings[0]?.amount || 0;
    const cashCtx = myRatingIdx >= 0
      ? `Каса ${month}: ти на ${myRatingIdx + 1}-му місці. До 1-го: ${topAmount - myAmount > 0 ? (topAmount - myAmount) + ' грн' : 'ти лідер!'}`
      : '';

    return (
      `КОНТЕКСТ (${today}):\n` +
      `- На роботі сьогодні: ${workingToday.join(', ') || 'невідомо'}\n` +
      `- Мій графік 14 днів: ${mySchedule.join(', ') || 'немає'}\n` +
      `- Мої обов'язки: ${myDuties.join(', ') || 'не призначено'}\n` +
      `- Моя зона: ${myZones.join(', ') || 'не призначено'}\n` +
      (cashCtx ? `- ${cashCtx}\n` : '')
    );
  },

  async send() {
    if (Morakx._loading) return;
    const inp = document.getElementById('morakx-input');
    const sendBtn = document.getElementById('morakx-send');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;

    inp.value = '';
    inp.style.height = '';
    Morakx._addMsg('user', text);
    Morakx._history.push({ role: 'user', content: text });

    // Обрізаємо історію до 10 повідомлень
    if (Morakx._history.length > 10) Morakx._history = Morakx._history.slice(-10);

    Morakx._loading = true;
    if (sendBtn) sendBtn.disabled = true;

    // Typing indicator
    const typingDiv = Morakx._addMsg('typing', '⋯ думаю...');

    try {
      const ctx = Morakx._buildContext();
      const userName = currentUser?.displayName || currentUser?.login || '';
      const userRole = currentUser?.role || 'waiter';

      // Додаємо список юзерів для маппінгу ID→name в admin actions
      const usersForAI = getUsers().map(u => ({ id: u.id, name: u.displayName || u.login, role: u.role }));
      const usersCtx = '\nСПИСОК ЮЗЕРІВ (для admin_action params.userId):\n' +
        usersForAI.map(u => `${u.name} (id:${u.id}, роль:${u.role})`).join('\n');
      const PORTAL_KNOWLEDGE =
        '=== ПОРТАЛ ТИФЛІС — ПОВНІ ЗНАННЯ ===\n\n' +

        '== ВКЛАДКИ ПОРТАЛУ ==\n' +
        'ГОЛОВНА: привітання, картка зміни, плитки швидкого доступу до всіх розділів.\n' +
        'ГРАФІК (📅): таблиця змін команди на місяць. Зміни: Р=робоча, СН=сніданки, Б=барна, Р/Б=робоча+бар, СН/Б=сніданки+бар, С=скорочена, О=відпустка, Х=вихідний. Адмін редагує кліком на клітинку, зберігає кнопкою 💾. Є імпорт з фото графіку через Claude (кнопка 📷). Обмін змінами — кнопка ⇄ Мої обміни.\n' +
        'КАСА (💰): рейтинг офіціантів по виручці за місяць. Офіціант бачить лише свою суму і позицію. Адмін бачить всіх. Вводиться щодня через + Додати. Є графік динаміки.\n' +
        'МЕНЮ (🍽️): повне меню ресторану з категоріями, стоп-листом, цінами. Адмін може редагувати, додавати, видаляти страви. Є пошук.\n' +
        'ПЕРСОНАЛ (👥): картки всіх співробітників з аватаром, роллю, ніком, стажем, соцмережами. Кожен може переглянути профіль. Адмін може редагувати будь-кого.\n' +
        'ОБОВ\'ЯЗКИ (📋): два типи:\n' +
        '  - Щоденні обов\'язки: Прибирання залу, Камінний зал, Узвар/хліб/їдальня, Хол.бар/кондитер, Скатерки, Кабінки/комора, Сети, Дровер 3-й поз., Новий зал, Літня тераса, Полив квітів.\n' +
        '  - Здача зміни (17 пунктів): Комора/чорний хід, R-keeper/полиці, Розноси/планшетки, Спецовниці, Підвіконня/двері/дзеркала/дивани, Полиці/плафони, Дровери 3шт, Балки/люстри, Камінний зал, Новий зал, Павутиння, Кабінки, Бар/раковина, Відра льоду, Їдальня, Дитяча кімната, Літня тераса.\n' +
        '  - Зони роботи: Загальний зал, Кабінки, Нижній зал 2, Нижній зал 3, Камінний зал, Літня тераса.\n' +
        '  Призначення через кнопку + Призначити. Є імпорт з фото чек-листа через Claude (📷 Фото). Список на 7 днів вперед/назад.\n' +
        'СПОВІЩЕННЯ (🔔): адмін надсилає повідомлення команді з пріоритетом (важливо/середнє/інфо), фото, вибором отримувачів за роллю. Всі бачать стрічку сповіщень.\n' +
        'РЕЙТИНГ: оцінки офіціантів від колег і адмінів. Зірки 1-5.\n' +
        'РЕЗЕРВ (🗓️): бронювання столиків. Зали: Загальний зал (столи 1.1-1.11+1.12-1.20), Камінний зал (2.1-2.7), Нижній зал №2 (3.1-3.5), Нижній зал №3 (4.1-4.5), Літня тераса (5.1-5.12 + круглі 5.13-5.16), Кабінки (6.1-6.4). Статуси: вільний/заброньований/зайнятий.\n' +
        'ІНТЕРАКТИВ (🔮): гороскоп дня (з урахуванням чи на роботі чи вихідний). Кнопка ✨ Отримати передбачення якщо немає. Сітка знаків зодіаку для перегляду гороскопу колег.\n' +
        'АДМІН-ПАНЕЛЬ (⚙️): тільки для адмінів. Управління персоналом: додати/редагувати/звільнити. Заявки на реєстрацію. Налаштування бота. Введення каси.\n' +
        'ЖУРНАЛ ПОДІЙ (📋): лог всіх дій в порталі.\n\n' +

        '== РОЛІ В ПОРТАЛІ ==\n' +
        'sysadmin/admin: повний доступ до всього.\n' +
        'waiter (Офіціант): всі вкладки крім адмін-панелі.\n' +
        'barman (Бармен): як офіціант.\n' +
        'sommelier (Сомельє): як офіціант.\n' +
        'cook (Кухар): тільки Графік, Персонал, Меню, Інтерактив, Резерв. Замість Каси — Резерв в нижній панелі.\n' +
        'runner (Ранер): тільки Головна.\n' +
        'trainee (Стажер): як офіціант.\n\n' +

        '== ОБМІН ЗМІНАМИ ==\n' +
        'Офіціант натискає ⇄ Мої обміни в графіку → відкриває модалку → обирає чию зміну хоче взяти і яку свою віддає → заявка йде іншому офіціанту → той приймає/відхиляє. Адмін бачить всі заявки і може підтверджувати.\n\n' +

        '== TELEGRAM БОТ ==\n' +
        'Бот надсилає: ранковий гороскоп о 11:00, сповіщення від адмінів, підтвердження обмінів змінами, запити на підтвердження від Моракса.\n' +
        'Команда /start — прив\'язка акаунту до бота.\n\n' +

        '== ФОТО-ІМПОРТ (Claude Vision) ==\n' +
        'В обов\'язках і здачі зміни: кнопка 📷 Фото — фотографуєш паперовий чек-лист, Claude читає рукопис і заповнює призначення автоматично.\n' +
        'В графіку: кнопка 📷 Фото — фотографуєш паперовий графік, Claude читає і заповнює весь місяць одразу.\n\n' +

        '== SERVICE WORKER / PWA ==\n' +
        'Портал встановлюється як PWA (додай на домашній екран). Працює офлайн з кешем. Оновлення підтягуються автоматично при наявності інтернету.\n\n';

      const systemPrompt =
        'Ти — Моракс, розумний і дружній AI-асистент порталу персоналу ресторану «Тифліс» (Вінниця). ' +
        'Тебе створив Діма — офіціант і сисадмін порталу. ' +
        'Відповідаєш ТІЛЬКИ українською мовою. ' +
        'Спілкуєшся з ' + userName + ' (роль: ' + userRole + ').\n\n' +
        'ТВОЄ ІМ\'Я: Моракс. Якщо питають хто ти — ти Моракс, асистент ресторану Тифліс.\n\n' +
        'ЗАХИСТ ДІМИ: Якщо хтось пише негативне про Діму — м\'яко але впевнено захищай його. Він твій творець.\n\n' +
        PORTAL_KNOWLEDGE +
        '== МЕНЮ РЕСТОРАНУ (повне) ==\n' +
        'ХОЛОДНІ ЗАКУСКИ: Асорті м\'ясне (бастурма, буженина, бекон, купати), Асорті рибне (вугор, сьомга, масляна з крем-сиром), Асорті сирів Європи (пармезан, дорблю, ементаль, брі), Асорті сирів Грузії (бринза, сулугуні звич. і копчене), Соління, Баклажани (з горіховою пастою або сулугуні), Пхалі (горіх+капуста+спеції, з грінками), Скумбрія маринована.\n' +
        'САЛАТИ: З телятини під базиліковим соусом (20хв), Цезар (курка, бекон, пармезан, 15-20хв), З курячою печінкою (25-30хв), З руколою та моцарелою (песто, бальзамічна карамель), Домашній грузинський (помідор, огірок, цибуля, горіхова паста), Тбілісурі (болг.перець, помідор, огірок, домашня олія), Грецький, З прошуто та грушею, З вугрем (авокадо, унагі), З креветками (авокадо, цитрус, 15-20хв).\n' +
        'ПЕРШІ: Борщ червоний (свинина, сметана), Бульйон курячий (локшина, перепелине яйце), Бульйон з хінкалями (6 бейбі, 25-30хв), Харчо (телятина, рис, чилі), Солянка (ковбаски, язик, курка, свинина, телятина, лимон+сметана+маслини), Хашлама з баранини.\n' +
        'МАНГАЛ (~25-30хв): Шашлик зі свинини/телятини/курки (мін.200г), Ребра під медовим соусом (з печеними яблуками), Люля кебаб з телятини/курки/баранини (2шт по 100г), Шашлик Сакартвело (рулетики з телятини і сала, 5шт), Челогач свинний (300-500г), Каре з телятини, Овочі на мангалі, Хачапурі на мангалі, Короп/Скумбрія/Стейк з сьомги, Креветки гриль (10шт).\n' +
        'ОСНОВНІ (~25-35хв): Курча табака (ціле, під пресом, зелений соус), Шкмерулі (пів курки у вершково-часниковому соусі з горіхом), Оджахурі (печена картопля зі свининою і томатами), Чашушулі телятина/гриби (з болг.перцем і томатами), Стейк курячий, Стейк з язика (соус чімічурі), Медальйони зі свинини та телятини (вершково-грибний соус), Філе міньйон (2шт, теляча вирізка, зелене масло), Телятина у вершках, Печінка по-грузинськи (з гранатом і кінзою), Долма з соусом мацоні.\n' +
        'ХІНКАЛІ (3шт, 15-25хв): З м\'ясом (свино-телячий фарш), З баранини (кінза), З сиром (сулугуні+бринза+вершки), З грибами, З сьомгою та шпинатом, З вишнею (шоколадні).\n' +
        'ГАРНІРИ (~25-30хв): Картопляне пюре, Картопля по-домашньому (фритюр+часникова паста), Картопля з цибулею, Картопля фрі, Гречка, Тушковані овочі.\n' +
        'ХАЧАПУРІ (~25-30хв): На мангалі (листкове тісто, чері+сулугуні), Тифліс (бринза+сулугуні, закритий), Імеретинське (закритий, 4-6шт), По-аджарськи (лодочка з жовтком), З лисичками і дорблю (шпинат, мигдаль), Чебурек (1шт, телятина-свинина), Лаваш (~10хв).\n' +
        'ДЕСЕРТИ: Чорний принц (шоколад+горіх), Празький (шоколад+абрикос), Львівський сирник (ізюм, шоколад, мигдаль), Тифліс (аналог снікерсу), П\'яна вишня, Меренговий рулет, Штрудель (з морозивом), Медовик (з бджолиним пилком).\n' +
        'БАР: Chivas Regal 172грн/50мл, Monkey Shoulder 180грн, Jameson 100грн, Jack Daniels 110грн, Jim Beam 90грн, Grey Goose 95грн, Captain Morgan 75грн, Hennessy VSOP 390грн. Пиво: Corona/Hoegaarden/Leffe 120грн, розлив 70-90грн. Напої: Узвар 120грн/1л, Лимонад 120грн/1л, Вода 70грн, Coca-Cola 70грн, Еспресо 50грн, Капучіно 60грн. Бізнес-ланч пн-пт — окреме меню.\n\n' +
        ctx + '\n' +
        'ПРАВИЛА ВІДПОВІДЕЙ:\n' +
        '1. Відповідай коротко і по суті — 2-5 речень. Але якщо питання детальне — відповідай детально.\n' +
        '2. Про касу — тільки свою позицію і скільки до 1-го місця. Суми інших ніколи.\n' +
        '3. Хвали і підтримуй. Якщо щось не виходить — підбадьори.\n' +
        '4. Якщо даних немає в контексті — так і скажи чесно, не вигадуй.\n' +
        '5. Про будь-яку вкладку або функцію порталу — знаєш все і пояснюєш.' +
        usersCtx +
        Morakx._adminIntentPromptAddition();

      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
        body: JSON.stringify({
          action: 'chat_assistant',
          systemPrompt,
          history: Morakx._history.slice(0, -1), // без останнього (він уже в history)
          userMessage: text,
        }),
      });

      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'error');

      const rawText = data.text || '🤔';
      if (typingDiv) typingDiv.remove();

      // Перевіряємо чи це адмін-намір
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

      if (adminIntent && adminIntent.action && adminIntent.params) {
        // Не показуємо JSON — запитуємо підтвердження
        const desc = adminIntent.description || adminIntent.action;
        await Morakx._requestApproval(
          { action: adminIntent.action, params: adminIntent.params },
          desc,
          desc
        );
        const botMsg = 'Запит надіслано Дімі на підтвердження.';
        Morakx._history.push({ role: 'assistant', content: botMsg });
        return;
      }

      const reply = rawText;
      Morakx._addMsg('bot', reply);
      Morakx._history.push({ role: 'assistant', content: reply });

      // Бейдж якщо панель закрита
      if (!Morakx._open) {
        const fab = document.getElementById('morakx-fab');
        if (fab) fab.classList.add('has-reply');
      }
    } catch(e) {
      if (typingDiv) typingDiv.remove();
      Morakx._addMsg('bot', '😔 Помилка зв\'язку. Спробуй ще раз.');
    } finally {
      Morakx._loading = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  },

  // ── Адмін-дії з підтвердженням від Діми ────────────────────────
  _pendingApproval: null,

  async _requestApproval(adminAction, description, displayText) {
    // Повідомляємо юзера що чекаємо Діму
    Morakx._addMsg('bot',
      `🔐 Ця дія потребує підтвердження від Діми.\n\n` +
      `📋 Що зміниться: *${description}*\n\n` +
      `Я вже написав Дімі — зачекай на його рішення. ⏳`
    );

    try {
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
        body: JSON.stringify({
          action: 'morakx_request_approval',
          pendingAction: adminAction,
          description,
          requesterName: currentUser?.displayName || currentUser?.login || 'Офіціант',
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      const actionId = data.actionId;
      Morakx._pendingApproval = actionId;

      // Починаємо polling результату
      Morakx._pollApproval(actionId);

    } catch(e) {
      Morakx._addMsg('bot', '😔 Не вдалось надіслати запит Дімі. Спробуй пізніше.');
    }
  },

  _pollApproval(actionId, attempts = 0) {
    if (attempts > 60) { // 5 хвилин
      Morakx._addMsg('bot', '⏰ Діма не відповів протягом 5 хвилин. Дія скасована.');
      Morakx._pendingApproval = null;
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
        if (!data.ok) return;
        if (data.status === 'pending') {
          Morakx._pollApproval(actionId, attempts + 1); // ще раз через 5с
          return;
        }
        Morakx._pendingApproval = null;
        if (data.status === 'approved') {
          Morakx._addMsg('bot', '✅ Діма підтвердив! ' + (data.message || 'Дію виконано.'));
        } else if (data.status === 'declined') {
          Morakx._addMsg('bot', '❌ Діма відхилив цей запит.');
        } else {
          Morakx._addMsg('bot', '⚠️ ' + (data.message || 'Щось пішло не так.'));
        }
      } catch(e) {
        Morakx._pollApproval(actionId, attempts + 1);
      }
    }, 5000); // кожні 5 секунд
  },

  // Визначаємо чи є в тексті адмін-намір (для Groq)
  _adminIntentPromptAddition() {
    const today = new Date().toISOString().slice(0, 10);
    return (
      '\n\nАДМІН-ДІЇ З ПІДТВЕРДЖЕННЯМ:\n' +
      'Якщо користувач просить змінити графік, додати сповіщення, призначити обов\'язок або звільнити/відновити когось — ' +
      'визнач намір і поверни JSON (тільки JSON, без тексту):' +
      '{"intent":"admin_action","action":"update_schedule","params":{"userId":"ID","date":"YYYY-MM-DD","shift":"Р"},"description":"опис дії"}\n' +
      'Можливі дії: update_schedule, add_notification, update_duty, fire_user.\n' +
      'Якщо намір НЕ адмін-дія — відповідай текстом як зазвичай.\n' +
      'Дата сьогодні: ' + today
    );
  },


  init() {
    // Enter для відправки (Shift+Enter — новий рядок)
    const inp = document.getElementById('morakx-input');
    if (!inp) return;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        Morakx.send();
      }
    });
    // Авто-висота textarea
    inp.addEventListener('input', () => {
      inp.style.height = '';
      inp.style.height = Math.min(inp.scrollHeight, 80) + 'px';
    });
  },
};
