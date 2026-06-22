// ── Інтерактив ────────────────────────────────────────────────
const ALPHABET_UA = ['А','Б','В','Г','Ґ','Д','Е','Є','Ж','З','И','І','Ї','Й','К','Л','М','Н','О','П','Р','С','Т','У','Ф','Х','Ц','Ч','Ш','Щ','Ь','Ю','Я'];

const Interactive = {
  currentTab: 'letters',

  init() {
    Interactive.renderShell();
  },

  renderShell() {
    const el = $('interactive-content');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        <button onclick="Interactive.switchTab('letters')" id="itab-letters"
          class="menu-section-tab ${Interactive.currentTab==='letters'?'active':''}">
          🔤 Слова на літеру
        </button>
        <button onclick="Interactive.switchTab('horoscope')" id="itab-horoscope"
          class="menu-section-tab ${Interactive.currentTab==='horoscope'?'active':''}">
          🔮 Гороскоп
        </button>
      </div>
      <div id="interactive-tab-content"></div>`;
    Interactive.renderTab();
  },

  switchTab(tab) {
    Interactive.currentTab = tab;
    document.querySelectorAll('[id^="itab-"]').forEach(b => b.classList.remove('active'));
    const btn = $('itab-' + tab);
    if (btn) btn.classList.add('active');
    Interactive.renderTab();
  },

  renderTab() {
    if (Interactive.currentTab === 'letters') Interactive.renderLetters();
    if (Interactive.currentTab === 'horoscope') Interactive.renderHoroscope();
  },

  // ─── Слова на літеру ───────────────────────────────────────
  renderLetters() {
    const el = $('interactive-tab-content');
    if (!el) return;
    // Використовуємо _pending якщо є незбережені зміни, інакше з БД
    if (Interactive._pending === undefined) Interactive._pending = [...Interactive.getCrossed()];
    const crossed = Interactive._pending;

    const cells = ALPHABET_UA.map(letter => {
      const isCrossed = crossed.includes(letter);
      return `
        <div onclick="Interactive.toggleLetter('${letter}')"
          style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;
                 border-radius:10px;cursor:pointer;transition:all .18s;user-select:none;
                 font-family:'Montserrat',sans-serif;font-weight:800;font-size:15px;
                 position:relative;overflow:hidden;
                 ${isCrossed
                   ? 'background:rgba(224,90,90,.12);border:1px solid rgba(224,90,90,.35);color:rgba(212,175,55,.25);'
                   : 'background:var(--surface);border:1px solid var(--gold-border);color:var(--gold);'}">
          ${letter}
          ${isCrossed ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:rgba(224,90,90,.6);">✕</span>` : ''}
        </div>`;
    }).join('');

    // Рандомайзер
    const randomLetter = DB.get('interactive_random_letter') || '';
    const availableCount = ALPHABET_UA.filter(l => !crossed.includes(l)).length;

    el.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">
          Відмічено: ${crossed.length} / ${ALPHABET_UA.length}
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;max-width:420px">
          ${cells}
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:4px;margin-bottom:28px;flex-wrap:wrap">
        <button onclick="Interactive.saveLetters()" class="btn btn-gold" style="flex:1;min-width:120px;justify-content:center">
          💾 Зберегти
        </button>
        <button onclick="Interactive.resetLetters()" class="btn" style="flex:1;min-width:120px;justify-content:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--text-dim)">
          ↺ Скинути все
        </button>
      </div>

      <div style="background:var(--surface);border:1px solid var(--gold-border);border-radius:14px;padding:20px">
        <div style="font-family:'Cormorant Garamond',serif;font-size:18px;color:var(--gold);font-weight:700;margin-bottom:14px;letter-spacing:.08em">
          🎲 Рандомайзер літер
        </div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:16px">
          Генерує випадкову букву з тих що ще не відмічені (доступно: ${availableCount})
        </div>

        ${randomLetter ? `
        <div style="text-align:center;margin-bottom:18px">
          <div style="font-family:'Cormorant Garamond',serif;font-size:80px;font-weight:700;
                      color:var(--gold);line-height:1;
                      filter:drop-shadow(0 0 24px rgba(212,175,55,.4))">
            ${randomLetter}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Поточна буква для гри</div>
        </div>` : `
        <div style="text-align:center;margin-bottom:18px;padding:20px;
                    border:1px dashed rgba(255,255,255,.1);border-radius:10px;color:var(--text-muted);font-size:13px">
          Натисни кнопку щоб отримати букву
        </div>`}

        <button onclick="Interactive.randomizeLetter()"
          ${availableCount === 0 ? 'disabled' : ''}
          class="btn btn-gold" style="width:100%;justify-content:center;font-size:14px;padding:13px;
          ${availableCount === 0 ? 'opacity:.4;cursor:not-allowed;' : ''}">
          🎲 ${randomLetter ? 'Нова буква' : 'Запустити'}
        </button>
        ${availableCount === 0 ? '<p style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:10px">Всі букви відмічені — скинь щоб грати знову</p>' : ''}
      </div>`;
  },

  getCrossed() {
    return DB.get('interactive_letters_crossed') || [];
  },

  getPending() {
    return Interactive._pending || (Interactive._pending = [...Interactive.getCrossed()]);
  },

  toggleLetter(letter) {
    if (Interactive._pending === undefined) Interactive._pending = [...Interactive.getCrossed()];
    const idx = Interactive._pending.indexOf(letter);
    if (idx === -1) Interactive._pending.push(letter);
    else Interactive._pending.splice(idx, 1);
    Interactive.renderTab();
  },

  saveLetters() {
    const toSave = Interactive._pending !== undefined ? Interactive._pending : Interactive.getCrossed();
    DB.set('interactive_letters_crossed', toSave);
    Interactive._pending = undefined;
    toast('Збережено!', 'success-t');
    Interactive.renderTab();
  },

  resetLetters() {
    Interactive._pending = [];
    Interactive.renderTab();
  },

  randomizeLetter() {
    const crossed = Interactive._pending || Interactive.getCrossed();
    const available = ALPHABET_UA.filter(l => !crossed.includes(l));
    if (!available.length) { toast('Всі букви відмічені!', 'error'); return; }
    const letter = available[Math.floor(Math.random() * available.length)];
    DB.set('interactive_random_letter', letter);
    Interactive.renderTab();
  },

  // ─── Гороскоп ──────────────────────────────────────────────────
  renderHoroscope() {
    const el = $('interactive-tab-content');
    if (!el) return;
    const zodiac = currentUser?.zodiac || '';
    const role   = currentUser?.role   || 'waiter';
    const ZODIAC_LIST = ['♈ Овен','♉ Телець','♊ Близнюки','♋ Рак','♌ Лев','♍ Діва','♎ Терези','♏ Скорпіон','♐ Стрілець','♑ Козеріг','♒ Водолій','♓ Риби'];
    const todayStr = new Date().toLocaleDateString('uk-UA', {day:'numeric',month:'long',year:'numeric'});
    const todayISO = new Date().toISOString().slice(0,10);
    const scheduleMap = DB.get('schedule', {});
    const WORKING_SHIFTS = ['Р', 'СН', 'Б', 'С', 'Р/Б', 'СН/Б'];
    const shift = (scheduleMap[`${currentUser?.id}_${todayISO}`] || '').trim();
    const isWorking = WORKING_SHIFTS.includes(shift);

    // Ключ кешу: робочий або вихідний
    const cacheKey = isWorking
      ? 'horoscope_cache_' + todayISO + '_' + (zodiac||'none') + '_' + role
      : 'horoscope_cache_' + todayISO + '_' + (zodiac||'none') + '_offday';
    const cached = (() => { try { return JSON.parse(localStorage.getItem(cacheKey)||'null'); } catch(e) { return null; } })();
    const roleCtx = Horoscope._getRoleContext(role);
    const now = new Date();
    const after11 = now.getHours() >= 11;

    // Будуємо HTML
    el.innerHTML = '';

    // ── Заголовок ─────────────────────────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = 'background:linear-gradient(135deg,rgba(212,175,55,.06) 0%,rgba(22,56,50,.4) 100%);border:1px solid var(--gold-border);border-radius:16px;padding:20px;margin-bottom:16px';
    header.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:var(--gold);font-weight:700;margin-bottom:2px">🔮 Гороскоп дня</div>
          <div style="font-size:11px;color:var(--text-dim)">${todayStr}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${shift ? `<span style="background:rgba(90,175,122,.12);border:1px solid rgba(90,175,122,.25);border-radius:8px;padding:3px 8px;font-size:10px;font-weight:700;color:#5aaf7a">${shift}</span>` : ''}
          <span style="background:rgba(212,175,55,.12);border:1px solid var(--gold-border);border-radius:8px;padding:4px 10px;font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.07em">${isWorking ? roleCtx.title : 'Вихідний'}</span>
        </div>
      </div>`;
    el.appendChild(header);

    // ── Знак зодіаку відсутній ─────────────────────────────────────
    if (!zodiac) {
      const noSign = document.createElement('div');
      noSign.style.cssText = 'background:rgba(212,175,55,.06);border:1px solid var(--gold-border);border-radius:14px;padding:20px;text-align:center;margin-bottom:16px';
      noSign.innerHTML = `<div style="font-size:36px;margin-bottom:10px">🔮</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Знак зодіаку не вказано</div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:14px">Додай знак зодіаку в профіль</div>`;
      const profileBtn = document.createElement('button');
      profileBtn.className = 'btn btn-gold';
      profileBtn.textContent = '✏️ Відкрити профіль';
      profileBtn.addEventListener('click', () => Staff.showProfile(currentUser?.id));
      noSign.appendChild(profileBtn);
      el.appendChild(noSign);
      return;
    }

    // ── Знак ──────────────────────────────────────────────────────
    const signBlock = document.createElement('div');
    signBlock.style.cssText = 'background:rgba(212,175,55,.06);border:1px solid var(--gold-border);border-radius:14px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:12px';
    signBlock.innerHTML = `
      <div style="font-size:40px;line-height:1">${zodiac.split(' ')[0]}</div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);font-weight:700">Твій знак · ${isWorking ? 'Робоча зміна' : 'Вихідний день'}</div>
        <div style="font-size:18px;font-weight:800;color:var(--gold)">${zodiac}</div>
      </div>`;
    el.appendChild(signBlock);

    // ── Блок результату ────────────────────────────────────────────
    const resultDiv = document.createElement('div');
    resultDiv.id = 'horoscope-result';
    resultDiv.style.marginBottom = '16px';
    el.appendChild(resultDiv);

    if (cached) {
      // Є кеш — показуємо одразу
      resultDiv.innerHTML = Horoscope._renderCard(cached);
      // Кнопка оновлення
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'btn btn-ghost btn-sm';
      refreshBtn.style.cssText = 'width:100%;margin-top:8px';
      refreshBtn.textContent = '🔄 Оновити гороскоп';
      refreshBtn.id = 'horoscope-gen-btn';
      refreshBtn.addEventListener('click', () => {
        // Скидаємо кеш і генеруємо новий
        try { localStorage.removeItem(cacheKey); } catch(e) {}
        Interactive.renderHoroscope();
      });
      el.appendChild(refreshBtn);
    } else {
      // Немає кешу — кнопка отримати + пояснення
      const noHoro = document.createElement('div');
      noHoro.style.cssText = 'background:rgba(212,175,55,.05);border:1px solid var(--gold-border);border-radius:14px;padding:28px 20px;text-align:center';
      noHoro.innerHTML = `
        <div style="font-size:40px;margin-bottom:12px">${after11 ? '📭' : '⏳'}</div>
        <div style="font-size:14px;font-weight:800;color:var(--gold);margin-bottom:6px">${after11 ? 'Гороскоп не надійшов' : 'Гороскоп надійде о 11:00'}</div>
        <div style="font-size:12px;color:var(--text-dim);line-height:1.6;margin-bottom:20px">${after11
          ? 'Щось пішло не так з розсилкою. Отримай свій гороскоп просто зараз:'
          : 'Щоранку о 11:00 гороскоп надходить у Telegram. Або отримай його прямо зараз:'
        }</div>`;
      const getBtn = document.createElement('button');
      getBtn.className = 'btn btn-gold';
      getBtn.id = 'horoscope-gen-btn';
      getBtn.textContent = '✨ Отримати передбачення';
      getBtn.addEventListener('click', () => {
        getBtn.disabled = true;
        getBtn.innerHTML = '<span class="btn-spinner"></span> Зорі говорять...';
        const genFn = isWorking
          ? Horoscope._callClaude(zodiac, role)
          : Horoscope._callClaudeOffDay(zodiac);
        genFn.then(result => {
          try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(e) {}
          resultDiv.innerHTML = Horoscope._renderCard(result);
          noHoro.remove();
          // Додаємо кнопку оновлення
          const rBtn = document.createElement('button');
          rBtn.className = 'btn btn-ghost btn-sm';
          rBtn.style.cssText = 'width:100%;margin-top:8px';
          rBtn.textContent = '🔄 Оновити гороскоп';
          rBtn.addEventListener('click', () => {
            try { localStorage.removeItem(cacheKey); } catch(e) {}
            Interactive.renderHoroscope();
          });
          resultDiv.after(rBtn);
        }).catch(e => {
          console.error(e);
          getBtn.disabled = false;
          getBtn.textContent = '✨ Спробувати ще раз';
          toast('Помилка генерації. Перевір з\'єднання.', 'error');
        });
      });
      noHoro.appendChild(getBtn);
      resultDiv.appendChild(noHoro);
    }

    // ── Сітка знаків колег ─────────────────────────────────────────
    const colleaguesDiv = document.createElement('div');
    colleaguesDiv.style.cssText = 'margin-top:24px;border-top:1px solid var(--gold-border);padding-top:20px';
    const colleaguesTitle = document.createElement('div');
    colleaguesTitle.style.cssText = 'font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);font-weight:700;margin-bottom:12px';
    colleaguesTitle.textContent = 'Гороскоп колег';
    colleaguesDiv.appendChild(colleaguesTitle);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px';
    ZODIAC_LIST.forEach(z => {
      const btn = document.createElement('button');
      const isMe = z === zodiac;
      btn.style.cssText = `background:${isMe?'rgba(212,175,55,.15)':'var(--surface)'};border:1px solid ${isMe?'var(--gold-border)':'rgba(255,255,255,.08)'};border-radius:12px;padding:10px 6px;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .15s;color:${isMe?'var(--gold)':'var(--text-dim)'};font-size:11px;font-weight:700`;
      btn.innerHTML = `<div style="font-size:20px;margin-bottom:4px">${z.split(' ')[0]}</div><div style="font-size:9px;letter-spacing:.04em">${z.split(' ').slice(1).join(' ')}</div>`;
      btn.addEventListener('click', () => Horoscope.generateFor(z));
      grid.appendChild(btn);
    });
    colleaguesDiv.appendChild(grid);
    el.appendChild(colleaguesDiv);
  },
};

