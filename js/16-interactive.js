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
        <button onclick="Interactive.switchTab('memes')" id="itab-memes"
          class="menu-section-tab ${Interactive.currentTab==='memes'?'active':''}">
          😂 Меми
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
    if (Interactive.currentTab === 'memes') Interactive.renderMemes();
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

  // ─── Меми ──────────────────────────────────────────────────────
  MEMES_KEY: 'interactive_memes',
  MEME_TITLE_MAX: 30,
  MEME_DESC_MAX: 500,

  getMemes() {
    return DB.get(Interactive.MEMES_KEY, []);
  },

  async _saveMemes(memes) {
    DB.set(Interactive.MEMES_KEY, memes);
    try {
      await sb.upsert('settings', { key: Interactive.MEMES_KEY, value: JSON.stringify(memes) }, 'key');
    } catch(e) { console.error('Interactive._saveMemes error:', e); }
  },

  async initMemes() {
    try {
      const rows = await sb.query('settings', { filter:{ key: Interactive.MEMES_KEY }, select:'value', limit:1 });
      if (rows?.[0]?.value) {
        const parsed = JSON.parse(rows[0].value);
        if (Array.isArray(parsed)) DB.set(Interactive.MEMES_KEY, parsed);
      }
    } catch(e) {}
  },

  renderMemes() {
    const el = $('interactive-tab-content');
    if (!el) return;

    if (!Interactive._memesLoaded) {
      Interactive._memesLoaded = true;
      Interactive.initMemes().then(() => {
        if (Interactive.currentTab === 'memes') Interactive.renderMemes();
      });
    }

    const memes = [...Interactive.getMemes()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const cardsHtml = memes.length
      ? memes.map(m => Interactive._renderMemeCard(m)).join('')
      : `<div class="card" style="padding:32px;text-align:center;color:var(--text-dim)">
           <div style="font-size:32px;margin-bottom:10px">😂</div>
           <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">Ще немає мемів</div>
           <div style="font-size:12px">Стань першим, хто додасть мем ресторану!</div>
         </div>`;

    el.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button onclick="Interactive.openMemeModal()" class="btn btn-gold">
          ➕ Мем
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${cardsHtml}
      </div>`;
  },

  _renderMemeCard(m) {
    const ratingsObj = m.ratings || {};
    const scores = Object.values(ratingsObj).filter(v => typeof v === 'number' && v > 0);
    const avg = scores.length ? (scores.reduce((a,b) => a+b, 0) / scores.length) : null;
    const myScore = currentUser ? (ratingsObj[currentUser.id] || 0) : 0;
    const createdLabel = m.createdAt ? new Date(m.createdAt).toLocaleDateString('uk-UA', { day:'numeric', month:'long', year:'numeric' }) : '';

    const scoreButtons = Array.from({length:10}, (_,i) => i+1).map(n => `
      <button onclick="Interactive.rateMeme('${m.id}',${n})"
        style="width:26px;height:26px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:800;
               border:1px solid ${n===myScore ? 'var(--gold)' : 'rgba(255,255,255,.12)'};
               background:${n===myScore ? 'var(--gold)' : 'var(--surface)'};
               color:${n===myScore ? '#1a1a1a' : 'var(--text-dim)'};transition:.15s">
        ${n}
      </button>`).join('');

    return `
      <div class="card" style="padding:16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
          <div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:700;color:var(--gold)">
              ${esc(m.title)}
            </div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">
              👤 ${esc(m.authorName || 'Невідомо')} · ${esc(createdLabel)}
            </div>
          </div>
          ${avg !== null ? `
          <div style="text-align:center;flex-shrink:0">
            <div style="font-size:20px;font-weight:800;color:var(--gold);line-height:1">${avg.toFixed(1)}</div>
            <div style="font-size:9px;color:var(--text-muted)">${scores.length} оцін.</div>
          </div>` : ''}
        </div>

        ${m.photoUrl ? `
        <img src="${esc(m.photoUrl)}" onclick="Interactive.openFullImage('${esc(m.photoUrl)}')"
          style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;margin-bottom:10px;cursor:zoom-in;
                 border:1px solid var(--gold-border)">` : ''}

        ${m.description ? `<div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:10px;white-space:pre-wrap">${esc(m.description)}</div>` : ''}

        ${m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener noreferrer"
          style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--gold);margin-bottom:12px;word-break:break-all">
          🔗 ${esc(m.link)}
        </a>` : ''}

        <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:10px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);font-weight:700;margin-bottom:8px">
            ${myScore ? `Твоя оцінка: ${myScore}` : 'Оціни мем'}
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">${scoreButtons}</div>
        </div>
      </div>`;
  },

  openFullImage(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';
    overlay.innerHTML = `
      <img src="${esc(url)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px">
      <button style="position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;
        background:rgba(255,255,255,.12);border:none;color:#fff;font-size:16px;cursor:pointer">✕</button>`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  _pendingMemeFile: null,
  _pendingMemePreview: '',

  openMemeModal() {
    Interactive._pendingMemeFile = null;
    Interactive._pendingMemePreview = '';
    showModal(`
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
        <div style="font-family:'Cormorant Garamond',serif;font-size:21px;color:var(--gold);font-weight:700">
          ➕ Новий мем
        </div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:6px 10px">✕</button>
      </div>

      <div class="form-group" style="margin-bottom:10px">
        <label class="lbl">Назва (до ${Interactive.MEME_TITLE_MAX} символів)</label>
        <input type="text" class="field" id="meme-title" maxlength="${Interactive.MEME_TITLE_MAX}" placeholder="Напр.: Коли гість замовив 40 морсів">
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;text-align:right" id="meme-title-count">0 / ${Interactive.MEME_TITLE_MAX}</div>
      </div>

      <div class="form-group" style="margin-bottom:10px">
        <label class="lbl">Опис (до ${Interactive.MEME_DESC_MAX} символів)</label>
        <textarea class="field" id="meme-desc" maxlength="${Interactive.MEME_DESC_MAX}" rows="4"
          style="resize:vertical;font-family:inherit" placeholder="Що сталось..."></textarea>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;text-align:right" id="meme-desc-count">0 / ${Interactive.MEME_DESC_MAX}</div>
      </div>

      <div class="form-group" style="margin-bottom:10px">
        <label class="lbl">Посилання (необов'язково)</label>
        <input type="url" class="field" id="meme-link" placeholder="https://...">
      </div>

      <div class="form-group" style="margin-bottom:16px">
        <label class="lbl">Фото (необов'язково)</label>
        <input type="file" id="meme-photo-input" accept="image/*" style="display:none" onchange="Interactive._onMemePhotoSelected(this)">
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px" id="meme-photo-wrap">
          <button type="button" class="btn btn-ghost" style="padding:10px 16px;font-size:13px;border:1px dashed rgba(255,255,255,.2)"
            onclick="document.getElementById('meme-photo-input').click()">
            📷 Додати фото
          </button>
          <div id="meme-photo-preview" style="display:none;position:relative">
            <img id="meme-photo-img" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--gold-border);cursor:zoom-in"
              onclick="Interactive.openFullImage(this.src)">
            <button type="button" onclick="Interactive._clearMemePhoto()"
              style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;
                background:var(--danger);border:none;color:#fff;font-size:10px;cursor:pointer;
                display:flex;align-items:center;justify-content:center;padding:0;line-height:1">✕</button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-gold" id="meme-save-btn" style="flex:1" onclick="Interactive.saveMeme()">
          ✅ Опублікувати
        </button>
        <button class="btn btn-ghost" onclick="closeModal()">Скасувати</button>
      </div>
    `);

    const titleEl = document.getElementById('meme-title');
    const descEl  = document.getElementById('meme-desc');
    titleEl?.addEventListener('input', () => {
      document.getElementById('meme-title-count').textContent = `${titleEl.value.length} / ${Interactive.MEME_TITLE_MAX}`;
    });
    descEl?.addEventListener('input', () => {
      document.getElementById('meme-desc-count').textContent = `${descEl.value.length} / ${Interactive.MEME_DESC_MAX}`;
    });
  },

  _onMemePhotoSelected(input) {
    const file = input.files?.[0];
    if (!file) return;
    Interactive._pendingMemeFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      Interactive._pendingMemePreview = e.target.result;
      const imgEl = document.getElementById('meme-photo-img');
      const preview = document.getElementById('meme-photo-preview');
      if (imgEl) imgEl.src = e.target.result;
      if (preview) preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  },

  _clearMemePhoto() {
    Interactive._pendingMemeFile = null;
    Interactive._pendingMemePreview = '';
    const inp = document.getElementById('meme-photo-input');
    const preview = document.getElementById('meme-photo-preview');
    if (inp) inp.value = '';
    if (preview) preview.style.display = 'none';
  },

  async saveMeme() {
    const title = document.getElementById('meme-title')?.value.trim() || '';
    const description = document.getElementById('meme-desc')?.value.trim() || '';
    const link = document.getElementById('meme-link')?.value.trim() || '';

    if (!title) { toast('Вкажіть назву мему', 'error-t'); return; }
    if (title.length > Interactive.MEME_TITLE_MAX) { toast(`Назва занадто довга (макс. ${Interactive.MEME_TITLE_MAX})`, 'error-t'); return; }
    if (description.length > Interactive.MEME_DESC_MAX) { toast(`Опис занадто довгий (макс. ${Interactive.MEME_DESC_MAX})`, 'error-t'); return; }
    if (link) {
      try { new URL(link); } catch(e) { toast('Некоректне посилання', 'error-t'); return; }
    }

    const btn = document.getElementById('meme-save-btn');
    btnLock(btn);

    try {
      let photoUrl = '';
      if (Interactive._pendingMemeFile) {
        try {
          photoUrl = await uploadImageFile(Interactive._pendingMemeFile, 'images', 'memes');
        } catch(e) {
          console.error('Meme photo upload error:', e);
          toast('Не вдалось завантажити фото, мем збережено без нього', 'error-t');
        }
      }

      const meme = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        description,
        link: link || '',
        photoUrl: photoUrl || '',
        authorId: currentUser?.id || '',
        authorName: currentUser?.displayName || currentUser?.login || 'Невідомо',
        createdAt: new Date().toISOString(),
        ratings: {},
      };

      const memes = Interactive.getMemes();
      memes.push(meme);
      await Interactive._saveMemes(memes);

      closeModal();
      toast('✅ Мем опубліковано!', 'success-t');
      Interactive._pendingMemeFile = null;
      Interactive._pendingMemePreview = '';
      if (Interactive.currentTab === 'memes') Interactive.renderMemes();

      Interactive.notifyNewMeme(meme);
    } catch(e) {
      console.error('saveMeme error:', e);
      toast('Помилка збереження мему', 'error');
    } finally {
      btnUnlock(btn);
    }
  },

  async rateMeme(memeId, score) {
    if (!currentUser) return;
    const memes = Interactive.getMemes();
    const meme = memes.find(m => m.id === memeId);
    if (!meme) return;
    if (!meme.ratings) meme.ratings = {};
    if (meme.ratings[currentUser.id] === score) {
      delete meme.ratings[currentUser.id];
    } else {
      meme.ratings[currentUser.id] = score;
    }
    await Interactive._saveMemes(memes);
    if (Interactive.currentTab === 'memes') Interactive.renderMemes();
  },

  async notifyNewMeme(meme) {
    try {
      const allUsers = getUsers().filter(u => !u.fired);
      const authorLabel = esc(meme.authorName);
      const msg = [
        `😂 <b>Новий мем у порталі!</b>`,
        `📌 ${esc(meme.title)}`,
        `👤 Автор: ${authorLabel}`,
        meme.description ? `\n${esc(meme.description).slice(0, 300)}` : '',
      ].filter(Boolean).join('\n');

      const targets = allUsers.filter(u => {
        if (isAdmin(u)) return false;
        if (u.role === 'chef' || u.role2 === 'chef') return false;
        return true;
      });

      for (const u of targets) {
        const destId = u.chat_id || u.tg_id;
        if (!destId) continue;
        if (meme.photoUrl) {
          await tgSendPhoto(destId, meme.photoUrl, msg);
        } else {
          await tgSendPersonal(destId, msg);
        }
      }
    } catch(e) { console.error('Interactive.notifyNewMeme error:', e); }
  },
};

