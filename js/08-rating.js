// ╔═══════════════════════════════════════════════════════════════╗
// ║  [9/13]  РЕЙТИНГ (топ персоналу, топ каси)                    ║
// ╚═══════════════════════════════════════════════════════════════╝
let ratingTab = 'top';
// Стан рейтингу каси
const RatingCash = {
  period: 'h1',   // h1 | h2 | month | year
  month:  new Date().getMonth(),
  year:   new Date().getFullYear(),
};

const Rating = {
  init() {
    Rating.showTab('top');
  },

  async showTab(tab) {
    ratingTab = tab;
    // Головні таби (топ персоналу / топ каси) — перші два .rating-tab без батька #cash-top-period-tabs
    document.querySelectorAll('#page-rating > .rating-tabs .rating-tab').forEach((b,i)=>{
      b.classList.toggle('active', (i===0&&tab==='top')||(i===1&&tab==='cashTop'));
    });
    $('rating-top').classList.toggle('hidden', tab!=='top');
    $('rating-cashTop').classList.toggle('hidden', tab!=='cashTop');
    if (tab==='top') {
      Rating.renderTop();
    } else {
      // Завантажити касу для всіх офіціантів перед рендерингом — завжди свіжу
      const waiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');
      const listEl = $('cash-top-list');
      if (listEl) listEl.innerHTML = `<p class="muted" style="text-align:center;padding:20px">⏳ Завантаження...</p>`;
      await Promise.all(waiters.map(u => Cash.loadUserCash(u.id, true)));
      Rating.renderCashTop();
    }
  },

  setCashPeriod(period) {
    RatingCash.period = period;
    // Підвкладки
    document.querySelectorAll('#cash-top-period-tabs .rating-tab').forEach((b,i)=>{
      b.classList.toggle('active', ['h1','h2','month','year'][i] === period);
    });
    // Показати потрібний навігатор
    const isYear = period === 'year';
    const monthNav = $('cash-top-month-nav');
    const yearNav  = $('cash-top-year-nav');
    monthNav.classList.remove('hidden'); monthNav.style.display = isYear ? 'none' : 'flex';
    yearNav.classList.remove('hidden');  yearNav.style.display  = isYear ? 'flex' : 'none';
    Rating.renderCashTop();
  },

  shiftMonth(delta) {
    RatingCash.month += delta;
    if (RatingCash.month < 0)  { RatingCash.month = 11; RatingCash.year--; }
    if (RatingCash.month > 11) { RatingCash.month = 0;  RatingCash.year++; }
    Rating.renderCashTop();
  },

  shiftYear(delta) {
    RatingCash.year += delta;
    Rating.renderCashTop();
  },
  // Оновлює відображення числа при русі слайдера
  updateSlider(input) {
    const uid = input.dataset.uid;
    const v = parseInt(input.value);
    const label = document.querySelector(`[data-rval="${uid}"]`);
    if (!label) return;
    label.textContent = (v > 0 ? '+' : '') + v;
    label.style.color = v >= 0 ? 'var(--success)' : 'var(--danger)';
  },

  // Зміщує слайдер на delta і оновлює відображення
  nudge(uid, delta) {
    const slider = document.querySelector(`input[data-uid="${uid}"]`);
    if (!slider) return;
    const v = Math.max(-100, Math.min(100, (parseInt(slider.value) || 0) + delta));
    slider.value = v;
    Rating.updateSlider(slider);
  },

  renderTop() {
    const ratings = DB.get('ratings',{});
    // Показуємо всіх офіціантів (незалежно від каси) + барменів + хостес
    const users = getUsers().filter(u=>['waiter','barman','hostess'].includes(u.role))
      .sort((a,b) => {
        const ra = (ratings[a.id]||{score:0}).score;
        const rb = (ratings[b.id]||{score:0}).score;
        return rb - ra;
      });
    let html = '';
    users.forEach(user => {
      const r = ratings[user.id]||{score:0, comments:[]};
      const score = r.score||0;
      const pct = ((score+100)/200*100).toFixed(1);
      const canEdit = isAdmin(currentUser);
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const comments = (r.comments||[])
        .filter(c => {
          if (!c.ts) return true; // старі записи без timestamp — показуємо
          return c.ts >= threeDaysAgo;
        })
        .slice(-3).reverse();

      html += `<div class="card" style="margin-bottom:0">
        <div style="display:flex;gap:12px;align-items:flex-start">
          ${avatarHTML(user,44,16)}
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div style="min-width:0">
                <span style="font-weight:700;font-size:13px">${esc(user.displayName||user.login)}</span>
                ${user.nick?`<span class="muted" style="font-size:11px"> · ${esc(user.nick)}</span>`:''}
                <span class="badge badge-gold" style="margin-left:6px;font-size:9px">${getRoleLabel(user.role)}</span>
              </div>
              <span style="font-size:18px;font-weight:800;color:${score>=0?'var(--success)':'var(--danger)'};flex-shrink:0">${score>0?'+':''}${score}</span>
            </div>
            <div class="rating-bar-wrap" style="margin-top:8px">
              <div class="rating-bar-zero"></div>
              <div class="rating-bar-fill" style="
                ${score>=0?'left:50%;width:'+pct/2+'%':'right:'+(50-pct/2)+'%;width:'+(50-pct/2)+'%;left:auto;'}
                background:${score>=0?'var(--success)':'var(--danger)'}"></div>
            </div>
            ${canEdit ? `<div style="margin-top:10px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <input type="range" min="-100" max="100" value="${score}"
                  class="rating-slider"
                  oninput="Rating.updateSlider(this)"
                  data-uid="${user.id}">
                <span class="rval" data-rval="${user.id}" style="color:${score>=0?'var(--success)':'var(--danger)'};font-size:15px;font-weight:800;min-width:38px;text-align:right">${score>0?'+':''}${score}</span>
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
                ${[-10,-5,-1,+1,+5,+10].map(d=>`
                  <button onclick="Rating.nudge('${user.id}',${d})"
                    style="background:${d<0?'rgba(224,90,90,.12)':'rgba(72,199,142,.12)'};border:1px solid ${d<0?'rgba(224,90,90,.3)':'rgba(72,199,142,.3)'};border-radius:6px;color:${d<0?'var(--danger)':'var(--success)'};font-size:11px;font-weight:700;padding:4px 8px;cursor:pointer;flex:1"
                  >${d>0?'+':''}${d}</button>`).join('')}
              </div>
              <div style="display:flex;gap:6px">
                <input type="text" class="field" style="font-size:11px;padding:6px 10px" placeholder="Коментар..." id="comment-${user.id}">
                <button class="btn btn-gold btn-sm" onclick="Rating.save('${user.id}')">OK</button>
              </div>
            </div>` : ''}
            ${comments.length ? `<div style="margin-top:8px">${comments.map(c=>`
              <div class="comment-item">
                <div class="comment-item-body">
                  <span style="color:var(--text-dim);font-size:10px">${c.date} · ${esc(c.by)}</span>
                  ${c.text ? `<br><span>${esc(c.text)}</span>` : ''}
                </div>
                <span class="comment-item-delta" style="color:${c.delta>=0?'var(--success)':'var(--danger)'}">${c.delta>0?'+':''}${c.delta}</span>
              </div>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>`;
    });
    $('rating-list').innerHTML = html || `<p class="muted" style="padding:20px;text-align:center">Немає офіціантів/барменів/хостес у системі</p>`;
  },

  async save(userId) {
    const slider = document.querySelector(`input[data-uid="${userId}"]`);
    const commentEl = $(`comment-${userId}`);
    if (!slider) return;
    const newScore = parseInt(slider.value);
    const ratings = DB.get('ratings',{});
    const prev = ratings[userId]||{score:0,comments:[]};
    const delta = newScore - (prev.score||0);
    const comment = commentEl ? commentEl.value.trim() : '';
    ratings[userId] = {
      score: newScore,
      comments: [...(prev.comments||[]), { date: new Date().toLocaleDateString('uk'), by: currentUser.displayName||currentUser.login, delta, text: comment, ts: Date.now() }]
    };
    DB.set('ratings', ratings);
    try {
      await sb.upsert('ratings', { user_id: userId, score: newScore, updated_at: new Date().toISOString() }, 'user_id');
      if (comment || delta !== 0) {
        await sb.insert('rating_comments', { user_id: userId, author: currentUser.displayName||currentUser.login, delta, comment });
      }
      toast('Рейтинг оновлено', 'success-t');
    } catch(e) { toast('Помилка збереження', 'error'); console.error(e); }
    Rating.renderTop();
  },

  renderCashTop() {
    const { period, month: m, year: y } = RatingCash;
    const cashDB = DB.get('cash', {});
    const waiters = getUsers().filter(u => u.role === 'waiter' || u.role2 === 'waiter');

    // Діапазон дат по поточному periodу
    let from, to, periodLabel, cardTitle;
    if (period === 'h1') {
      from = new Date(y, m, 1);
      to   = new Date(y, m, 14, 23, 59, 59);
      periodLabel = `${MONTHS_UA[m]} ${y}`;
      cardTitle   = `Топ каси · 1–14 ${MONTHS_UA[m]}`;
    } else if (period === 'h2') {
      from = new Date(y, m, 15);
      to   = new Date(y, m + 1, 0, 23, 59, 59);
      periodLabel = `${MONTHS_UA[m]} ${y}`;
      cardTitle   = `Топ каси · 15–${new Date(y, m+1, 0).getDate()} ${MONTHS_UA[m]}`;
    } else if (period === 'month') {
      from = new Date(y, m, 1);
      to   = new Date(y, m + 1, 0, 23, 59, 59);
      periodLabel = `${MONTHS_UA[m]} ${y}`;
      cardTitle   = `Топ каси · ${MONTHS_UA[m]} ${y}`;
    } else { // year
      from = new Date(y, 0, 1);
      to   = new Date(y, 11, 31, 23, 59, 59);
      cardTitle = `Топ каси · ${y} рік`;
    }

    // Оновити лейбли навігаторів
    const monthLabel = $('cash-top-month-label');
    const yearLabel  = $('cash-top-year-label');
    if (monthLabel) monthLabel.textContent = periodLabel || '';
    if (yearLabel)  yearLabel.textContent  = String(y);

    const titleEl = $('cash-top-card-title');
    if (titleEl) titleEl.textContent = cardTitle;

    // Ранжуємо за сумою ПЕРШОЇ каси за кожен день у período
    const ranked = waiters.map(u => {
      const entries = cashDB[u.id] || {};
      const total = Object.entries(entries)
        .filter(([dk]) => { const d = parseDateKey(dk); return d >= from && d <= to; })
        .reduce((sum, [, v]) => {
          // Використовуємо firstCash якщо є, інакше cash (для старих записів)
          const val = (v.firstCash != null) ? v.firstCash : (parseFloat(v.cash) || 0);
          return sum + val;
        }, 0);
      return { u, total };
    }).sort((a, b) => b.total - a.total);

    const maxTotal = ranked[0]?.total || 1;

    const medals = ['🥇','🥈','🥉'];
    const list = $('cash-top-list');
    if (!list) return;

    if (!ranked.length || ranked.every(r => r.total === 0)) {
      list.innerHTML = `<p class="muted" style="text-align:center;padding:20px">Немає даних за цей період</p>`;
      return;
    }

    list.innerHTML = ranked.map(({ u, total }, i) => {
      const barW = maxTotal > 0 ? (total / maxTotal * 100).toFixed(1) : 0;
      const medal = medals[i] || `<span style="font-size:12px;color:var(--text-dim)">#${i+1}</span>`;
      const isLeader = i === 0 && total > 0;
      // Число каси навмисно НЕ показуємо — тільки позиція і бар
      return `<div style="padding:12px;background:rgba(0,0,0,${isLeader?'.3':'.15'});border:1px solid ${isLeader?'var(--gold-border)':'rgba(255,255,255,.06)'};border-radius:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:${i<3?'20':'13'}px;width:24px;text-align:center;flex-shrink:0">${medal}</span>
          ${avatarHTML(u, 36, 13)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px">${u.displayName||u.login}${u.nick?` <span style="font-size:11px;color:var(--text-dim)">(${u.nick})</span>`:''}</div>
            <div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;margin-top:6px;overflow:hidden">
              <div style="height:100%;width:${barW}%;background:${isLeader?'var(--gold)':'rgba(255,255,255,.25)'};border-radius:3px;transition:width .4s"></div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
};

