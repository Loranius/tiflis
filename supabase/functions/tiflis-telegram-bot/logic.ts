/*
 * The Tiflis group bot's decisions: command parsing, roles and departments,
 * mentions, stable daily picks, horoscopes and every message text. No runtime
 * imports, so it is unit-tested from Node (`npm test`) and used by index.ts.
 *
 * Rules (spec 2026-11-23): Latin command names, Ukrainian text, «ти», teasing
 * only about work, and never any money in the chat.
 */

export type RoleKey = 'waiter' | 'bar' | 'cook' | 'chef' | 'runner' | 'hostess' | 'admin';
export type Department = 'all' | 'waiters' | 'kitchen' | 'bar' | 'hostess' | 'admins';

export interface Member {
  tgId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  manualRole: RoleKey | null;
  portal: { name: string; role: string | null; role2: string | null } | null;
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  waiter: 'офіціант',
  bar: 'бармен',
  cook: 'кухар',
  chef: 'шеф',
  runner: 'ранер',
  hostess: 'хостес',
  admin: 'адмін',
};

const DEPARTMENT_ROLES: Record<Exclude<Department, 'all'>, RoleKey[]> = {
  waiters: ['waiter'],
  kitchen: ['cook', 'chef'],
  bar: ['bar'],
  hostess: ['hostess'],
  admins: ['admin'],
};

export const COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'all', description: 'Покликати всіх у чаті' },
  { command: 'waiters', description: 'Покликати офіціантів' },
  { command: 'kitchen', description: 'Покликати кухню' },
  { command: 'bar', description: 'Покликати бар' },
  { command: 'hostess', description: 'Покликати хостес' },
  { command: 'admins', description: 'Покликати адмінів' },
  { command: 'today', description: 'Хто сьогодні на зміні' },
  { command: 'best', description: 'Найкращий офіціант дня' },
  { command: 'horoscope', description: 'Гороскоп на сьогодні' },
  { command: 'birthdays', description: 'Найближчі дні народження' },
  { command: 'stop', description: 'Стоп-лист' },
  { command: 'roles', description: 'Хто є хто' },
  { command: 'role', description: 'Призначити роль (адмін, відповіддю)' },
  { command: 'help', description: 'Що я вмію' },
];

export const HELP_TEXT = [
  '🥟 <b>Я — бот Тифлісу.</b> Ось що я вмію:',
  '',
  '/all — покликати всіх у чаті',
  '/waiters · /kitchen · /bar · /hostess · /admins — покликати свій відділ',
  '/today — хто сьогодні на зміні',
  '/best — найкращий офіціант дня',
  '/horoscope — твій гороскоп на сьогодні',
  '/birthdays — найближчі дні народження',
  '/stop — стоп-лист',
  '/roles — хто є хто',
  '/role кухар — призначити роль (адмін, відповіддю на повідомлення людини; /role - прибрати)',
  '',
  'Ролі я беру з порталу Тифлісу. Кого там немає — адмін призначає вручну.',
].join('\n');

/** «/all», «/all@TiflisBot args»; null for text, or a command addressed to another bot. */
export function parseCommand(text: string, botUsername: string): { command: string; args: string } | null {
  const match = /^\/([A-Za-z_]+)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/.exec((text || '').trim());
  if (!match) return null;
  const [, command = '', target, args = ''] = match;
  if (target && target.toLowerCase() !== botUsername.toLowerCase()) return null;
  return { command: command.toLowerCase(), args: args.trim() };
}

export function normalizeRole(value: string | null | undefined): RoleKey | null {
  const role = (value || '').trim().toLowerCase();
  if (role === 'barman' || role === 'bartender' || role === 'bar') return 'bar';
  if (role === 'sysadmin' || role === 'admin') return 'admin';
  if (role === 'waiter' || role === 'cook' || role === 'chef' || role === 'runner' || role === 'hostess') return role;
  return null;
}

const ROLE_WORDS: Record<string, RoleKey> = Object.fromEntries(
  Object.entries(ROLE_LABELS).map(([key, label]) => [label, key as RoleKey]),
);

export function parseRoleArg(text: string): RoleKey | 'clear' | null {
  const word = (text || '').trim().toLowerCase();
  if (word === '-' || word === '—') return 'clear';
  return ROLE_WORDS[word] ?? null;
}

/** A manual role wins on its own; otherwise the portal role and second role. */
export function rolesOf(member: Member): RoleKey[] {
  if (member.manualRole) return [member.manualRole];
  if (!member.portal) return [];
  return [normalizeRole(member.portal.role), normalizeRole(member.portal.role2)]
    .filter((role, index, all): role is RoleKey => Boolean(role) && all.indexOf(role) === index);
}

export function inDepartment(member: Member, department: Department): boolean {
  if (department === 'all') return true;
  const wanted = DEPARTMENT_ROLES[department];
  return rolesOf(member).some((role) => wanted.includes(role));
}

export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function displayName(member: Member): string {
  const name = member.portal?.name || [member.firstName, member.lastName].filter(Boolean).join(' ');
  return name.trim() || 'Учасник';
}

export function mentionHtml(member: Member): string {
  if (member.username) return `@${member.username}`;
  return `<a href="tg://user?id=${member.tgId}">${escapeHtml(displayName(member))}</a>`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/** FNV-1a: the same seed always picks the same item. */
function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

export function dailyPick<T>(items: T[], seed: string): T | null {
  if (!items.length) return null;
  return items[hash(seed) % items.length] ?? null;
}

export function isWorkingShift(code: string | null | undefined): boolean {
  const value = (code || '').trim();
  return Boolean(value) && value !== 'Х' && value !== 'О';
}

/* ─── Zodiac ─── */

const SIGNS = ['Козеріг', 'Водолій', 'Риби', 'Овен', 'Телець', 'Близнюки', 'Рак', 'Лев', 'Діва', 'Терези', 'Скорпіон', 'Стрілець'] as const;
/** First day of each sign, by month: [month, day, sign]. */
const SIGN_STARTS: Array<[number, number, string]> = [
  [1, 20, 'Водолій'], [2, 19, 'Риби'], [3, 21, 'Овен'], [4, 20, 'Телець'], [5, 21, 'Близнюки'], [6, 21, 'Рак'],
  [7, 23, 'Лев'], [8, 23, 'Діва'], [9, 23, 'Терези'], [10, 23, 'Скорпіон'], [11, 22, 'Стрілець'], [12, 22, 'Козеріг'],
];

/** From the portal's «♐ Стрілець», else from a «YYYY-MM-DD» or «MM-DD» birthday. */
export function zodiacSign(zodiac: string | null, birthday: string | null): string | null {
  const named = SIGNS.find((sign) => (zodiac || '').includes(sign));
  if (named) return named;
  const match = /(?:^|\D)(\d{2})-(\d{2})$/.exec((birthday || '').trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let sign = 'Козеріг';
  for (const [startMonth, startDay, name] of SIGN_STARTS) {
    if (month > startMonth || (month === startMonth && day >= startDay)) sign = name;
  }
  return sign;
}

/* ─── Horoscope ─── */

const BY_SIGN: Record<string, string[]> = {
  'Овен': ['Зірки кажуть: сьогодні ти першим біжиш до нового столу. Головне — не збити ранера.', 'Енергії в тебе на три зміни. Витрать її на допродаж, а не на суперечки на кухні.', 'Марс радить: менше «е-е-е», більше «рекомендую».', 'Сьогодні ти таран. Пробивай стоп-лист і настрій гостей.'],
  'Телець': ['Сьогодні тобі пощастить з тими, хто замовляє десерт. Не проґав їх.', 'Зірки радять: не сперечайся з гостем про прожарку. Просто кивай.', 'Твій день для неквапливої, але дорогої подачі.', 'Венера обіцяє добрі чайові. Але тільки якщо посміхнешся.'],
  'Близнюки': ['Сьогодні ти зможеш тримати в голові п\'ять замовлень одразу. Запиши все одно.', 'Зірки радять балакати з гостями, а не з колегами на роздачі.', 'Твоя чарівність сьогодні продає вино. Користуйся.', 'Двоє в одному: офіціант і стендап. Публіка твоя.'],
  'Рак': ['Сьогодні ти відчуваєш гостя з першого погляду. Відчуй і його бажання взяти хінкалі.', 'Зірки радять не ховатися в підсобці. Зал чекає.', 'Тебе захистить панцир спокою навіть від найвибагливішого столу.', 'Місяць каже: обійми свій поднос — він твій найкращий друг сьогодні.'],
  'Лев': ['Сьогодні ти зірка залу. Сяй, але не забувай про рахунки.', 'Сонце радить: ходи так, ніби ти власник ресторану. Тільки працюй як офіціант.', 'Гості аплодуватимуть твоїй подачі. Ну, майже.', 'Твій рик сьогодні — «чи бажаєте ще щось?». Повторюй частіше.'],
  'Діва': ['Сьогодні ти помітиш крихту на скатертині за три столи. Прибери.', 'Зірки радять: перевір замовлення двічі, ти ж Діва.', 'Твій порядок сьогодні врятує зміну. І серветки.', 'Ідеальна сервіровка — твоя суперсила. Не витрачай її на сварки.'],
  'Терези': ['Сьогодні ти знайдеш баланс між швидкістю і посмішкою. Рідкісний день.', 'Зірки радять не вагатися між вином і чачею. Пропонуй обидва.', 'Твоя дипломатія сьогодні рятує стіл, що сперечається через рахунок.', 'Гармонія у залі починається з тебе. І закінчується на кухні.'],
  'Скорпіон': ['Сьогодні твій погляд продає краще за меню. Дивись уважно.', 'Зірки радять жалити лише цінами на вино.', 'Таємничість — твоя фішка. Але назву страви все-таки скажи.', 'Сьогодні ти розкусиш будь-якого гостя. Головне — не вголос.'],
  'Стрілець': ['Сьогодні ти влучаєш у ціль: кожна рекомендація — в яблучко.', 'Зірки радять не стріляти очима в колег, а замовленнями — на кухню.', 'Пригода дня: стіл на 12 без попередження. Ти впораєшся.', 'Твій оптимізм сьогодні заразний. Заражай гостей десертами.'],
  'Козеріг': ['Сьогодні ти будуєш касу цеглинка за цеглинкою. Наполегливо.', 'Зірки радять: план — це добре, але гостю теж треба посміхнутися.', 'Твоя дисципліна сьогодні тримає всю зміну. Не розслабляйся.', 'Сатурн каже: робота сама себе не зробить. Але ти зробиш.'],
  'Водолій': ['Сьогодні в тебе з\'явиться геніальна ідея подачі. Спершу спитай шефа.', 'Зірки радять бути оригінальним, але меню не переписувати.', 'Твоя дивакуватість сьогодні подобається гостям. Користуйся.', 'Свіжий погляд на старий стіл — і чайові вже інші.'],
  'Риби': ['Сьогодні ти пливеш залом, як риба у воді. Не забудь про воду для гостей.', 'Зірки радять менше мріяти біля бару, більше носити.', 'Інтуїція підкаже, хто з гостей хоче хінкалі. Усі.', 'Твоя м\'якість сьогодні рятує зміну. І нерви колег.'],
};

const GENERAL = [
  'Зірки кажуть: сьогодні все вийде, якщо ти перестанеш дивитися в телефон.',
  'Гороскоп простий: посміхайся, допродавай, не спізнюйся.',
  'Сьогодні сприятливий день для хінкалі. Як і завжди.',
  'Зірки радять: кожен стіл — шанс. Не проґав.',
  'Космос шепоче: десерт сам себе не продасть.',
  'Сьогодні ти зможеш більше, ніж учора. Але менше, ніж завтра.',
  'Знак не вказаний на порталі, тож зірки імпровізують: буде нормальна зміна.',
  'Енергія дня: бульйон гарячий, гості щедрі, кухня в гуморі.',
];

/** The day's horoscope for one person: the same answer all day. */
export function horoscope(sign: string | null, dateKey: string, tgId: number): string {
  const seed = `${dateKey}:${tgId}`;
  if (sign && BY_SIGN[sign]) return `🔮 <b>${escapeHtml(sign)}</b>: ${dailyPick(BY_SIGN[sign], seed)}`;
  return `🔮 ${dailyPick(GENERAL, seed)}`;
}

/* ─── Messages ─── */

export function formatToday(rows: Array<{ name: string; shift: string; department: string }>): string {
  if (!rows.length) return '📅 Сьогодні в графіку нікого немає. Або графік ще не заповнили.';
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const list = groups.get(row.department) ?? [];
    list.push(`${escapeHtml(row.name)} <i>(${escapeHtml(row.shift)})</i>`);
    groups.set(row.department, list);
  }
  return ['📅 <b>Сьогодні на зміні</b>', ...[...groups].map(([department, names]) => `\n<b>${escapeHtml(department)}:</b> ${names.join(', ')}`)].join('\n');
}

const BEST_LINES = [
  '🏆 Рада старійшин хінкалі зібралася і вирішила: найкращий офіціант дня — {name}! Оплески!',
  '🏆 Барабанний дріб… Сьогоднішній чемпіон залу — {name}!',
  '🏆 За результатами таємного голосування (голосував я) найкращий сьогодні — {name}.',
  '🏆 Корона дня їде до {name}. Носи гідно, не загуби на роздачі.',
];

export function formatBest(name: string | null, seed = ''): string {
  if (!name) return '🏆 Сьогодні в графіку немає офіціантів. Нікого нагороджувати — корону ховаю до завтра.';
  return (dailyPick(BEST_LINES, seed) ?? BEST_LINES[0] as string).replace('{name}', `<b>${escapeHtml(name)}</b>`);
}

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

export function formatBirthdays(rows: Array<{ name: string; month: number; day: number }>, todayKey: string): string {
  if (!rows.length) return '🎂 Найближчих днів народження немає в списку.';
  const [, monthText = '1', dayText = '1'] = todayKey.split('-');
  const today = Number(monthText) * 100 + Number(dayText);
  const lines = rows.map((row) => {
    const isToday = row.month * 100 + row.day === today;
    return `${isToday ? '🎉 <b>сьогодні</b>' : `${row.day} ${MONTHS[row.month - 1] ?? ''}`} — ${escapeHtml(row.name)}`;
  });
  return ['🎂 <b>Найближчі дні народження</b>', ...lines].join('\n');
}

export function formatStop(names: string[]): string {
  if (!names.length) return '✅ Стоп-лист порожній. Продаємо все!';
  return ['⛔ <b>Стоп-лист</b>', ...names.map((name) => `• ${escapeHtml(name)}`)].join('\n');
}

export function formatRoles(members: Member[]): string {
  if (!members.length) return '👥 Я ще нікого тут не знаю. Напишіть щось у чат — і я запам\'ятаю.';
  const lines = members
    .map((member) => {
      const roles = rolesOf(member).map((role) => ROLE_LABELS[role]);
      const source = member.manualRole ? ' ✍️' : '';
      return `${escapeHtml(displayName(member))} — ${roles.length ? roles.join(', ') : 'без ролі'}${source}`;
    })
    .sort((left, right) => left.localeCompare(right, 'uk'));
  return ['👥 <b>Хто є хто</b>', ...lines, '', '✍️ — роль призначена вручну'].join('\n');
}
