/* ─── Демо-дані (використовуються лише коли Supabase не налаштований) ─── */
const DemoData = (() => {
  const seed = () => {
    const users = [
      { id: 'u1', name: 'Діма',    role: 'sysadmin', role2: null,      pin: '0000', tg: '' },
      { id: 'u2', name: 'Тамара',  role: 'admin',    role2: 'hostess', pin: '1111', tg: '' },
      { id: 'u3', name: 'Оксана',  role: 'waiter',   role2: null,      pin: '2222', tg: '' },
      { id: 'u4', name: 'Гіоргі',  role: 'waiter',   role2: 'bar',     pin: '2223', tg: '' },
      { id: 'u5', name: 'Марія',   role: 'waiter',   role2: null,      pin: '2224', tg: '' },
      { id: 'u6', name: 'Сергій',  role: 'cook',     role2: null,      pin: '3333', tg: '' },
      { id: 'u7', name: 'Нателла', role: 'cook',     role2: null,      pin: '3334', tg: '' },
      { id: 'u8', name: 'Максим',  role: 'chef',     role2: null,      pin: '4444', tg: '' },
      { id: 'u9', name: 'Ніно',    role: 'hostess',  role2: null,      pin: '5555', tg: '' },
      { id: 'u10', name: 'Артем',  role: 'runner',   role2: null,      pin: '6666', tg: '' },
    ];

    const shiftTypes = [
      { code: 'Р', label: 'Повна зміна', color: 'green' },
      { code: 'Д', label: 'Денна',       color: 'gold' },
      { code: 'В', label: 'Вечірня',     color: 'accent' },
      { code: 'Х', label: 'Вихідний',    color: 'muted' },
      { code: 'О', label: 'Відпустка',   color: 'muted' },
    ];

    // графік: поточний місяць, детермінований візерунок
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const schedule = [];
    users.forEach((u, ui) => {
      for (let d = 1; d <= days; d++) {
        const rot = (d + ui * 2) % 4;
        let code = rot === 0 ? 'Х' : (rot === 1 ? 'Д' : (rot === 2 ? 'Р' : 'В'));
        if (u.role === 'sysadmin') code = 'Р';
        schedule.push({ id: `s-${u.id}-${d}`, user_id: u.id, date: `${y}-${U.pad(m + 1)}-${U.pad(d)}`, code });
      }
    });

    // каса: записи офіціантів за останні 12 днів
    const cash = [];
    const waiters = users.filter(u => u.role === 'waiter');
    for (let i = 0; i < 12; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      waiters.forEach((w, wi) => {
        if ((i + wi) % 3 === 0) return; // вихідний
        cash.push({
          id: `c-${w.id}-${i}`, user_id: w.id, date: U.iso(d),
          amount: 2400 + ((i * 137 + wi * 511) % 3200),
        });
      });
    }

    const menu = [
      { id: 'm1',  section: 'Хачапурі', name: 'Хачапурі по-аджарськи', price: 265, stopped: false },
      { id: 'm2',  section: 'Хачапурі', name: 'Хачапурі по-імеретинськи', price: 235, stopped: false },
      { id: 'm3',  section: 'Хачапурі', name: 'Хачапурі по-мегрельськи', price: 255, stopped: false },
      { id: 'm4',  section: 'Хінкалі', name: 'Хінкалі з телятиною (5 шт)', price: 210, stopped: false },
      { id: 'm5',  section: 'Хінкалі', name: 'Хінкалі з сиром (5 шт)', price: 195, stopped: true },
      { id: 'm6',  section: 'Гарячі страви', name: 'Чахохбілі з курки', price: 245, stopped: false },
      { id: 'm7',  section: 'Гарячі страви', name: 'Оджахурі зі свининою', price: 260, stopped: false },
      { id: 'm8',  section: 'Гарячі страви', name: 'Чашушулі', price: 285, stopped: false },
      { id: 'm9',  section: 'Холодні закуски', name: 'Пхалі асорті', price: 185, stopped: false },
      { id: 'm10', section: 'Холодні закуски', name: 'Сациві з курки', price: 225, stopped: true },
      { id: 'm11', section: 'Холодні закуски', name: 'Лобіо в горщику', price: 165, stopped: false },
      { id: 'm12', section: 'Десерти', name: 'Чурчхела домашня', price: 85, stopped: false },
      { id: 'm13', section: 'Десерти', name: 'Пеламуші', price: 95, stopped: false },
      { id: 'm14', section: 'Напої', name: 'Лимонад тархун 0.5', price: 75, stopped: false },
      { id: 'm15', section: 'Напої', name: 'Сапераві (келих)', price: 120, stopped: false },
    ];

    const t = U.todayISO();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const reserves = [
      { id: 'r1', date: t, time: '13:00', name: 'Ірина', phone: '+380 67 111 22 33', guests: 4, table: '7', note: 'День народження, потрібна свічка' },
      { id: 'r2', date: t, time: '19:30', name: 'Вахтанг', phone: '+380 50 222 33 44', guests: 8, table: '12+13', note: 'Просили тихий зал' },
      { id: 'r3', date: U.iso(tomorrow), time: '18:00', name: 'Олена', phone: '+380 93 555 66 77', guests: 2, table: '3', note: '' },
    ];

    return { users, roles: [], shift_types: shiftTypes, schedule, cash, menu, reserves, settings: [] };
  };
  return { seed };
})();
