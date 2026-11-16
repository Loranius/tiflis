/*
 * Хінкалик's voice: the rules that judge the viewer's own numbers and the
 * hand-written lines it says. No imports on purpose: this file is unit-tested
 * straight from Node (`npm test`).
 *
 * Tone (owner's choice, November 2026): harsh, teasing, always «ти». Teasing is
 * about work only (cash, laziness, shifts) — never appearance, health, family
 * or origin.
 */

export type Mood = 'happy' | 'neutral' | 'sad' | 'smug';
export interface Line { text: string; mood: Mood }
export type Rnd = () => number;

export type CashVerdict = 'high' | 'normal' | 'low' | 'first';
export type ShiftVerdict = 'lazy' | 'normal' | 'hard';

const OFF_SHIFTS = new Set(['Х', 'О']);
const BREAKFAST_SHIFTS = new Set(['СН', 'СН/Б']);

/** ≥ +25% over the month average is high, ≤ −25% is low; no average yet is «first». */
export function judgeCash(amount: number, monthAverage: number | null): CashVerdict {
  if (!monthAverage || monthAverage <= 0) return 'first';
  const ratio = amount / monthAverage;
  if (ratio >= 1.25) return 'high';
  if (ratio <= 0.75) return 'low';
  return 'normal';
}

/** A working day is any non-empty shift code except Х (вихідний) and О (відпустка). */
export function countWorkDays(shifts: Array<string | null | undefined>): number {
  return shifts.filter((code) => {
    const value = (code || '').trim();
    return Boolean(value) && !OFF_SHIFTS.has(value);
  }).length;
}

export function shiftVerdict(workDays: number): ShiftVerdict {
  if (workDays <= 8) return 'lazy';
  if (workDays >= 18) return 'hard';
  return 'normal';
}

export function isBreakfastShift(code: string | null | undefined): boolean {
  return BREAKFAST_SHIFTS.has((code || '').trim());
}

export function tomorrowKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** A random item; with `avoid`, never the same index twice in a row (pools of 2+). */
export function pick<T>(pool: readonly T[], rnd: Rnd, avoid?: number): { item: T; index: number } {
  let index = Math.min(pool.length - 1, Math.floor(rnd() * pool.length));
  if (pool.length > 1 && index === avoid) index = (index + 1) % pool.length;
  return { item: pool[index] as T, index };
}

export function formatHryvnia(value: number): string {
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Math.round(value))} ₴`;
}

/** Ukrainian plural: 1 зміна, 2 зміни, 5 змін (and 11–14 take the «many» form). */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-z]+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/* Remember the last index per pool, so the same joke does not come twice in a row. */
const lastIndex = new Map<readonly string[], number>();
function say(pool: readonly string[], mood: Mood, rnd: Rnd, values: Record<string, string | number> = {}): Line {
  const { item, index } = pick(pool, rnd, lastIndex.get(pool));
  lastIndex.set(pool, index);
  return { text: fill(item, values), mood };
}

const CASH_HIGH = [
  '{amount}! Оце я розумію — каса. Гості сьогодні плакали, але платили.',
  '{amount} — на {percent}% більше, ніж зазвичай. Хто ти і куди поділося ледащо, що тут працювало?',
  'Ого, {amount}. Я аж тісто розправив від гордості.',
  '{amount}. Сьогодні продажі такі, ніби в тебе кредит на хінкалі.',
  'Чесно? Не чекав. {amount} при середній {average}. Записую в легенди.',
  '{amount}! Тримай темп, бо завтра я знову чекатиму дива.',
  'Каса {amount}. Шеф уже думає, чи не підняти тобі ставку. Жартую, не думає.',
  'Ну нарешті! {amount} — ось так виглядає робота, а не прогулянка між столами.',
  '{amount}. Якщо так і далі, я почну тебе поважати. Трохи.',
  'Плюс {percent}% до твоєї середньої. Сьогодні ти — хінкалі з подвійним бульйоном.',
  '{amount}. Або в залі скінчилося вино, або гості під гіпнозом. Обидва варіанти схвалюю.',
  'Оце виторг! {amount}. Іди похвалися, поки не почалася наступна зміна.',
  '{amount}? Красиво. Я б потиснув тобі руку, але в мене ручки маленькі.',
  '{amount} — найкращий аргумент, що ти тут не випадково.',
  'Рекорди тремтять. {amount} при твоїх звичайних {average}.',
];

const CASH_NORMAL = [
  '{amount}. Стабільно, як бульйон у хінкалі. Але бульйон хоч гарячий.',
  '{amount} — рівно твій рівень. Ні соромно, ні гордо.',
  'Каса {amount}. Нормально. Слово «нормально» тут ключове.',
  '{amount}. Без провалу і без сюрпризу. Класика.',
  'Записав {amount}. Золота середина — теж нагорода.',
  '{amount}. Можна краще, але й гірше ми вже бачили.',
  '{amount}. Сірий будній день у цифрах.',
  'Окей, {amount}. Завтра спробуй продати бодай один десерт понад план.',
  '{amount}. Ти як стабільний інтернет: ніхто не хвалить, але без тебе погано.',
  'Каса як каса: {amount}. Я позіхнув, але по-доброму.',
  '{amount}. Твоя середня — {average}. Ти буквально в ній живеш.',
  '{amount}. Не катастрофа. І не тріумф. Просто вівторок, навіть якщо не вівторок.',
];

const CASH_LOW = [
  '{amount}? Це каса чи чайові за каву?',
  '{amount}. Твоя середня {average}. Сьогодні, схоже, увімкнено режим енергозбереження.',
  'Ох. {amount}. Я навіть тісто стиснув від розчарування.',
  '{amount}. Гості, мабуть, тебе не помітили. Або ти їх.',
  'На {percent}% менше за твоє звичайне. Гостям що, пропонували лише воду з-під крана?',
  '{amount}. Я бачив хінкалі, що заробляли більше, просто лежачи на тарілці.',
  'Каса {amount}. Давай вдамо, що цього не було, і завтра зробимо нормально.',
  '{amount}… Столи сьогодні обслуговували чи охороняли?',
  '{amount}. Слабенько. Навіть бульйон із мене витік би від сорому.',
  'Сьогодні {amount}. Хочеш, я завтра сам піду до гостей? Гірше точно не буде.',
  '{amount}. Десерти, вино, допродаж — тобі ці слова щось кажуть?',
  '{amount}. Мінус {percent}% від твоєї ж норми. Рекорд, тільки в інший бік.',
  'Ну таке. {amount}. Я в тебе вірив. Учора.',
  '{amount}. Якщо це був план, то план був дивний.',
];

const CASH_FIRST = [
  'Перша каса місяця — {amount}. Почнемо рахувати, хто ти є насправді.',
  '{amount} для старту. Подивимось, чи це розгін, чи стеля.',
  'Відкрили місяць на {amount}. Я вже стежу.',
  '{amount}. Порівнювати ще нема з чим, тож поки що без знущань. Поки що.',
  'Записав {amount}. Перший млинець, тобто хінкалі, нормальний.',
  '{amount} — перша цеглинка місяця. Будуй далі.',
];

/* {days} is «N змін/зміни/зміна» and {off} «N вихідних/вихідні/вихідний», already agreed. */
const SHIFTS_LAZY = [
  '{days} на місяць? А решту часу ти що, медитуєш?',
  'У графіку {days}. Ледацюга з сертифікатом, печатка є.',
  '{days}. Я в морозилці більше працюю, ніж ти тут.',
  'У тебе {off}. Ти точно офіціант, а не гість?',
  '{days} за місяць. Скромно. Навіть занадто.',
  'Графік як у кота: {days}, решта — відпочинок від відпочинку.',
  '{days} на місяць — це не графік, це хобі.',
  'Бачу {days}. Ти ж знаєш, що каса сама себе не наб\'є?',
  'З таким графіком ({days}) тебе скоро не впізнають на вході.',
  '{off}! Поділися секретом, я теж так хочу.',
];

const SHIFTS_NORMAL = [
  '{days} і {off}. Баланс, як у правильному хінкалі.',
  'Графік нормальний: {days}. Ні лінь, ні подвиг.',
  '{days} за місяць. Живеш по-людськи, поважаю.',
  'У тебе {days} і {off}. Встигай і заробити, і виспатися.',
  '{days} на місяць. Ну, мінімум ти відробляєш.',
  'Збалансовано: {days} і {off}. Рівно, як складочки на мені.',
];

const SHIFTS_HARD = [
  '{days}! Ти тут живеш? Можу виділити тобі куток біля бару.',
  'У графіку {days}. Повага. І трохи страшно за тебе.',
  'У тебе {off}. Ти машина. Втомлена машина, але машина.',
  '{days} — я аж бульйоном спітнів, поки рахував.',
  'У тебе {days}. Відпочивати колись будеш, чи це не твоє?',
  '{days}. Каса буде гарна, а от сон — не дуже.',
  'Трудоголізм місяця: {days}. Залиш і колегам трохи змін.',
  '{days} на місяць — справжній подвиг. Каса тобі вдячна.',
  'З таким графіком ({days}) тебе вже знають в обличчя всі постійні гості.',
];

const BREAKFAST = [
  'Завтра в тебе {shift}. Будильник на ранок, а не на «ще п\'ять хвилин».',
  'Нагадую: завтра {shift}. Сніданки самі себе не подадуть.',
  'Завтра {shift}. Сьогодні лягай раніше, ніч не для тебе.',
  'Ти завтра на сніданках ({shift}). Якщо проспиш — я все бачу.',
  'Завтра {shift}. Кава, усмішка, яєчня. Саме в такому порядку.',
  'Завтра зранку {shift}. Не забудь, що ранок буває і до обіду.',
  '{shift} завтра. Сьогодні менше телефону, більше сну.',
  'Завтра сніданки ({shift}). Гості голодні з самого ранку, як і я.',
];

const DISH = [
  'Знаєш «{dish}»? {about}',
  'Сьогодні рекомендую «{dish}». {about}',
  'Факт дня: «{dish}». {about}',
  'Якщо гість вагається — «{dish}». {about}',
  'Перевірка: що таке «{dish}»? Правильно: {about}',
  'Продай сьогодні «{dish}». {about}',
];
const DISH_PLAIN = [
  'Порекомендуй сьогодні «{dish}». Гості таке люблять.',
  '«{dish}» — продай хоча б одну порцію, і я відчеплюсь.',
  'Сьогоднішня місія: «{dish}». Вперед.',
];

const ROAST = [
  'Ти знову тут? А гості де?',
  'Я хінкалі, і навіть я знаю меню краще за тебе.',
  'Телефон відклади. Он стіл чекає вже п\'ять хвилин.',
  'Скільки можна гортати портал? Іди продай щось.',
  'Слухай, а працювати так само завзято, як гортати телефон, — слабо?',
  'Чайові ще не пораховано, а ти вже тут відпочиваєш. Рано.',
  'Ще трохи посидиш тут — і я сам піду обслуговувати.',
  'Пам\'ятаєш, як приймати замовлення без «е-е-е»? Я ні.',
  'Гості просять рахунок, а ти тут зі мною балакаєш.',
  'Я б тебе підбадьорив, але спершу покажи касу.',
  'Десерт сьогодні вже допродано? Ні? Ну от.',
  'Твоя швидкість обслуговування — як у хінкалі, що вистигає.',
  'Сьогодні працюєш чи присутній? Бо це різні речі.',
  'Чайові самі себе не залишать. Посміхайся.',
  'Цікаво, ти й на кухню так повільно ходиш, як сюди заходиш?',
  'Я спостерігаю. Завжди. Зі сметаною.',
  'Порада дня: менше тут, більше в залі.',
  'Твоя каса подзвонила. Каже, сумує.',
];

const TAP = [
  'Не тикай. Я ніжний, у мене бульйон.',
  'Що? Я тут працюю, на відміну від декого.',
  'Ще раз ткнеш — порвеш тісто, а потім що?',
  'Я не кнопка. Хоча гарний, згоден.',
  'Агов! Хвостик не чіпати.',
  'Нудно? Іди до гостей, там цікавіше.',
  'Тицьнув — молодець. А тепер продай вино.',
  'Мене за хвостик тримають, а не тицяють.',
  'Що треба? Касу показати? Вона й так на екрані.',
  'Ти мене відволікаєш від спостереження за тобою.',
  'Ой. Лоскотно. Більше так не роби. Ну, ще раз можна.',
  'Мене не з\'їси. Навіть з перцем.',
];

const GREETING = [
  'О, ти тут. Ну давай, показуй, на що здатне твоє тісто.',
  'Привіт. Я Хінкалик. Я стежу за твоєю касою.',
  'Знову ти. Сподіваюсь, сьогодні буде краще, ніж учора.',
  'Ну що, працюємо чи знову гортаємо?',
  'Я на місці. Ти, бачу, теж. Вже прогрес.',
  'Вітаю на зміні. Не підведи мене.',
  'А, це ти. Добре, я буду поруч. Завжди.',
];

function percentDelta(amount: number, average: number | null): number {
  if (!average) return 0;
  return Math.round(Math.abs(amount / average - 1) * 100);
}

export function cashLine(verdict: CashVerdict, amount: number, average: number | null, rnd: Rnd): Line {
  const values = {
    amount: formatHryvnia(amount),
    average: average ? formatHryvnia(average) : '—',
    percent: percentDelta(amount, average),
  };
  if (verdict === 'high') return say(CASH_HIGH, 'happy', rnd, values);
  if (verdict === 'low') return say(CASH_LOW, 'sad', rnd, values);
  if (verdict === 'first') return say(CASH_FIRST, 'neutral', rnd, values);
  return say(CASH_NORMAL, 'neutral', rnd, values);
}

export function shiftLine(verdict: ShiftVerdict, workDays: number, offDays: number, rnd: Rnd): Line {
  const values = {
    days: `${workDays} ${plural(workDays, 'зміна', 'зміни', 'змін')}`,
    off: offDays > 0 ? `${offDays} ${plural(offDays, 'вихідний', 'вихідні', 'вихідних')}` : 'жодного вихідного',
  };
  if (verdict === 'lazy') return say(SHIFTS_LAZY, 'smug', rnd, values);
  if (verdict === 'hard') return say(SHIFTS_HARD, 'happy', rnd, values);
  return say(SHIFTS_NORMAL, 'neutral', rnd, values);
}

export function breakfastLine(code: string, rnd: Rnd): Line {
  return say(BREAKFAST, 'neutral', rnd, { shift: code });
}

/** First sentence of the dish description, at most 120 characters. */
function aboutDish(description: string | null): string {
  const text = (description || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentence = text.split(/(?<=[.!?])\s/)[0] || text;
  return sentence.length > 120 ? `${sentence.slice(0, 119).trimEnd()}…` : sentence;
}

export function dishLine(name: string, description: string | null, rnd: Rnd): Line {
  const about = aboutDish(description);
  if (!about) return say(DISH_PLAIN, 'neutral', rnd, { dish: name });
  return say(DISH, 'neutral', rnd, { dish: name, about });
}

export function pickDish<T extends { name: string; description: string | null }>(items: readonly T[], rnd: Rnd): T | null {
  const named = items.filter((item) => item.name && item.name.trim());
  if (!named.length) return null;
  return pick(named, rnd).item;
}

export function roastLine(rnd: Rnd): Line {
  return say(ROAST, 'smug', rnd);
}

export function tapLine(rnd: Rnd): Line {
  return say(TAP, 'smug', rnd);
}

export function greetingLine(rnd: Rnd): Line {
  return say(GREETING, 'happy', rnd);
}
