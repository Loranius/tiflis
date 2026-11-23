# Бот «Тифліс» у робочому чаті

Status: draft for owner approval, 2026-11-23.

## Intent

The existing Tiflis Telegram bot (today it only sends: duty plans, birthday
and breakfast reminders, password codes) joins the staff group chat as a
member with admin rights and becomes an interactive chat bot for the team,
in the spirit of the Iris bot: typing `/` shows its commands. It can summon
everyone, summon a department, tell who works today, run small games such as
«найкращий офіціант дня», give a horoscope, and knows who is who: roles come
from the Tiflis portal, and the admin can set roles by hand for people who are
not on the portal (mostly kitchen).

## Goals

- `/all` mentions everyone in the chat.
- Department calls: `/waiters`, `/kitchen`, `/bar` (and hostesses/admins in
  their own groups).
- Portal data in the chat: `/today` (who is on shift today, from the
  schedule), `/birthdays` (the next birthdays), `/stop` (the stop list).
- Fun: `/best` (a solemn random «найкращий офіціант дня» among waiters on
  shift today, one per day, the same answer if asked again), `/horoscope`
  (a daily horoscope for the asker, by their zodiac sign when the portal knows
  it, in Хінкалик's teasing tone, the same answer all day).
- Roles: `/roles` lists who is who; an admin replies to someone's message with
  `/role кухар` (or any of the roles) to set or change a role by hand.
- `/help` (and the Telegram command menu) explains the commands in Ukrainian.

## Non-goals

- No money in the chat: no cash, payout or tips, not even one's own
  (PRODUCT.md privacy rule). A cash-top position without sums may be added later
  only if the owner asks.
- No moderation (bans, mutes, anti-spam) and no AI chat in this version.
- No changes to what the bot already sends privately.

## Anti-goals

- Spamming: the bot speaks only when a command is used (plus a one-line
  greeting when it is added). No unprompted posts in this version.
- Breaking the existing sends: duty plans, reminders and password codes must
  keep working.
- Exposing data to strangers: the bot answers only in the configured staff
  chat(s); in any other group it says it is not for that chat and does
  nothing else. In private messages it only explains itself.

## Constraints and facts

- Telegram does not let a bot list a group's members. «Everyone in the chat»
  is therefore: (1) every person the bot has seen post in the chat since it was
  added (it records them; admin rights let it see all messages), plus (2) every
  portal user with a linked Telegram (all 22 active accounts today have
  `users.tg_id`/`chat_id`) whose membership in the chat the bot confirms with
  `getChatMember`. Someone who is on neither list is picked up from their first
  message.
- Mentions: by `@username` when the person has one, otherwise an HTML text
  mention (`<a href="tg://user?id=…">Name</a>`), which Telegram renders as a
  mention for chat members. Long lists are split across messages.
- Command names are Latin only (Telegram rule); descriptions are Ukrainian.
- Portal roles: waiter, barman/bar, cook, chef, runner, hostess, admin
  (`users.role`/`role2`). Manual roles use the same set in Ukrainian
  (офіціант, бармен, кухар, шеф, ранер, хостес, адмін).
- The bot token is already a Supabase secret (`BOT_TOKEN`).

## Approaches considered

- **A. Supabase Edge Function webhook** (chosen): Telegram posts every update
  to a new function `tiflis-telegram-bot`; same database and secrets as the
  portal, nothing new to host. Only one consumer can receive the bot's updates,
  so before switching the webhook on we check `getWebhookInfo`; if another
  server already listens, we stop and ask the owner.
- B. A separate long-polling bot server (VPS): more to host and pay for, and it
  still needs the Tiflis database. Not justified for a handful of commands.
- C. A hosted bot builder (Iris-like services): cannot read the Tiflis
  schedule, roles or menu.

## Design (decided)

- **Function:** `supabase/functions/tiflis-telegram-bot`, `verify_jwt=false`,
  authenticated by Telegram's secret header (`X-Telegram-Bot-Api-Secret-Token`,
  a new secret `TELEGRAM_WEBHOOK_SECRET`). Replies with `sendMessage`.
  Registered with `setWebhook` and `setMyCommands` once, from the function
  itself on an admin-only `/setup` call or a one-off script.
- **Allowed chats:** a table `telegram_chats` (chat id, title, enabled). The
  first chat the bot is added to by a portal admin is enabled; others stay
  disabled until an admin enables them.
- **Members:** a table `telegram_chat_members` (chat id, Telegram user id,
  username, first/last name, last seen, manual role, linked portal user id).
  Upserted on every message; linked to a portal user by `users.tg_id`.
- **Role resolution:** manual role if set, else the linked portal user's role
  (role2 counts too, e.g. a waiter who is also a bartender is in both calls),
  else «без ролі».
- **Who can do what:** everyone in the allowed chat can use the calls and the
  fun commands; `/role` needs a chat admin in Telegram or a portal admin.
- **`/today`:** today's `schedule` rows (Kyiv date) with working codes (not Х/О),
  grouped by department, names from the portal.
- **`/best`:** picks a random waiter on shift today, stored per chat per day so
  the answer is stable; announced with a short ceremonial line.
- **`/horoscope`:** pools of hand-written lines by sign (and a general pool when
  the sign is unknown); the pick is seeded by date + user so it stays the same
  all day.
- **`/birthdays`:** next 3 birthdays from `staff_birthdays`, «сьогодні» first.
- **`/stop`:** `menu_items` where `stopped` is true, or «стоп-лист порожній».
- **Tone:** like Хінкалик, informal «ти», teasing only about work.

## Left to the builder

- Exact message wording and the horoscope line pools.
- Batching size for long mention lists (Telegram's per-message limits).
