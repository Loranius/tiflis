import test from 'node:test';
import assert from 'node:assert/strict';
import {
  breakfastLine,
  cashLine,
  countWorkDays,
  dishLine,
  greetingLine,
  isBreakfastShift,
  judgeCash,
  pick,
  pickDish,
  roastLine,
  shiftLine,
  shiftVerdict,
  tapLine,
  tomorrowKey,
} from '../src/components/mascot/lines.ts';

test('judgeCash tiers in hryvnias (owner, November 2026)', () => {
  assert.equal(judgeCash(0), 'weak');
  assert.equal(judgeCash(9999), 'weak');
  assert.equal(judgeCash(10000), 'meh');
  assert.equal(judgeCash(24999), 'meh');
  assert.equal(judgeCash(25000), 'okay');
  assert.equal(judgeCash(34999), 'okay');
  assert.equal(judgeCash(35000), 'great');
  assert.equal(judgeCash(49999), 'great');
  assert.equal(judgeCash(50000), 'epic');
  assert.equal(judgeCash(180000), 'epic');
});

test('shift counting', () => {
  assert.equal(countWorkDays(['Р', 'Х', 'О', '', null, 'СН', 'С/Б', 'Д']), 4);
  assert.equal(shiftVerdict(8), 'lazy');
  assert.equal(shiftVerdict(9), 'normal');
  assert.equal(shiftVerdict(17), 'normal');
  assert.equal(shiftVerdict(18), 'hard');
});

test('breakfast and dates', () => {
  assert.ok(isBreakfastShift('СН') && isBreakfastShift('СН/Б'));
  assert.ok(!isBreakfastShift('Р') && !isBreakfastShift(null));
  assert.equal(tomorrowKey('2026-11-30'), '2026-12-01');
  assert.equal(tomorrowKey('2026-12-31'), '2027-01-01');
});

test('pick avoids the previous index', () => {
  for (let i = 0; i < 50; i += 1) assert.notEqual(pick(['a', 'b'], Math.random, 0).index, 0);
  assert.equal(pick(['only'], Math.random, 0).item, 'only');
});

test('lines carry numbers and moods', () => {
  const rnd = () => 0;
  assert.match(cashLine('great', 41400, rnd).text, /41\s400/);
  assert.equal(cashLine('weak', 7000, rnd).mood, 'sad');
  assert.equal(cashLine('meh', 15000, rnd).mood, 'neutral');
  assert.equal(cashLine('okay', 30000, rnd).mood, 'neutral');
  assert.equal(cashLine('great', 40000, rnd).mood, 'happy');
  assert.equal(cashLine('epic', 60000, rnd).mood, 'love');
  assert.match(shiftLine('lazy', 6, 24, rnd).text, /6/);
  assert.match(dishLine('Хачапурі по-аджарськи', null, rnd).text, /Хачапурі/);
  assert.ok(dishLine('Х', 'Перше речення. Друге речення.', rnd).text.length <= 220);
  assert.equal(pickDish([], rnd), null);
});

test('every pool line is non-empty Ukrainian text', () => {
  for (let i = 0; i < 40; i += 1) {
    const r = Math.random;
    for (const line of [roastLine(r), tapLine(r), greetingLine(r), breakfastLine('СН', r)]) assert.ok(line.text.trim().length > 3);
  }
});

test('no template placeholder survives', () => {
  for (let i = 0; i < 60; i += 1) {
    const r = Math.random;
    const lines = [
      cashLine('weak', 7000, r), cashLine('meh', 15000, r), cashLine('okay', 30000, r), cashLine('great', 40000, r), cashLine('epic', 60000, r),
      shiftLine('lazy', 7, 23, r), shiftLine('normal', 12, 18, r), shiftLine('hard', 20, 10, r),
      breakfastLine('СН/Б', r), dishLine('Хінкалі', 'Тісто, яловичина і бульйон. Їдять руками.', r),
    ];
    for (const line of lines) assert.doesNotMatch(line.text, /\{[a-z]+\}/);
  }
});

test('shift numbers agree with their nouns', () => {
  for (let i = 0; i < 80; i += 1) {
    const r = Math.random;
    const hard = shiftLine('hard', 22, 8, r).text;
    assert.doesNotMatch(hard, /22 (робочих|змін(?![а-яіїєґ]))/);
    const lazy = shiftLine('lazy', 1, 29, r).text;
    assert.doesNotMatch(lazy, /(?<!\d)1 (змін|робочих|зміни)(?![а-яіїєґ])/);
    assert.doesNotMatch(lazy, /29 вихідні(?![а-яіїєґ])/);
    const normal = shiftLine('normal', 12, 18, r).text;
    assert.doesNotMatch(normal, /12 (зміни|робочі)(?![а-яіїєґ])/);
  }
});

/* Every line, by brute force over the pools (each pool has < 30 lines). */
function everyLine(): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < 600; i += 1) {
    const r = Math.random;
    [
      cashLine('weak', 7000, r), cashLine('meh', 15000, r), cashLine('okay', 30000, r), cashLine('great', 40000, r), cashLine('epic', 60000, r),
      shiftLine('lazy', 6, 24, r), shiftLine('normal', 12, 18, r), shiftLine('hard', 30, 0, r),
      breakfastLine('СН', r), roastLine(r), tapLine(r), greetingLine(r),
    ].forEach((line) => seen.add(line.text));
  }
  return [...seen];
}

test('lines address the viewer without assuming gender', () => {
  const masculine = /(ти прийшов|продавав|продав |загіпнотизував|працював|Не підвів|не здивував|Середнячок|пропонував|обслуговував|Сам себе|обігнав|архітекторе|сертифікований|хто ти такий|Ні ледар, ні герой|— герой|героє|пробував|порахував|не зробив|допродав|сам бачиш|здатен)/;
  for (const text of everyLine()) assert.doesNotMatch(text, masculine, text);
});

test('teasing stays about work', () => {
  const offLimits = /(синці|Спини|в житті|посмішка|серіал)/;
  for (const text of everyLine()) assert.doesNotMatch(text, offLimits, text);
});

test('grammar fixes', () => {
  for (const text of everyLine()) {
    assert.doesNotMatch(text, /Оце я розумію каса|Лише 0|Я їм не дамся/, text);
  }
});

test('pickup and drop lines exist and avoid the gender trap', async () => {
  const { pickupLine, dropLine } = await import('../src/components/mascot/lines.ts');
  for (let i = 0; i < 60; i += 1) {
    for (const line of [pickupLine(Math.random), dropLine(Math.random)]) {
      assert.ok(line.text.trim().length > 3);
      assert.doesNotMatch(line.text, /(поставив|переніс|схопив|взяв мене)/, line.text);
    }
  }
});

test('shift summary ignores a half-published month', async () => {
  const { summarizeShifts } = await import('../src/components/mascot/lines.ts');
  // 30-day month, only 10 days published: not enough to judge.
  assert.equal(summarizeShifts(Array(10).fill('Р'), 30), null);
  // fully published: 20 work, 10 off.
  assert.deepEqual(summarizeShifts([...Array(20).fill('Р'), ...Array(10).fill('Х')], 30), { work: 20, off: 10 });
  // 25 of 30 published (≥ 80%): off counts only the published days off.
  assert.deepEqual(summarizeShifts([...Array(20).fill('Р'), ...Array(5).fill('Х')], 30), { work: 20, off: 5 });
});

test('new moods: pickup surprises him, dozing lines are sleepy', async () => {
  const { pickupLine, dozeLine } = await import('../src/components/mascot/lines.ts');
  assert.equal(pickupLine(Math.random).mood, 'surprised');
  for (let i = 0; i < 20; i += 1) {
    const line = dozeLine(Math.random);
    assert.equal(line.mood, 'sleepy');
    assert.ok(line.text.trim().length > 3);
  }
});
