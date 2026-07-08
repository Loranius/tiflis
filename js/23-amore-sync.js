// ╔═══════════════════════════════════════════════════════════════╗
// ║  СИНХРОНІЗАЦІЯ ГРАФІКА ДІМИ → AMORE ("Графік" на порталі бобосів) ║
// ╚═══════════════════════════════════════════════════════════════╝
// Кожна зміна, яку Діма (або хтось за нього) вносить у графік
// на Тефлісі, автоматично дублюється в таблицю work_schedule
// проєкту Amore — щоб Лєна одразу бачила його графік на "своєму"
// порталі, без ручного перенесення.
//
// Працює напряму через REST (PostgREST), без підключення supabase-js:
// у проєкті Amore таблиця work_schedule має відкриті RLS-політики
// (select/insert/update/delete using(true)), тож досить anon-ключа.
//
// Мапінг позначок:
//   будь-яка непорожня зміна в Тефлісі (Р, СН, Б, Р/Б, СН/Б, С, О...) → 'Р' (робочий) в Amore
//   порожня клітинка / зміну прибрано                                  → 'Х' (вихідний) в Amore
const AmoreSync = {
  URL:  'https://yicalgoqegluzuagxssk.supabase.co',
  KEY:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpY2FsZ29xZWdsdXp1YWd4c3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MDg0NTgsImV4cCI6MjA5NzA4NDQ1OH0.VhF_C0M4QZWKxcpqxxs0zbJxnrzKGLc1DKT1awMVJAE',
  DIMA_NAME: 'Діма',
  CACHE_KEY: 'amoreSync_dimaUserId',

  _amoreUserId: null,
  _resolvePromise: null,

  // Чи належить цей запис графіку Тефліса саме Дімі (звіряємо по імені,
  // а не по id — id-шники в Тефлісі й Amore різні системи)
  isDima(tiflisUserId) {
    const u = (typeof getUserById === 'function') ? getUserById(tiflisUserId) : null;
    return !!u && (u.name || '').trim().toLowerCase() === AmoreSync.DIMA_NAME.toLowerCase();
  },

  // Знаходимо id Діми в таблиці users проєкту Amore (один раз, потім кеш)
  async _resolveAmoreUserId() {
    if (AmoreSync._amoreUserId) return AmoreSync._amoreUserId;

    const cached = localStorage.getItem(AmoreSync.CACHE_KEY);
    if (cached) { AmoreSync._amoreUserId = cached; return cached; }

    if (AmoreSync._resolvePromise) return AmoreSync._resolvePromise;

    AmoreSync._resolvePromise = (async () => {
      try {
        const res = await fetch(`${AmoreSync.URL}/rest/v1/users?select=id,name`, {
          headers: { apikey: AmoreSync.KEY, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(await res.text());
        const users = await res.json();
        const dima = (users || []).find(u =>
          (u.name || '').trim().toLowerCase() === AmoreSync.DIMA_NAME.toLowerCase()
        );
        if (!dima) {
          console.warn('[AmoreSync] У проєкті Amore не знайдено користувача з іменем "Діма"');
          return null;
        }
        AmoreSync._amoreUserId = dima.id;
        localStorage.setItem(AmoreSync.CACHE_KEY, String(dima.id));
        return dima.id;
      } catch (e) {
        console.warn('[AmoreSync] Не вдалось визначити user_id в Amore:', e);
        return null;
      } finally {
        AmoreSync._resolvePromise = null;
      }
    })();

    return AmoreSync._resolvePromise;
  },

  // Позначки Тефліса, які означають "не працює" (вихідний / відпустка) —
  // мають стати саме 'Х' в Amore, а не помилково потрапити в "робочий" день
  OFF_TYPES: new Set(['Х', 'О']),

  _mapMark(shift) {
    const trimmed = (shift || '').trim();
    if (!trimmed) return 'Х';                       // порожня клітинка = вихідний
    if (AmoreSync.OFF_TYPES.has(trimmed)) return 'Х'; // явний "Х" або "О" = вихідний
    return 'Р';                                       // будь-яка робоча зміна = робочий
  },

  // Головна точка входу — викликається після кожного збереження зміни
  // в графіку Тефліса. Мовчки нічого не робить, якщо це не Діма,
  // або якщо Amore тимчасово недоступний (не блокує основний UI Тефліса).
  async pushShift(tiflisUserId, date, shift) {
    if (!AmoreSync.isDima(tiflisUserId)) return;

    const amoreUserId = await AmoreSync._resolveAmoreUserId();
    if (!amoreUserId) return;

    const mark = AmoreSync._mapMark(shift);

    try {
      const res = await fetch(`${AmoreSync.URL}/rest/v1/work_schedule?on_conflict=date,user_id`, {
        method: 'POST',
        headers: {
          apikey: AmoreSync.KEY,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          date,
          user_id: amoreUserId,
          mark,
          updated_at: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error(await res.text());
      console.log(`[AmoreSync] ${date} → ${mark} (синхронізовано в Amore)`);
    } catch (e) {
      // Не показуємо toast користувачу — це фонова синхронізація,
      // її збій не повинен заважати роботі з основним графіком.
      console.warn('[AmoreSync] Помилка синхронізації з Amore:', date, e);
    }
  }
};
