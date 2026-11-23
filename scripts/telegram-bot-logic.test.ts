import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunk,
  dailyPick,
  formatBest,
  formatBirthdays,
  formatRoles,
  formatStop,
  formatToday,
  HELP_TEXT,
  COMMANDS,
  horoscope,
  inDepartment,
  isWorkingShift,
  mentionHtml,
  parseCommand,
  parseRoleArg,
  rolesOf,
  zodiacSign,
  type Member,
  type RoleKey,
} from '../supabase/functions/tiflis-telegram-bot/logic.ts';

test('parseCommand', () => {
  assert.deepEqual(parseCommand('/all', 'TiflisBot'), { command: 'all', args: '' });
  assert.deepEqual(parseCommand('/all@TiflisBot ', 'TiflisBot'), { command: 'all', args: '' });
  assert.deepEqual(parseCommand('/ALL@tiflisbot', 'TiflisBot'), { command: 'all', args: '' });
  assert.equal(parseCommand('/all@OtherBot', 'TiflisBot'), null);
  assert.deepEqual(parseCommand('/role кухар', 'TiflisBot'), { command: 'role', args: 'кухар' });
  assert.equal(parseCommand('привіт /all', 'TiflisBot'), null);
  assert.equal(parseCommand('', 'TiflisBot'), null);
});

const m = (role: string | null, role2: string | null = null, manual: RoleKey | null = null): Member =>
  ({ tgId: 1, username: null, firstName: 'A', lastName: null, manualRole: manual, portal: role ? { name: 'A', role, role2 } : null });

test('roles and departments', () => {
  assert.deepEqual(rolesOf(m('waiter', 'barman')), ['waiter', 'bar']);
  assert.ok(inDepartment(m('waiter', 'barman'), 'bar'));
  assert.ok(inDepartment(m(null, null, 'cook'), 'kitchen'));
  assert.ok(inDepartment(m('chef'), 'kitchen'));
  assert.ok(inDepartment(m('sysadmin'), 'admins'));
  assert.ok(inDepartment(m(null), 'all'));
  assert.deepEqual(rolesOf(m('waiter', null, 'cook')), ['cook']);
  assert.deepEqual(rolesOf(m(null)), []);
  assert.equal(parseRoleArg('Кухар'), 'cook');
  assert.equal(parseRoleArg(' бармен '), 'bar');
  assert.equal(parseRoleArg('-'), 'clear');
  assert.equal(parseRoleArg('космонавт'), null);
});

test('mentions escape names and fall back to text mentions', () => {
  const plain: Member = { tgId: 42, username: null, firstName: 'Ан<я> & Ко', lastName: null, manualRole: null, portal: null };
  assert.equal(mentionHtml(plain), '<a href="tg://user?id=42">Ан&lt;я&gt; &amp; Ко</a>');
  assert.equal(mentionHtml({ ...plain, username: 'anya' }), '@anya');
  assert.equal(mentionHtml({ ...plain, firstName: '' }), '<a href="tg://user?id=42">Учасник</a>');
  assert.equal(chunk([1, 2, 3, 4, 5], 2).length, 3);
  assert.deepEqual(chunk([], 40), []);
});

test('daily picks and horoscopes are stable and empty-safe', () => {
  assert.equal(dailyPick(['a', 'b', 'c'], 'chat:2026-11-23'), dailyPick(['a', 'b', 'c'], 'chat:2026-11-23'));
  assert.equal(dailyPick([], 'x'), null);
  const seen = new Set(Array.from({ length: 40 }, (_, i) => dailyPick(['a', 'b', 'c'], `seed${i}`)));
  assert.ok(seen.size > 1, 'varies by seed');
  assert.equal(horoscope('Стрілець', '2026-11-23', 7), horoscope('Стрілець', '2026-11-23', 7));
  assert.ok(horoscope(null, '2026-11-23', 7).length > 20);
  for (const sign of ['Овен', 'Телець', 'Близнюки', 'Рак', 'Лев', 'Діва', 'Терези', 'Скорпіон', 'Стрілець', 'Козеріг', 'Водолій', 'Риби']) {
    assert.ok(horoscope(sign, '2026-11-23', 1).includes(sign), sign);
  }
});

test('zodiac from the portal field or the birthday', () => {
  assert.equal(zodiacSign('♐ Стрілець', null), 'Стрілець');
  assert.equal(zodiacSign(null, '1995-08-10'), 'Лев');
  assert.equal(zodiacSign(null, '12-25'), 'Козеріг');
  assert.equal(zodiacSign(null, '1990-01-19'), 'Козеріг');
  assert.equal(zodiacSign(null, '1990-01-20'), 'Водолій');
  assert.equal(zodiacSign(null, null), null);
  assert.equal(zodiacSign('щось', 'abc'), null);
});

test('friendly empty answers, escaping and no money', () => {
  assert.match(formatBest(null), /нікого|немає/i);
  assert.match(formatBest('Ді<ма'), /Ді&lt;ма/);
  assert.match(formatStop([]), /порожній/);
  assert.match(formatStop(['Хачапурі']), /Хачапурі/);
  assert.match(formatToday([]), /нікого|немає/i);
  assert.match(formatToday([{ name: 'Ді<ма', shift: 'Р', department: 'Офіціанти' }]), /Ді&lt;ма/);
  assert.match(formatBirthdays([], '2026-11-23'), /немає|нікого/i);
  assert.match(formatBirthdays([{ name: 'Оля', month: 11, day: 23 }], '2026-11-23'), /сьогодні/i);
  assert.match(formatRoles([m('waiter')]), /офіціант/i);
  assert.doesNotMatch(HELP_TEXT, /₴|грн/);
  assert.ok(COMMANDS.every((c) => /^[a-z]+$/.test(c.command) && c.description.length > 3));
  assert.equal(isWorkingShift('Х'), false);
  assert.equal(isWorkingShift('О'), false);
  assert.equal(isWorkingShift(''), false);
  assert.equal(isWorkingShift('СН/Б'), true);
});
