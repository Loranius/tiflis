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

test('judgeCash thresholds', () => {
  assert.equal(judgeCash(7500, 6000), 'high');
  assert.equal(judgeCash(7499, 6000), 'normal');
  assert.equal(judgeCash(4500, 6000), 'low');
  assert.equal(judgeCash(4501, 6000), 'normal');
  assert.equal(judgeCash(5000, null), 'first');
  assert.equal(judgeCash(5000, 0), 'first');
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
  assert.match(cashLine('high', 7400, 5000, rnd).text, /7\s400/);
  assert.equal(cashLine('high', 7400, 5000, rnd).mood, 'happy');
  assert.equal(cashLine('low', 2000, 5000, rnd).mood, 'sad');
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
      cashLine('high', 9000, 6000, r), cashLine('normal', 6000, 6000, r), cashLine('low', 3000, 6000, r), cashLine('first', 5000, null, r),
      shiftLine('lazy', 7, 23, r), shiftLine('normal', 12, 18, r), shiftLine('hard', 20, 10, r),
      breakfastLine('СН/Б', r), dishLine('Хінкалі', 'Тісто, яловичина і бульйон. Їдять руками.', r),
    ];
    for (const line of lines) assert.doesNotMatch(line.text, /\{[a-z]+\}/);
  }
});
