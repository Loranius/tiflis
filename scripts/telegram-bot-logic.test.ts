import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunk,
  dailyPick,
  formatBest,
  formatBirthdays,
  formatRoles,
  formatStop,
  formatStopChange,
  formatNotes,
  formatThanksTop,
  formatWelcome,
  formatWho,
  isThanks,
  parseHashtagNote,
  parseNoteArgs,
  parseNoteName,
  matchMenuItems,
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

test('matchMenuItems: exact name wins, then partial, then all words; apostrophes and case ignored', () => {
  const items = [
    { id: 1, name: 'Хачапурі по-аджарськи' },
    { id: 2, name: 'Хачапурі по-імеретинськи' },
    { id: 3, name: 'Хінкалі з бараниною' },
    { id: 4, name: 'Пхалі' },
    { id: 5, name: "Сир м'який" },
  ];
  assert.deepEqual(matchMenuItems(items, 'пхалі').map((item) => item.id), [4]);
  assert.deepEqual(matchMenuItems(items, 'хачапурі').map((item) => item.id), [1, 2]);
  assert.deepEqual(matchMenuItems(items, 'аджар').map((item) => item.id), [1]);
  assert.deepEqual(matchMenuItems(items, 'баранина хінкалі').map((item) => item.id), []);
  assert.deepEqual(matchMenuItems(items, 'хінкалі баранин').map((item) => item.id), [3]);
  assert.deepEqual(matchMenuItems(items, 'сир мʼякий').map((item) => item.id), [5]);
  assert.deepEqual(matchMenuItems(items, '   ').map((item) => item.id), []);
  // An exact name is chosen even when it is also part of a longer name.
  const nested = [{ id: 1, name: 'Лобіо' }, { id: 2, name: 'Лобіо з горіхами' }];
  assert.deepEqual(matchMenuItems(nested, 'лобіо').map((item) => item.id), [1]);
});

test('formatStopChange names who did it and what, without money', () => {
  const on = formatStopChange('on', 'Оксана', ['Пхалі']);
  assert.match(on, /Оксана/);
  assert.match(on, /Пхалі/);
  assert.match(on, /стоп/);
  const off = formatStopChange('off', 'Оксана', ['Пхалі']);
  assert.match(off, /знято/i);
  assert.doesNotMatch(on + off, /грн|₴/);
});

test('stop-list commands are in the menu', () => {
  const names = COMMANDS.map((command) => command.command);
  assert.ok(names.includes('stopadd'));
  assert.ok(names.includes('stopdel'));
  assert.match(HELP_TEXT, /stopadd/);
});

test('isThanks: a plus or a thank-you reply counts, ordinary text does not', () => {
  for (const text of ['+', '+1', '👍', 'дякую', 'Дякую!', 'дякую дуже', 'Спасибі', 'спасибо)', 'дяка', 'thanks', 'мерсі']) {
    assert.equal(isThanks(text), true, text);
  }
  for (const text of ['', '++ нормально', 'дякуючи тобі ми запізнились', 'плюс мінус', 'не дякую', '+380671234567', 'дякую'.repeat(20)]) {
    assert.equal(isThanks(text), false, text);
  }
});

test('note names: one word, letters, digits or underscore, lower case, up to 32', () => {
  assert.equal(parseNoteName('WiFi'), 'wifi');
  assert.equal(parseNoteName('#Правила'), 'правила');
  assert.equal(parseNoteName('код_дверей'), 'код_дверей');
  assert.equal(parseNoteName('два слова'), null);
  assert.equal(parseNoteName(''), null);
  assert.equal(parseNoteName('a'.repeat(33)), null);
  assert.equal(parseNoteName('wi-fi'), null);
});

test('parseNoteArgs splits the name from the text, keeping line breaks', () => {
  const nl = String.fromCharCode(10);
  assert.deepEqual(parseNoteArgs('wifi Tiflis_Guest / пароль 1234'), { name: 'wifi', body: 'Tiflis_Guest / пароль 1234' });
  assert.deepEqual(parseNoteArgs('правила' + nl + '1. Не спізнюватись'), { name: 'правила', body: '1. Не спізнюватись' });
  assert.deepEqual(parseNoteArgs('wifi'), { name: 'wifi', body: '' });
  assert.equal(parseNoteArgs(''), null);
  assert.equal(parseNoteArgs('погана-назва текст'), null);
});

test('parseHashtagNote: a message that is just #name asks for that note', () => {
  assert.equal(parseHashtagNote('#wifi'), 'wifi');
  assert.equal(parseHashtagNote('  #Правила  '), 'правила');
  assert.equal(parseHashtagNote('#wifi будь ласка'), null);
  assert.equal(parseHashtagNote('дивись #wifi'), null);
  assert.equal(parseHashtagNote('#'), null);
});

test('formatWho names the pick and repeats the question without a trailing ?', () => {
  const text = formatWho('миє посуд?', 'Оксана', 'seed');
  assert.match(text, /Оксана/);
  assert.match(text, /миє посуд/);
  assert.doesNotMatch(text, /посуд\?/);
  assert.match(formatWho('', 'Оксана', 'seed'), /Оксана/);
  assert.match(formatWho('миє посуд', null, 'seed'), /нікого/i);
});

test('formatThanksTop ranks people and says when nobody was thanked', () => {
  const text = formatThanksTop([{ name: 'Оксана', count: 5 }, { name: 'Іра', count: 2 }], 'листопад');
  assert.match(text, /листопад/);
  assert.match(text, /1\. .*Оксана.*5/);
  assert.match(text, /2\. .*Іра.*2/);
  assert.match(formatThanksTop([], 'листопад'), /ще ніхто/i);
});

test('formatWelcome greets by name and asks for a role only when it is unknown', () => {
  assert.match(formatWelcome('Вікторія', null), /Вікторія/);
  assert.match(formatWelcome('Вікторія', null), /роль/);
  const known = formatWelcome('Оксана', 'офіціант');
  assert.match(known, /офіціант/);
  assert.doesNotMatch(known, /признач/);
});

test('formatNotes lists saved notes as hashtags', () => {
  assert.match(formatNotes(['wifi', 'правила']), /#wifi/);
  assert.match(formatNotes([]), /немає/i);
});

test('new commands are in the menu and help', () => {
  const names = COMMANDS.map((command) => command.command);
  for (const name of ['who', 'thanks', 'note', 'notes', 'delnote']) assert.ok(names.includes(name), name);
  assert.match(HELP_TEXT, /who/);
  assert.match(HELP_TEXT, /#назва/);
});
