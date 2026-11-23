# Telegram Group Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The existing Tiflis bot answers slash commands in the staff group chat: calls everyone or a department, shows today's shift, birthdays and stop list, picks «найкращий офіціант дня», gives a daily horoscope, and keeps roles (portal or manual).

**Architecture:** One webhook Edge Function `tiflis-telegram-bot` (Telegram → Supabase). Pure decision logic (command parsing, roles, mentions, daily picks, horoscope, message text) lives in `logic.ts` with no runtime imports, unit-tested from Node; `index.ts` does I/O (Telegram API, database). Three new tables hold allowed chats, seen members with manual roles, and daily picks. The webhook is registered by the function's own `setup` action, called once from the database with `pg_net`, after it checks that no other server already receives the bot's updates.

**Tech Stack:** Deno Edge Function (supabase-js 2), PostgreSQL migration, Node 22 `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-telegram-group-bot-design.md`

## Global Constraints

- Commands (Latin): `all`, `waiters`, `kitchen`, `bar`, `hostess`, `admins`, `today`, `best`, `horoscope`, `birthdays`, `stop`, `roles`, `role`, `help`, `enable`. Descriptions Ukrainian.
- Manual roles (Ukrainian → key): офіціант→waiter, бармен→bar, кухар→cook, шеф→chef, ранер→runner, хостес→hostess, адмін→admin; `/role -` clears.
- Departments: waiters = waiter; kitchen = cook, chef; bar = bar (barman/bartender); hostess = hostess; admins = admin, sysadmin. role2 counts.
- Working shift = non-empty code except `Х` and `О`; dates are Kyiv dates.
- No money of any kind in chat messages.
- The bot speaks only on commands and once when added to a chat.
- Answers only in enabled chats; elsewhere one line: «Я працюю лише в робочому чаті Тифлісу.»; private chats: a short explanation.
- `/role` and `/enable`: Telegram chat admin, or the portal admin linked by `users.tg_id`.
- First chat is enabled automatically only when the person who added the bot is a portal admin (role/role2 admin or sysadmin).
- HTML parse mode; every name escaped; mentions are `@username` or `<a href="tg://user?id=ID">Name</a>`; at most 40 mentions per message.
- `/best` and `/horoscope` are stable for the day (same answer on repeat).
- Webhook authenticated by `X-Telegram-Bot-Api-Secret-Token` = secret `TELEGRAM_WEBHOOK_SECRET`; function `verify_jwt=false`.
- Setup refuses to replace a webhook URL that points elsewhere (reports it instead).

## Review Focus

- **Someone with no username and no portal link** must still be mentioned (text mention by id) and named sensibly — test `mentionHtml` for a member with only `first_name`.
- **Names with `<`, `&` or emoji** must not break the HTML message — test escaping in `mentionHtml` and `formatToday`.
- **Command addressed to another bot** (`/all@OtherBot`) must be ignored; `/all@TiflisBot` and `/all` accepted — test `parseCommand`.
- **No waiter on shift today** for `/best`, empty stop list, nobody on shift for `/today` — each returns a friendly line, not an error — tests on the formatters.
- **More than 40 people** for `/all` — split into several messages — test `chunk`.

---

### Task 1: Pure bot logic (`logic.ts`)

**Files:**
- Create: `supabase/functions/tiflis-telegram-bot/logic.ts`
- Create: `scripts/telegram-bot-logic.test.ts`

**Interfaces (all exported from `logic.ts`, no imports):**
- `type RoleKey = 'waiter' | 'bar' | 'cook' | 'chef' | 'runner' | 'hostess' | 'admin'`
- `type Department = 'all' | 'waiters' | 'kitchen' | 'bar' | 'hostess' | 'admins'`
- `interface Member { tgId: number; username: string | null; firstName: string; lastName: string | null; manualRole: RoleKey | null; portal: { name: string; role: string | null; role2: string | null } | null }`
- `parseCommand(text: string, botUsername: string): { command: string; args: string } | null`
- `normalizeRole(value: string | null | undefined): RoleKey | null` (barman/bartender→bar, sysadmin→admin)
- `parseRoleArg(text: string): RoleKey | 'clear' | null` (Ukrainian names above, case-insensitive; `-` → clear)
- `rolesOf(member: Member): RoleKey[]` (manual role wins alone; else portal role + role2)
- `inDepartment(member: Member, department: Department): boolean`
- `displayName(member: Member): string` (portal name, else first + last)
- `escapeHtml(text: string): string`
- `mentionHtml(member: Member): string`
- `chunk<T>(items: T[], size: number): T[][]`
- `dailyPick<T>(items: T[], seed: string): T | null` (deterministic hash of seed)
- `zodiacSign(zodiac: string | null, birthday: string | null): string | null` (from «♐ Стрілець» or a `YYYY-MM-DD`/`MM-DD` birthday)
- `horoscope(sign: string | null, dateKey: string, tgId: number): string`
- `formatToday(rows: Array<{ name: string; shift: string; department: string }>): string`
- `formatBest(name: string | null): string`, `formatBirthdays(rows: Array<{ name: string; month: number; day: number }>, todayKey: string): string`, `formatStop(names: string[]): string`, `formatRoles(members: Member[]): string`, `HELP_TEXT: string`, `COMMANDS: Array<{ command: string; description: string }>`
- `isWorkingShift(code: string | null): boolean`

- [ ] **Step 1: Write failing tests** (`scripts/telegram-bot-logic.test.ts`, importing `../supabase/functions/tiflis-telegram-bot/logic.ts`):

```ts
test('parseCommand', () => {
  assert.deepEqual(parseCommand('/all', 'TiflisBot'), { command: 'all', args: '' });
  assert.deepEqual(parseCommand('/all@TiflisBot ', 'TiflisBot'), { command: 'all', args: '' });
  assert.equal(parseCommand('/all@OtherBot', 'TiflisBot'), null);
  assert.deepEqual(parseCommand('/role кухар', 'TiflisBot'), { command: 'role', args: 'кухар' });
  assert.equal(parseCommand('привіт /all', 'TiflisBot'), null);
});
test('roles and departments', () => {
  const m = (role: string | null, role2: string | null = null, manual: RoleKey | null = null): Member =>
    ({ tgId: 1, username: null, firstName: 'A', lastName: null, manualRole: manual, portal: role ? { name: 'A', role, role2 } : null });
  assert.deepEqual(rolesOf(m('waiter', 'barman')), ['waiter', 'bar']);
  assert.ok(inDepartment(m('waiter', 'barman'), 'bar'));
  assert.ok(inDepartment(m(null, null, 'cook'), 'kitchen'));
  assert.ok(inDepartment(m('chef'), 'kitchen'));
  assert.deepEqual(rolesOf(m('waiter', null, 'cook')), ['cook']);
  assert.equal(parseRoleArg('Кухар'), 'cook');
  assert.equal(parseRoleArg('-'), 'clear');
  assert.equal(parseRoleArg('космонавт'), null);
});
test('mentions escape names and fall back to text mentions', () => {
  const plain: Member = { tgId: 42, username: null, firstName: 'Ан<я> & Ко', lastName: null, manualRole: null, portal: null };
  assert.equal(mentionHtml(plain), '<a href="tg://user?id=42">Ан&lt;я&gt; &amp; Ко</a>');
  assert.equal(mentionHtml({ ...plain, username: 'anya' }), '@anya');
  assert.equal(chunk([1, 2, 3, 4, 5], 2).length, 3);
});
test('daily picks are stable and empty-safe', () => {
  assert.equal(dailyPick(['a', 'b', 'c'], 'chat:2026-11-23'), dailyPick(['a', 'b', 'c'], 'chat:2026-11-23'));
  assert.equal(dailyPick([], 'x'), null);
  assert.equal(horoscope('Стрілець', '2026-11-23', 7), horoscope('Стрілець', '2026-11-23', 7));
  assert.ok(horoscope(null, '2026-11-23', 7).length > 20);
});
test('zodiac from the portal field or the birthday', () => {
  assert.equal(zodiacSign('♐ Стрілець', null), 'Стрілець');
  assert.equal(zodiacSign(null, '1995-08-10'), 'Лев');
  assert.equal(zodiacSign(null, null), null);
});
test('friendly empty answers and no money', () => {
  assert.match(formatBest(null), /нікого|немає/i);
  assert.match(formatStop([]), /порожній/);
  assert.match(formatToday([]), /нікого|немає/i);
  assert.match(formatToday([{ name: 'Ді<ма', shift: 'Р', department: 'Офіціанти' }]), /Ді&lt;ма/);
  assert.doesNotMatch(HELP_TEXT, /₴|грн|кас[аи] \d/);
  assert.equal(isWorkingShift('Х'), false);
  assert.equal(isWorkingShift('СН/Б'), true);
});
```

- [ ] **Step 2:** `npm test` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `logic.ts`.** Horoscope: for each of the 12 signs 4–6 lines plus a general pool of ~8, in Хінкалик's teasing work-only, gender-neutral tone; pick with `dailyPick(pool, dateKey + ':' + tgId)`. Zodiac date ranges: Козеріг 12-22..01-19, Водолій 01-20..02-18, Риби 02-19..03-20, Овен 03-21..04-19, Телець 04-20..05-20, Близнюки 05-21..06-20, Рак 06-21..07-22, Лев 07-23..08-22, Діва 08-23..09-22, Терези 09-23..10-22, Скорпіон 10-23..11-21, Стрілець 11-22..12-21. `dailyPick` uses FNV-1a over the seed.
- [ ] **Step 4:** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(telegram): bot logic`.

### Task 2: Tables

**Files:**
- Create: `supabase/migrations/20261123000000_telegram_group_bot.sql` (apply with the Supabase MCP `apply_migration`)

- [ ] **Step 1:** Write and apply:
  - `telegram_chats(chat_id bigint primary key, title text, enabled boolean not null default false, added_by bigint, created_at timestamptz default now())`
  - `telegram_chat_members(chat_id bigint references telegram_chats on delete cascade, tg_id bigint, username text, first_name text not null default '', last_name text, manual_role text check (manual_role in ('waiter','bar','cook','chef','runner','hostess','admin')), last_seen timestamptz not null default now(), left_at timestamptz, primary key (chat_id, tg_id))`
  - `telegram_daily_picks(chat_id bigint, pick_date date, kind text, value text not null, primary key (chat_id, pick_date, kind))`
  - RLS enabled on all three with no policies (service role only).
- [ ] **Step 2: Verify** `select count(*) from telegram_chats` runs (0 rows). **Commit** `feat(telegram): tables`.

### Task 3: Webhook function, setup, release

**Files:**
- Create: `supabase/functions/tiflis-telegram-bot/index.ts`
- Create: `docs/telegram-bot.md` (owner instructions)
- Modify: `PRODUCT.md` (Telegram line: the bot now also lives in the staff chat)

**Interfaces:**
- Consumes everything from Task 1; tables from Task 2.
- `POST` with header `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET` → handle an update, always answer 200 `ok` (Telegram retries otherwise).
- `POST` with header `x-setup-secret` = `TELEGRAM_WEBHOOK_SECRET` and body `{"action":"setup","url":"<function url>"}` → `getMe`, `getWebhookInfo`; if a different URL is set → `{ ok:false, conflict: <that url> }` and nothing changes; else `setWebhook(url, secret_token, allowed_updates: ["message","my_chat_member"])` and `setMyCommands(COMMANDS, scope all_group_chats)`; returns the bot username and webhook info. `{"action":"info"}` only returns `getMe` + `getWebhookInfo`.

- [ ] **Step 1: Implement `index.ts`:** member upsert on every group message (and `left_chat_member` sets `left_at`); `my_chat_member` → create `telegram_chats` row, enable it if the adder is a portal admin, send one greeting (or the «ask a portal admin to add me» line); command routing per Global Constraints; `/all` = members with `left_at is null` ∪ portal users with tg_id confirmed by `getChatMember` (status not `left`/`kicked`, cached into `telegram_chat_members`); data reads from `users`, `schedule`, `staff_birthdays`, `menu_items`; `/best` and `/horoscope` stored/read via `telegram_daily_picks` (horoscope needs none: deterministic).
- [ ] **Step 2: Deploy** (`verify_jwt=false`), create secret `TELEGRAM_WEBHOOK_SECRET` (random 48 hex) with the Supabase MCP, call `{"action":"info"}` from SQL with `net.http_post` and read `net._http_response`. Expected: webhook url empty (or our URL). If another URL: stop and ask the owner.
- [ ] **Step 3:** Call `setup` the same way. Expected: `ok:true`, webhook url = the function URL, pending updates 0, commands set.
- [ ] **Step 4: Verify** with a synthetic update posted to the function from SQL (secret header, a private-chat `/help`): Expected 200 and no error in the function logs. Real group testing is the owner's (add the bot, make it admin).
- [ ] **Step 5:** Write `docs/telegram-bot.md` (how to add the bot, make it admin, the commands, `/role`, `/enable`), update PRODUCT.md, run `npm test`, typecheck, lint, build; commit, merge to main, push, confirm CI (Deno check covers the new function) and the stable-runtime publish.
