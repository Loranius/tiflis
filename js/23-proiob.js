// ╔═══════════════════════════════════════════════════════════════╗
// ║  [23/23] ПРОЙОБ — фінансові питання цеху                     ║
// ╚═══════════════════════════════════════════════════════════════╝

// Перевірка доступу: лише офіціант, кухар, сисадмін
function canAccessProiob(u) {
  if (!u) return false;
  if (isSysadmin(u)) return true;
  return u.role === 'waiter' || u.role2 === 'waiter' ||
         u.role === 'cook'   || u.role2 === 'cook';
}

// Перевірка: чи може підтверджувати ціни (кухар, але НЕ шеф і НЕ адмін і НЕ сисадмін)
function canConfirmProiobPrice(u) {
  if (!u) return false;
  if (isAdmin(u) || isSysadmin(u)) return false;
  return u.role === 'cook' || u.role2 === 'cook';
}

const Proiob = {
  _filter: 'all',     // all | cold | hot | open | confirmed
  _records: [],       // локальний кеш
  _editId: null,
  _closeId: null,
  _confirmId: null,

  // ── Ініціалізація при відкритті вкладки ──────────────────────
  async init() {
    if (!canAccessProiob(currentUser)) {
      $('proiob-content').innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--text-dim)">
          <div style="font-size:40px;margin-bottom:14px">🔒</div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">Доступ закрито</div>
          <div style="font-size:12px;margin-top:8px">Розділ доступний лише для офіціантів і кухарів</div>
        </div>`;
      return;
    }
    await Proiob._load();
    Proiob._renderPage();
  },

  // ── Завантаження з Supabase ───────────────────────────────────
  async _load() {
    try {
      const rows = await sb.query('proiob_records', { order: 'created_at', ascending: false });
      Proiob._records = rows || [];
    } catch(e) {
      console.warn('Proiob load error:', e);
      Proiob._records = [];
    }
  },

  // ── Фільтрація ────────────────────────────────────────────────
  _filtered() {
    return Proiob._records.filter(r => {
      if (Proiob._filter === 'cold')      return r.dept === 'cold';
      if (Proiob._filter === 'hot')       return r.dept === 'hot';
      if (Proiob._filter === 'open')      return !r.price_confirmed;
      if (Proiob._filter === 'confirmed') return r.price_confirmed;
      return true;
    });
  },

  setFilter(f) {
    Proiob._filter = f;
    Proiob._renderList();
    // Оновити активний фільтр
    document.querySelectorAll('.proiob-filter').forEach(b => {
      b.className = 'proiob-filter filter-btn';
    });
    const btn = document.getElementById('pf-' + f);
    if (btn) {
      if (f === 'cold') btn.classList.add('active-cold');
      else if (f === 'hot') btn.classList.add('active-hot');
      else btn.classList.add('active');
    }
  },

  // ── Рендер усієї сторінки ─────────────────────────────────────
  _renderPage() {
    const isKitchenUser = canConfirmProiobPrice(currentUser);
    const isWaiterUser  = currentUser.role === 'waiter' || currentUser.role2 === 'waiter';

    $('proiob-content').innerHTML = `
      <!-- Шапка -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px">
        <div>
          <div class="page-title" style="font-family:'Cormorant Garamond',serif;font-size:24px;color:var(--gold)">💸 Пройоб</div>
          <div class="page-subtitle" style="font-size:11px;color:var(--text-dim);margin-top:2px">
            ${isKitchenUser ? 'Кухня · підтвердження цін' : 'Фінансові питання цеху'}
          </div>
        </div>
        <button class="btn btn-gold" id="proiob-create-btn">＋ Створити</button>
      </div>

      <!-- Фільтри -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        <button class="proiob-filter filter-btn active" id="pf-all"       onclick="Proiob.setFilter('all')">Всі</button>
        <button class="proiob-filter filter-btn"        id="pf-cold"      onclick="Proiob.setFilter('cold')">❄️ Холодний</button>
        <button class="proiob-filter filter-btn"        id="pf-hot"       onclick="Proiob.setFilter('hot')">🔥 Гарячий</button>
        <button class="proiob-filter filter-btn"        id="pf-open"      onclick="Proiob.setFilter('open')">🟡 Очікує</button>
        <button class="proiob-filter filter-btn"        id="pf-confirmed" onclick="Proiob.setFilter('confirmed')">✅ Погоджені</button>
      </div>

      <!-- Лічильник -->
      <div id="proiob-count" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:10px;padding-left:2px"></div>

      <!-- Список -->
      <div id="proiob-list"></div>

      <!-- Модалка: Створити / Редагувати -->
      <div class="modal-overlay" id="proiob-modal-form">
        <div class="modal">
          <div class="modal-title" id="proiob-form-title">➕ Нова анкета</div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="form-group">
              <label class="lbl">Цех</label>
              <select id="pf-dept" class="field">
                <option value="cold">❄️ Холодний цех</option>
                <option value="hot">🔥 Гарячий цех</option>
              </select>
            </div>
            <div class="form-group">
              <label class="lbl">Опис ситуації</label>
              <textarea id="pf-desc" class="field" placeholder="Що сталось? Опишіть деталі…" rows="4" style="resize:vertical;min-height:90px;line-height:1.5"></textarea>
            </div>
            <div class="form-group" id="pf-price-group">
              <label class="lbl">Ціна вирішення (грн)</label>
              <input type="number" id="pf-price" class="field" placeholder="напр. 350" min="0" step="1">
              <div style="font-size:10px;color:var(--text-muted);margin-top:3px">
                💡 Кухня може запропонувати іншу ціну після ознайомлення
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" id="proiob-form-cancel">Скасувати</button>
            <button class="btn btn-gold"  id="proiob-form-submit">Зберегти</button>
          </div>
        </div>
      </div>

      <!-- Модалка: Підтвердити ціну -->
      <div class="modal-overlay" id="proiob-modal-confirm">
        <div class="modal">
          <div class="modal-title">🔥 Підтвердити ціну</div>
          <div id="proiob-confirm-body" style="font-size:13px;line-height:1.6;color:var(--text-dim);margin-bottom:16px"></div>
          <div class="form-group" style="margin-bottom:4px">
            <label class="lbl">Запропонувати іншу ціну (необов'язково)</label>
            <input type="number" id="proiob-confirm-price" class="field" placeholder="Залиште порожнім щоб прийняти поточну" min="0" step="1">
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">
            Якщо залишити порожнім — буде підтверджено ціну офіціанта
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost"   id="proiob-confirm-cancel">Скасувати</button>
            <button class="btn btn-success" id="proiob-confirm-submit">✅ Підтвердити</button>
          </div>
        </div>
      </div>

      <!-- Модалка: Закрити анкету -->
      <div class="modal-overlay" id="proiob-modal-close">
        <div class="modal">
          <div class="modal-title">🔒 Закрити анкету</div>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:20px">
            Анкету буде <b style="color:var(--danger)">назавжди видалено</b> з бази даних. Цю дію неможливо скасувати.
          </p>
          <div class="modal-footer">
            <button class="btn btn-ghost"  id="proiob-close-cancel">Скасувати</button>
            <button class="btn btn-danger" id="proiob-close-submit">🔒 Закрити назавжди</button>
          </div>
        </div>
      </div>`;

    // Прив'язуємо кнопки через addEventListener
    document.getElementById('proiob-create-btn').addEventListener('click', () => Proiob._openForm());
    document.getElementById('proiob-form-cancel').addEventListener('click', () => Proiob._closeForm());
    document.getElementById('proiob-form-submit').addEventListener('click', () => Proiob._submitForm());
    document.getElementById('proiob-confirm-cancel').addEventListener('click', () => Proiob._closeConfirm());
    document.getElementById('proiob-confirm-submit').addEventListener('click', () => Proiob._submitConfirm());
    document.getElementById('proiob-close-cancel').addEventListener('click',  () => Proiob._closeClose());
    document.getElementById('proiob-close-submit').addEventListener('click',  () => Proiob._submitClose());

    Proiob._renderList();
  },

  // ── Рендер списку анкет ───────────────────────────────────────
  _renderList() {
    const list    = $('proiob-list');
    const countEl = $('proiob-count');
    if (!list) return;

    const filtered = Proiob._filtered();
    countEl.textContent = filtered.length ? `Анкет: ${filtered.length}` : '';

    if (!filtered.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:48px 20px;color:var(--text-dim)">
          <div style="font-size:40px;margin-bottom:12px">📋</div>
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Анкет немає</div>
          <div style="font-size:12px;line-height:1.5">Поки що жодної анкети за цим фільтром</div>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(r => Proiob._cardHTML(r)).join('');

    // Прив'язуємо всі кнопки карток
    filtered.forEach(r => {
      const card = document.getElementById('proiob-card-' + r.id);
      if (!card) return;

      card.querySelector('[data-pa="edit"]')
        ?.addEventListener('click', () => Proiob._openForm(r.id));

      card.querySelector('[data-pa="delete"]')
        ?.addEventListener('click', () => Proiob._deleteRecord(r.id));

      card.querySelector('[data-pa="close"]')
        ?.addEventListener('click', () => Proiob._openClose(r.id));

      const confirmBtn = card.querySelector('[data-pa="confirm"]');
      if (confirmBtn) confirmBtn.addEventListener('click', () => Proiob._openConfirm(r.id));
    });
  },

  // ── HTML однієї картки ────────────────────────────────────────
  _cardHTML(r) {
    const isMine   = r.created_by === currentUser.id;
    const isKitchen = canConfirmProiobPrice(currentUser);
    const isSysad  = isSysadmin(currentUser);

    // Бейдж цеху
    const deptBadge = r.dept === 'cold'
      ? `<span class="badge" style="background:rgba(90,159,207,.12);color:#5a9fcf;border:1px solid rgba(90,159,207,.3)">❄️ Холодний</span>`
      : `<span class="badge" style="background:rgba(224,122,80,.12);color:#e07a50;border:1px solid rgba(224,122,80,.3)">🔥 Гарячий</span>`;

    // Бейдж статусу
    const statusBadge = r.price_confirmed
      ? `<span class="badge badge-green">✅ Погоджено</span>`
      : `<span class="badge badge-gold">🟡 Очікує кухні</span>`;

    // Блок ціни
    let priceBlock;
    if (r.price_confirmed) {
      const finalPrice = r.kitchen_price != null ? r.kitchen_price : r.waiter_price;
      const changed    = r.kitchen_price != null && r.kitchen_price !== r.waiter_price;
      priceBlock = `
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Підсумкова ціна</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold);font-family:'Cormorant Garamond',serif">${finalPrice} грн</div>
          ${changed ? `<div style="font-size:10px;color:var(--text-muted)">Офіціант: ${r.waiter_price} грн</div>` : ''}
          <div style="font-size:10px;color:var(--success);margin-top:2px">✅ підтвердив(ла) <b>${esc(r.confirmed_by_name || '—')}</b></div>
        </div>`;
    } else {
      priceBlock = `
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Ціна офіціанта</div>
          <div style="font-size:16px;font-weight:800;color:var(--warning);font-family:'Cormorant Garamond',serif">~${r.waiter_price || '—'} грн</div>
          <div style="font-size:10px;color:var(--text-muted)">Чекає підтвердження кухні</div>
        </div>`;
    }

    // Кнопка підтвердження (лише кухар, не шеф, не підтверджено)
    const confirmBtn = (!r.price_confirmed && isKitchen)
      ? `<button class="btn btn-success btn-sm" data-pa="confirm">✅ Підтвердити</button>`
      : '';

    // Дії: редагувати (автор або сисадмін), видалити (автор), закрити (автор або сисадмін)
    const editBtn   = (isMine || isSysad) ? `<button class="btn btn-ghost btn-sm" data-pa="edit">✏️</button>` : '';
    const deleteBtn = isMine ? `<button class="btn btn-danger btn-sm" data-pa="delete">🗑</button>` : '';
    const closeBtn  = (isMine || isSysad) ? `<button class="btn btn-ghost btn-sm" data-pa="close" style="font-size:10px">🔒 Закрити</button>` : '';

    const borderColor = r.dept === 'cold' ? '#5a9fcf' : '#e07a50';

    return `
      <div id="proiob-card-${r.id}" style="
        background:linear-gradient(160deg,rgba(255,255,255,.055) 0%,rgba(255,255,255,.025) 100%);
        border:1px solid var(--gold-border);
        border-left:3px solid ${borderColor};
        border-radius:14px;
        margin-bottom:12px;
        overflow:hidden;
        transition:transform .15s,box-shadow .15s;"
        onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 24px rgba(0,0,0,.3)'"
        onmouseleave="this.style.transform='';this.style.boxShadow=''">

        <!-- Шапка картки -->
        <div style="padding:14px 16px 10px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              ${deptBadge}
              ${statusBadge}
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:11px;font-weight:700;color:var(--text)">👤 ${esc(r.created_by_name)}</span>
              <span style="font-size:10px;color:var(--text-muted)">${Proiob._fmtTime(r.created_at)}</span>
            </div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
            ${editBtn}${deleteBtn}${closeBtn}
          </div>
        </div>

        <!-- Опис -->
        <div style="padding:0 16px 12px;font-size:12px;color:var(--text-dim);line-height:1.55">${esc(r.description)}</div>

        <!-- Ціна + дія -->
        <div style="padding:10px 16px 14px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          ${priceBlock}
          <div>${confirmBtn}</div>
        </div>
      </div>`;
  },

  // ── Форма: відкрити ───────────────────────────────────────────
  _openForm(id = null) {
    Proiob._editId = id;
    const isKitchen = canConfirmProiobPrice(currentUser) || (currentUser.role === 'chef');

    if (id) {
      const r = Proiob._records.find(x => x.id === id);
      if (!r) return;
      $('proiob-form-title').textContent = '✏️ Редагувати анкету';
      $('pf-dept').value   = r.dept;
      $('pf-desc').value   = r.description;
      $('pf-price').value  = r.price_confirmed ? '' : (r.waiter_price || '');
      // Поле ціни — не показуємо кухарям і не показуємо якщо вже підтверджено
      $('pf-price-group').classList.toggle('hidden', isKitchen || r.price_confirmed);
    } else {
      $('proiob-form-title').textContent = '➕ Нова анкета';
      $('pf-dept').value  = 'cold';
      $('pf-desc').value  = '';
      $('pf-price').value = '';
      // Кухарі і шефи не вказують ціну при створенні
      $('pf-price-group').classList.toggle('hidden', isKitchen);
    }

    $('proiob-modal-form').classList.add('active');
    setTimeout(() => $('pf-desc').focus(), 100);
  },

  _closeForm() {
    $('proiob-modal-form').classList.remove('active');
    Proiob._editId = null;
  },

  async _submitForm() {
    const btn  = $('proiob-form-submit');
    const dept = $('pf-dept').value;
    const desc = $('pf-desc').value.trim();
    const isWaiter = currentUser.role === 'waiter' || currentUser.role2 === 'waiter';
    const isKitchenUser = canConfirmProiobPrice(currentUser) || (currentUser.role === 'chef');
    const price = parseInt($('pf-price').value) || 0;

    if (!desc) { toast('Заповніть опис ситуації', 'error'); return; }
    if (isWaiter && !Proiob._editId && price <= 0) { toast('Вкажіть ціну вирішення', 'error'); return; }

    btnLock(btn);
    try {
      if (Proiob._editId) {
        // Редагування
        const upd = { dept, description: desc };
        const r   = Proiob._records.find(x => x.id === Proiob._editId);
        if (!r.price_confirmed && !isKitchenUser && price > 0) upd.waiter_price = price;
        await sb.update('proiob_records', upd, { id: Proiob._editId });
        const i = Proiob._records.findIndex(x => x.id === Proiob._editId);
        if (i >= 0) Object.assign(Proiob._records[i], upd);
        toast('Анкету оновлено', 'success-t');
      } else {
        // Створення
        const row = {
          dept,
          description: desc,
          waiter_price: isWaiter ? price : 0,
          kitchen_price:     null,
          price_confirmed:   false,
          confirmed_by:      null,
          confirmed_by_name: null,
          created_by:        currentUser.id,
          created_by_name:   currentUser.displayName || currentUser.login,
          created_at:        new Date().toISOString(),
        };
        const [inserted] = await sb.insert('proiob_records', row);
        Proiob._records.unshift(inserted || { ...row, id: 'tmp_' + Date.now() });
        logEvent('proiob', 'Нова анкета Пройоб', desc.slice(0, 60));
        toast('✅ Анкету створено', 'success-t');
      }
    } catch(e) {
      toast('Помилка збереження', 'error');
      console.error('Proiob submit error:', e);
      btnUnlock(btn);
      return;
    }

    Proiob._closeForm();
    Proiob._renderList();
    btnUnlock(btn);
  },

  // ── Видалити ──────────────────────────────────────────────────
  async _deleteRecord(id) {
    const r = Proiob._records.find(x => x.id === id);
    if (!r) return;
    if (r.created_by !== currentUser.id) { toast('Можна видалити лише свою анкету', 'error'); return; }
    showConfirm(`Видалити анкету "${r.description.slice(0,40)}…"?`, async () => {
      try {
        await sb.delete('proiob_records', { id });
        Proiob._records = Proiob._records.filter(x => x.id !== id);
        toast('Анкету видалено', 'info');
        Proiob._renderList();
      } catch(e) { toast('Помилка видалення', 'error'); console.error(e); }
    }, { okLabel: '🗑 Видалити', okClass: 'btn-danger' });
  },

  // ── Закрити анкету (видалити назавжди) ───────────────────────
  _openClose(id) {
    Proiob._closeId = id;
    $('proiob-modal-close').classList.add('active');
  },
  _closeClose() {
    $('proiob-modal-close').classList.remove('active');
    Proiob._closeId = null;
  },
  async _submitClose() {
    const btn = $('proiob-close-submit');
    if (!Proiob._closeId) return;
    btnLock(btn);
    try {
      await sb.delete('proiob_records', { id: Proiob._closeId });
      Proiob._records = Proiob._records.filter(x => x.id !== Proiob._closeId);
      logEvent('proiob', 'Закрито анкету Пройоб');
      toast('🔒 Анкету закрито і видалено', 'info');
    } catch(e) { toast('Помилка', 'error'); console.error(e); btnUnlock(btn); return; }
    Proiob._closeClose();
    Proiob._renderList();
    btnUnlock(btn);
  },

  // ── Підтвердити ціну (кухар) ─────────────────────────────────
  _openConfirm(id) {
    const r = Proiob._records.find(x => x.id === id);
    if (!r) return;
    Proiob._confirmId = id;
    $('proiob-confirm-price').value = '';
    $('proiob-confirm-body').innerHTML =
      `<b>${esc(r.created_by_name)}</b> запропонував(ла): ` +
      `<span style="color:var(--gold);font-weight:800">${r.waiter_price || '—'} грн</span><br>` +
      `<span style="font-size:11px">Ви можете прийняти цю ціну або вписати свою.</span>`;
    $('proiob-modal-confirm').classList.add('active');
  },
  _closeConfirm() {
    $('proiob-modal-confirm').classList.remove('active');
    Proiob._confirmId = null;
  },
  async _submitConfirm() {
    const btn = $('proiob-confirm-submit');
    const r   = Proiob._records.find(x => x.id === Proiob._confirmId);
    if (!r) return;

    const inputVal = parseInt($('proiob-confirm-price').value);
    const kitchenPrice = (inputVal && inputVal > 0) ? inputVal : null;

    btnLock(btn);
    try {
      const upd = {
        kitchen_price:     kitchenPrice,
        price_confirmed:   true,
        confirmed_by:      currentUser.id,
        confirmed_by_name: currentUser.displayName || currentUser.login,
      };
      await sb.update('proiob_records', upd, { id: Proiob._confirmId });
      const i = Proiob._records.findIndex(x => x.id === Proiob._confirmId);
      if (i >= 0) Object.assign(Proiob._records[i], upd);
      const finalPrice = kitchenPrice ?? r.waiter_price;
      logEvent('proiob', 'Підтверджено ціну Пройоб', `${finalPrice} грн`);
      toast(`✅ Ціну підтверджено — ${finalPrice} грн`, 'success-t');
    } catch(e) { toast('Помилка', 'error'); console.error(e); btnUnlock(btn); return; }

    Proiob._closeConfirm();
    Proiob._renderList();
    btnUnlock(btn);
  },

  // ── Форматування часу ─────────────────────────────────────────
  _fmtTime(iso) {
    if (!iso) return '';
    const d    = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (diff < 1)    return 'щойно';
    if (diff < 60)   return diff + ' хв. тому';
    if (diff < 1440) {
      const h = Math.floor(diff / 60), m = diff % 60;
      return `${h}г ${m > 0 ? m + 'хв' : ''} тому`.trim();
    }
    const MONTHS = ['січ','лют','бер','квіт','трав','черв','лип','серп','вер','жовт','лист','груд'];
    return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
};
