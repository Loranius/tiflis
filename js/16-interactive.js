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
    const cacheKey = 'horoscope_cache_' + todayISO + '_' + (zodiac||'none') + '_' + role;
    const cached = (() => { try { return JSON.parse(localStorage.getItem(cacheKey)||'null'); } catch(e) { return null; } })();
    const roleCtx = Horoscope._getRoleContext(role);

    // Визначити чи вже 11:00 сьогодні відправлено
    const now = new Date();
    const sentToday = now.getHours() >= 11;

    el.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(212,175,55,.06) 0%,rgba(22,56,50,.4) 100%);border:1px solid var(--gold-border);border-radius:16px;padding:20px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:var(--gold);font-weight:700;margin-bottom:2px">🔮 Гороскоп дня</div>
            <div style="font-size:11px;color:var(--text-dim)">${todayStr}</div>
          </div>
          <div style="background:rgba(212,175,55,.12);border:1px solid var(--gold-border);border-radius:8px;padding:4px 10px;font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.07em">${roleCtx.title}</div>
        </div>
      </div>

      ${!zodiac ? `
      <div style="background:rgba(212,175,55,.06);border:1px solid var(--gold-border);border-radius:14px;padding:20px;text-align:center;margin-bottom:16px">
        <div style="font-size:36px;margin-bottom:10px">🔮</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Знак зодіаку не вказано</div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:14px">Додай свій знак зодіаку в профіль щоб отримувати персональний гороскоп</div>
        <button class="btn btn-gold" onclick="Staff.showProfile('${currentUser?.id}')">✏️ Відкрити профіль</button>
      </div>` : `
      <div style="background:rgba(212,175,55,.06);border:1px solid var(--gold-border);border-radius:14px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <div style="font-size:40px;line-height:1">${zodiac.split(' ')[0]}</div>
        <div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);font-weight:700">Твій знак</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${zodiac}</div>
        </div>
      </div>`}

      <div id="horoscope-result" style="margin-bottom:16px">
        ${cached
          ? Horoscope._renderCard(cached)
          : zodiac
            ? (sentToday
                ? '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:28px 20px;text-align:center"><div style="font-size:36px;margin-bottom:10px">📭</div><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">Гороскоп ще не завантажено</div><div style="font-size:11px;color:var(--text-dim)">Гороскоп надсилається о 11:00. Якщо ти не отримав — перевір підключення Telegram або зверни до адміністратора.</div></div>'
                : `<div style="background:rgba(212,175,55,.05);border:1px solid var(--gold-border);border-radius:14px;padding:28px 20px;text-align:center"><div style="font-size:36px;margin-bottom:10px">⏳</div><div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:6px">Гороскоп надійде о 11:00</div><div style="font-size:11px;color:var(--text-dim)">Щоранку о 11:00 зірки надсилають твій персональний гороскоп у Telegram. Тут ти зможеш переглянути його в будь-який час протягом дня.</div></div>`)
            : ''
        }
      </div>

      <!-- Колеги за знаком (показуємо гороскоп для їхньої ролі = поточного юзера) -->
      ${zodiac ? `
      <div style="margin-top:24px;border-top:1px solid var(--gold-border);padding-top:20px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);font-weight:700;margin-bottom:12px">Гороскоп колег (твоя роль)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${ZODIAC_LIST.map(z => `
            <button onclick="Horoscope.generateFor('${z}')"
              style="background:${z===zodiac?'rgba(212,175,55,.15)':'var(--surface)'};border:1px solid ${z===zodiac?'var(--gold-border)':'rgba(255,255,255,.08)'};border-radius:12px;padding:10px 6px;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .15s;color:${z===zodiac?'var(--gold)':'var(--text-dim)'};font-size:11px;font-weight:700">
              <div style="font-size:20px;margin-bottom:4px">${z.split(' ')[0]}</div>
              <div style="font-size:9px;letter-spacing:.04em">${z.split(' ').slice(1).join(' ')}</div>
            </button>`).join('')}
        </div>
      </div>` : ''}`;
  },
};

