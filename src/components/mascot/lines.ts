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
  '{amount}! Оце я розумію каса. Гості сьогодні плакали, але платили.',
  '{amount} — на {percent}% більше, ніж зазвичай. Хто ти і куди подів ледаря, що тут працював?',
  'Ого, {amount}. Я аж тісто розправив від гордості.',
  '{amount}. Сьогодні ти продавав так, ніби в тебе кредит на хінкалі.',
  'Чесно? Не чекав. {amount} при середній {average}. Записую в легенди.',
  '{amount}! Тримай темп, бо завтра я знову чекатиму дива.',
  'Каса {amount}. Шеф уже думає, чи не підняти тобі ставку. Жартую, не думає.',
  'Ну нарешті! {amount} — ось так виглядає робота, а не прогулянка між столами.',
  '{amount}. Якщо так і далі, я почну тебе поважати. Трохи.',
  'Плюс {percent}% до твоєї середньої. Сьогодні ти — хінкалі з подвійним бульйоном.',
  '{amount}. Ти або продав усе вино, або загіпнотизував гостей. Обидва варіанти схвалюю.',
  'Оце виторг! {amount}. Іди похвалися, поки не почалася наступна зміна.',
  '{amount}? Красиво. Я б потиснув тобі руку, але в мене ручки маленькі.',
  '{amount} — найкращий аргумент, що ти тут не випадково.',
  'Рекорди тремтять. {amount} при твоїх звичайних {average}.',
];

const CASH_NORMAL = [
  '{amount}. Стабільно, як бульйон у хінкалі. Але бульйон хоч гарячий.',
  '{amount} — рівно твій рівень. Ні соромно, ні гордо.',
  'Каса {amount}. Нормально. Слово «нормально» тут ключове.',
  '{amount}. Не підвів, не здивував. Класика.',
  'Записав {amount}. Середнячок року — теж нагорода.',
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
  '{amount}. Твоя середня {average}. Сьогодні ти, схоже, працював у режимі енергозбереження.',
  'Ох. {amount}. Я навіть тісто стиснув від розчарування.',
  '{amount}. Гості, мабуть, тебе не помітили. Або ти їх.',
  'На {percent}% менше за твоє звичайне. Ти що, пропонував лише воду з-під крана?',
  '{amount}. Я бачив хінкалі, що заробляли більше, просто лежачи на тарілці.',
  'Каса {amount}. Давай вдамо, що цього не було, і завтра зробимо нормально.',
  '{amount}… Ти обслуговував столи чи охороняв їх?',
  '{amount}. Слабенько. Навіть бульйон із мене витік би від сорому.',
  'Сьогодні {amount}. Хочеш, я завтра сам піду до гостей? Гірше точно не буде.',
  '{amount}. Десерти, вино, допродаж — тобі ці слова щось кажуть?',
  '{amount}. Мінус {percent}% від твоєї ж норми. Сам себе обігнав, тільки назад.',
  'Ну таке. {amount}. Я в тебе вірив. Учора.',
  '{amount}. Якщо це був план, то план був дивний.',
];

const CASH_FIRST = [
  'Перша каса місяця — {amount}. Почнемо рахувати, хто ти є насправді.',
  '{amount} для старту. Подивимось, чи це розгін, чи стеля.',
  'Відкрили місяць на {amount}. Я вже стежу.',
  '{amount}. Порівнювати ще нема з чим, тож поки що без знущань. Поки що.',
  'Записав {amount}. Перший млинець, тобто хінкалі, нормальний.',
  '{amount} — перша цеглинка місяця. Будуй далі, архітекторе.',
];

const SHIFTS_LAZY = [
  '{days} змін на місяць? А решту {off} днів ти що, медитуєш?',
  'Робочих днів — {days}. Ледацюга сертифікований, печатка є.',
  '{days} змін. Я в морозилці більше працюю, ніж ти тут.',
  'У тебе {off} вихідних. Ти точно офіціант, а не гість?',
  '{days} робочих днів. Скромно. Навіть занадто.',
  'Графік у тебе як у кота: {days} днів роботи, решта — відпочинок від відпочинку.',
  '{days} змін на місяць — це не графік, це хобі.',
  'Бачу {days} змін. Ти ж знаєш, що каса сама себе не наб\'є?',
  'З такою кількістю змін ({days}) тебе скоро почнуть питати, хто ти такий.',
  '{off} вихідних! Поділися секретом, я теж так хочу.',
];

const SHIFTS_NORMAL = [
  '{days} змін і {off} вихідних. Баланс, як у правильному хінкалі.',
  'Графік нормальний: {days} робочих. Ні ледар, ні герой.',
  '{days} змін. Живеш по-людськи, поважаю.',
  'У тебе {days} робочих і {off} вільних днів. Встигай і заробити, і виспатися.',
  '{days} змін на місяць. Ну, мінімум ти відробляєш.',
  'Збалансовано: {days}/{off}. Хоч щось у тебе в житті рівне.',
];

const SHIFTS_HARD = [
  '{days} змін! Ти тут живеш? Можу виділити тобі куток біля бару.',
  '{days} робочих днів. Повага. І трохи страшно за тебе.',
  'Лише {off} вихідних. Ти машина. Втомлена машина, але машина.',
  '{days} змін — я аж бульйоном спітнів, поки рахував.',
  'Ти працюєш {days} днів. Відпочивати колись будеш, чи це не твоє?',
  '{days} змін. Каса буде гарна, а от сон — не дуже.',
  'Трудоголік місяця: {days} змін. Спини хоч трохи пошкодуй.',
  '{days} змін на місяць — герой. Під очима синці теж геройські.',
  'З таким графіком ({days} змін) тебе вже знають в обличчя всі постійні гості.',
];

const BREAKFAST = [
  'Завтра в тебе {shift}. Будильник на ранок, а не на «ще п\'ять хвилин».',
  'Нагадую: завтра {shift}. Сніданки самі себе не подадуть.',
  'Завтра {shift}. Лягай раніше, героє ночі.',
  'Ти завтра на сніданках ({shift}). Якщо проспиш — я все бачу.',
  'Завтра {shift}. Кава, усмішка, яєчня. Саме в такому порядку.',
  'Завтра зранку {shift}. Не забудь, що ранок буває і до обіду.',
  '{shift} завтра. Сьогодні менше серіалів, більше сну.',
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
  'Слухай, а ти пробував працювати так, як граєш у телефоні?',
  'У тебе така посмішка, ніби ти вже порахував чайові. Рано.',
  'Ще трохи посидиш тут — і я сам піду обслуговувати.',
  'Пам\'ятаєш, як приймати замовлення без «е-е-е»? Я ні.',
  'Гості просять рахунок, а ти тут зі мною балакаєш.',
  'Я б тебе підбадьорив, але ти ще нічого не зробив.',
  'Ти вже допродав десерт сьогодні? Ні? Ну от.',
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
  'Що треба? Касу показати? Ти й сам бачиш.',
  'Ти мене відволікаєш від спостереження за тобою.',
  'Ой. Лоскотно. Більше так не роби. Ну, ще раз можна.',
  'Я їм не дамся. Навіть з перцем.',
];

const GREETING = [
  'О, ти прийшов. Ну давай, показуй, на що здатен.',
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
  const values = { days: workDays, off: offDays };
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
