import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveChatRoles, filterChatMembers, sortChatMembers, type ChatMember } from '../src/lib/chatRoles.ts';

function member(overrides: Partial<ChatMember>): ChatMember {
  return { tg_id: '1', username: null, name: 'Хтось', manual_role: null, last_seen: null, portal: null, ...overrides };
}

test('a role set by hand wins over the portal, as in the bot', () => {
  const both = member({ manual_role: 'cook', portal: { id: 'u', name: 'Оксана', role: 'waiter', role2: null } });
  assert.deepEqual(effectiveChatRoles(both), { roles: ['cook'], source: 'manual' });
});

test('portal role and second role both count; barman means bar; sysadmin means admin', () => {
  const portal = member({ portal: { id: 'u', name: 'Андрій', role: 'waiter', role2: 'barman' } });
  assert.deepEqual(effectiveChatRoles(portal), { roles: ['waiter', 'bar'], source: 'portal' });
  const sys = member({ portal: { id: 'u', name: 'Діма', role: 'sysadmin', role2: null } });
  assert.deepEqual(effectiveChatRoles(sys).roles, ['admin']);
});

test('no manual role and no portal role means none', () => {
  assert.equal(effectiveChatRoles(member({})).source, 'none');
  assert.equal(effectiveChatRoles(member({ portal: { id: 'u', name: 'Х', role: 'trainee', role2: null } })).source, 'none');
});

test('people without a role come first, then by name', () => {
  const list = [
    member({ tg_id: '1', name: 'Яна', portal: { id: 'a', name: 'Яна', role: 'waiter', role2: null } }),
    member({ tg_id: '2', name: 'Борис' }),
    member({ tg_id: '3', name: 'Аня', manual_role: 'cook' }),
    member({ tg_id: '4', name: 'Віка' }),
  ];
  assert.deepEqual(sortChatMembers(list).map((item) => item.tg_id), ['2', '4', '3', '1']);
});

test('filter by source and by name, username or portal name', () => {
  const list = [
    member({ tg_id: '1', name: 'Vika', username: 'adams_vika' }),
    member({ tg_id: '2', name: 'Громоступ', manual_role: 'cook' }),
    member({ tg_id: '3', name: 'Oks', portal: { id: 'u', name: 'Оксана', role: 'waiter', role2: null } }),
  ];
  assert.deepEqual(filterChatMembers(list, 'none', '').map((item) => item.tg_id), ['1']);
  assert.deepEqual(filterChatMembers(list, 'all', 'adams').map((item) => item.tg_id), ['1']);
  assert.deepEqual(filterChatMembers(list, 'all', 'оксан').map((item) => item.tg_id), ['3']);
  assert.deepEqual(filterChatMembers(list, 'manual', '').map((item) => item.tg_id), ['2']);
});
