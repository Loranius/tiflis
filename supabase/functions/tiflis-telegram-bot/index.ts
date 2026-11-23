import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  chunk,
  COMMANDS,
  dailyPick,
  type Department,
  escapeHtml,
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
  MONTHS_NOMINATIVE,
  parseHashtagNote,
  parseNoteArgs,
  parseNoteName,
  formatToday,
  HELP_TEXT,
  NL,
  horoscope,
  inDepartment,
  isWorkingShift,
  matchMenuItems,
  type Member,
  mentionHtml,
  normalizeRole,
  parseCommand,
  parseRoleArg,
  ROLE_LABELS,
  type RoleKey,
  zodiacSign,
} from "./logic.ts";

/*
 * The Tiflis bot in the staff group chat (spec 2026-11-23-telegram-group-bot).
 *
 * Telegram posts every update here (webhook). The request must carry
 * `X-Telegram-Bot-Api-Secret-Token`, a value derived from the bot token that
 * never leaves the server. Setup (`setWebhook`, `setMyCommands`) and `info`
 * are called once from the database with the cron secret. verify_jwt is off.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("BIRTHDAY_CRON_SECRET") ?? "";
const MENTIONS_PER_MESSAGE = 40;
const MEMBER_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Update = any;

type PortalUser = {
  id: string;
  login: string;
  display_name: string | null;
  role: string | null;
  role2: string | null;
  tg_id: number | string | null;
  chat_id: number | string | null;
  tg_username: string | null;
  zodiac: string | null;
  birthday: string | null;
  fired: boolean | null;
};
type MemberRow = {
  chat_id: number;
  tg_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  manual_role: RoleKey | null;
  left_at: string | null;
};

const DEPARTMENT_COMMANDS: Record<string, Department> = {
  all: "all",
  waiters: "waiters",
  kitchen: "kitchen",
  bar: "bar",
  hostess: "hostess",
  admins: "admins",
};
const CALL_TITLES: Record<Department, string> = {
  all: "кличе всіх",
  waiters: "кличе офіціантів",
  kitchen: "кличе кухню",
  bar: "кличе бар",
  hostess: "кличе хостес",
  admins: "кличе адмінів",
};
const DEPARTMENT_LABEL: Record<RoleKey, string> = {
  waiter: "Офіціанти",
  bar: "Бар",
  cook: "Кухня",
  chef: "Кухня",
  runner: "Ранери",
  hostess: "Хостес",
  admin: "Адміністрація",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

async function webhookSecret(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tiflis-telegram-webhook:${BOT_TOKEN}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function kyivDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function tg<T = unknown>(method: string, payload: Record<string, unknown> = {}): Promise<{ ok: boolean; result?: T; description?: string }> {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await response.json().catch(() => ({ ok: false, description: `HTTP ${response.status}` }));
}

function send(chatId: number, text: string, replyTo?: number) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
  });
}

let botUsername = "";
let botId = 0;
async function me() {
  if (botUsername) return;
  const result = await tg<{ id: number; username: string }>("getMe");
  botUsername = result.result?.username ?? "";
  botId = result.result?.id ?? 0;
}

/* ─── Data ─── */

async function portalUsers(db: Db): Promise<PortalUser[]> {
  const { data, error } = await db.from("users")
    .select("id,login,display_name,role,role2,tg_id,chat_id,tg_username,zodiac,birthday,fired")
    .or("fired.is.null,fired.eq.false");
  if (error) throw error;
  return (data ?? []) as PortalUser[];
}

function portalTgId(user: PortalUser): number | null {
  const value = Number(user.tg_id || user.chat_id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function toMember(row: MemberRow, portal: PortalUser | undefined): Member {
  return {
    tgId: Number(row.tg_id),
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    manualRole: row.manual_role,
    portal: portal ? { name: portal.display_name || portal.login, role: portal.role, role2: portal.role2 } : null,
  };
}

async function upsertMember(db: Db, chatId: number, user: { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean }) {
  if (!user || user.is_bot) return;
  await db.from("telegram_chat_members").upsert({
    chat_id: chatId,
    tg_id: user.id,
    username: user.username ?? null,
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? null,
    last_seen: new Date().toISOString(),
    left_at: null,
  }, { onConflict: "chat_id,tg_id" });
}

/**
 * Everyone in the chat: people the bot has seen post (still present), plus
 * portal users with a linked Telegram whose membership Telegram confirms.
 */
async function chatMembers(db: Db, chatId: number): Promise<Member[]> {
  const users = await portalUsers(db);
  const byTg = new Map(users.flatMap((user) => {
    const id = portalTgId(user);
    return id ? [[id, user] as const] : [];
  }));
  const { data } = await db.from("telegram_chat_members").select("chat_id,tg_id,username,first_name,last_name,manual_role,left_at").eq("chat_id", chatId);
  const rows = new Map(((data ?? []) as MemberRow[]).map((row) => [Number(row.tg_id), row]));

  const unknown = [...byTg.keys()].filter((id) => !rows.has(id));
  const checks = await Promise.all(unknown.map(async (id) => ({ id, result: await tg<{ status: string; user: { id: number; username?: string; first_name?: string; last_name?: string } }>("getChatMember", { chat_id: chatId, user_id: id }) })));
  for (const { id, result } of checks) {
    if (!result.ok || !result.result || !MEMBER_STATUSES.has(result.result.status)) continue;
    const user = result.result.user;
    const row: MemberRow = { chat_id: chatId, tg_id: id, username: user.username ?? null, first_name: user.first_name ?? "", last_name: user.last_name ?? null, manual_role: null, left_at: null };
    rows.set(id, row);
    await db.from("telegram_chat_members").upsert({ chat_id: chatId, tg_id: id, username: row.username, first_name: row.first_name, last_name: row.last_name }, { onConflict: "chat_id,tg_id" });
  }

  return [...rows.values()]
    .filter((row) => !row.left_at && Number(row.tg_id) !== botId)
    .map((row) => toMember(row, byTg.get(Number(row.tg_id))));
}

/** As on the portal (AuthProvider): the `sysadmin` account is an admin whatever its role field says. */
function isAdminUser(user: PortalUser | undefined): boolean {
  if (!user) return false;
  return user.id === "sysadmin" || [user.role, user.role2].some((role) => normalizeRole(role) === "admin");
}

async function isChatAdmin(db: Db, chatId: number, userId: number): Promise<boolean> {
  const users = await portalUsers(db);
  const portal = users.find((user) => portalTgId(user) === userId);
  if (isAdminUser(portal)) return true;
  const result = await tg<{ status: string }>("getChatMember", { chat_id: chatId, user_id: userId });
  return Boolean(result.ok && result.result && ["creator", "administrator"].includes(result.result.status));
}

async function isPortalAdmin(db: Db, userId: number): Promise<boolean> {
  const users = await portalUsers(db);
  const portal = users.find((user) => portalTgId(user) === userId);
  return isAdminUser(portal);
}

/* ─── Commands ─── */

async function callDepartment(db: Db, chatId: number, department: Department, caller: string, replyTo: number) {
  const members = (await chatMembers(db, chatId)).filter((member) => inDepartment(member, department));
  if (!members.length) {
    await send(chatId, department === "all" ? "Я ще нікого тут не знаю. Напишіть щось у чат — і я запам'ятаю." : "Тут поки нікого з цього відділу. Адмін може призначити ролі командою /role.", replyTo);
    return;
  }
  const parts = chunk(members.map(mentionHtml), MENTIONS_PER_MESSAGE);
  for (const [index, part] of parts.entries()) {
    const head = index === 0 ? `📣 <b>${escapeHtml(caller)}</b> ${CALL_TITLES[department]}!${NL}${NL}` : "";
    await send(chatId, head + part.join(" "), index === 0 ? replyTo : undefined);
  }
}

async function today(db: Db): Promise<Array<{ name: string; shift: string; department: string; roles: RoleKey[] }>> {
  const date = kyivDateKey();
  const [users, schedule] = await Promise.all([
    portalUsers(db),
    db.from("schedule").select("user_id,shift").eq("date", date),
  ]);
  if (schedule.error) throw schedule.error;
  const byId = new Map(users.map((user) => [user.id, user]));
  return ((schedule.data ?? []) as Array<{ user_id: string; shift: string | null }>)
    .filter((row) => isWorkingShift(row.shift) && byId.has(row.user_id))
    .map((row) => {
      const user = byId.get(row.user_id) as PortalUser;
      const roles = [normalizeRole(user.role), normalizeRole(user.role2)].filter((role): role is RoleKey => Boolean(role));
      const first = roles[0];
      return { name: user.display_name || user.login, shift: String(row.shift).trim(), department: first ? DEPARTMENT_LABEL[first] : "Інші", roles };
    })
    .sort((left, right) => left.department.localeCompare(right.department, "uk") || left.name.localeCompare(right.name, "uk"));
}

async function best(db: Db, chatId: number): Promise<string> {
  const date = kyivDateKey();
  const seed = `${chatId}:${date}`;
  const stored = await db.from("telegram_daily_picks").select("value").eq("chat_id", chatId).eq("pick_date", date).eq("kind", "best").maybeSingle();
  if (stored.data?.value) return formatBest(stored.data.value, seed);
  const waiters = (await today(db)).filter((row) => row.roles.includes("waiter")).map((row) => row.name);
  const name = dailyPick(waiters, seed);
  if (name) await db.from("telegram_daily_picks").upsert({ chat_id: chatId, pick_date: date, kind: "best", value: name }, { onConflict: "chat_id,pick_date,kind" });
  return formatBest(name, seed);
}

async function birthdays(db: Db): Promise<string> {
  const date = kyivDateKey();
  const { data, error } = await db.from("staff_birthdays").select("full_name,birthday_month,birthday_day").not("birthday_month", "is", null).not("birthday_day", "is", null);
  if (error) throw error;
  const [, monthText = "1", dayText = "1"] = date.split("-");
  const todayValue = Number(monthText) * 100 + Number(dayText);
  const rows = ((data ?? []) as Array<{ full_name: string; birthday_month: number; birthday_day: number }>)
    .map((row) => {
      const value = row.birthday_month * 100 + row.birthday_day;
      return { name: row.full_name, month: row.birthday_month, day: row.birthday_day, order: value >= todayValue ? value - todayValue : value + 1300 - todayValue };
    })
    .sort((left, right) => left.order - right.order)
    .slice(0, 3);
  return formatBirthdays(rows, date);
}

async function stopList(db: Db): Promise<string> {
  const { data, error } = await db.from("menu_items").select("name,sort_order").eq("stopped", true).order("sort_order", { ascending: true });
  if (error) throw error;
  return formatStop(((data ?? []) as Array<{ name: string }>).map((row) => row.name));
}

/**
 * Anyone in the staff chat may put a dish on the stop list or take it off
 * (owner, November 2026). The request may be part of the name; several matches
 * are listed back instead of guessed.
 */
async function changeStop(db: Db, chatId: number, change: "on" | "off", query: string, who: string, replyTo: number) {
  const command = change === "on" ? "/stopadd" : "/stopdel";
  if (!query.trim()) {
    await send(chatId, `Напиши назву страви: <code>${command} хачапурі</code>. Можна частину назви.`, replyTo);
    return;
  }
  const { data, error } = await db.from("menu_items").select("id,name,stopped,sort_order").order("sort_order", { ascending: true });
  if (error) throw error;
  const items = (data ?? []) as Array<{ id: number; name: string; stopped: boolean }>;
  const candidates = items.filter((item) => change === "on" ? !item.stopped : item.stopped);
  const matches = matchMenuItems(candidates, query);
  if (!matches.length) {
    const already = matchMenuItems(items, query);
    const text = already.length
      ? (change === "on" ? "Це вже на стопі: " : "Цього немає в стопі: ") + already.map((item) => escapeHtml(item.name)).join(", ") + "."
      : "Не знайшов такої страви в меню. Спробуй іншу частину назви.";
    await send(chatId, text, replyTo);
    return;
  }
  if (matches.length > 1) {
    const list = matches.slice(0, 10).map((item) => `• ${escapeHtml(item.name)}`).join(NL);
    const more = matches.length > 10 ? `${NL}…і ще ${matches.length - 10}` : "";
    await send(chatId, `Знайшов кілька страв, уточни назву:${NL}${list}${more}`, replyTo);
    return;
  }
  const item = matches[0] as { id: number; name: string };
  const update = await db.from("menu_items").update({ stopped: change === "on", updated_at: new Date().toISOString() }).eq("id", item.id);
  if (update.error) throw update.error;
  await send(chatId, formatStopChange(change, who, [item.name]), replyTo);
}

/* ─── Who today, thanks, notes, welcome (round 2) ─── */

function normalizeQuestion(text: string): string {
  return (text || "").trim().toLowerCase().split(" ").filter(Boolean).join(" ");
}

/** «/who миє посуд» — one person from today's shift, the same answer all day for the same question. */
async function who(db: Db, chatId: number, question: string): Promise<string> {
  const date = kyivDateKey();
  const names = (await today(db)).map((row) => row.name);
  const seed = `${chatId}:${date}:${normalizeQuestion(question)}`;
  return formatWho(question, dailyPick(names, seed), seed + ":line");
}

/**
 * Whom a reply answers: an ordinary reply, or a reply to a message from
 * another chat (Telegram sends that as `external_reply` with the author in
 * `origin.sender_user`; seen in the staff chats, November 2026).
 */
function repliedAuthor(message: Update): { user: { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean }; external: boolean } | null {
  if (message.reply_to_message?.from) return { user: message.reply_to_message.from, external: false };
  const origin = message.external_reply?.origin;
  return origin?.type === "user" && origin.sender_user ? { user: origin.sender_user, external: true } : null;
}

/** A «+» or «дякую» reply: counted once per message, never to oneself or a bot. */
async function recordThanks(db: Db, chatId: number, message: Update) {
  const replied = repliedAuthor(message);
  const target = replied?.user;
  if (!replied || !target || target.is_bot || target.id === message.from.id) return;
  // A quote from another chat may be anyone's: only a confirmed member of this
  // chat can be thanked here, so the roster (and /all) never gains strangers.
  if (replied.external) {
    const member = await tg<{ status: string }>("getChatMember", { chat_id: chatId, user_id: target.id });
    if (!member.ok || !member.result || !MEMBER_STATUSES.has(member.result.status)) return;
  }
  await upsertMember(db, chatId, target);
  const { error } = await db.from("telegram_thanks").insert({ chat_id: chatId, from_tg_id: message.from.id, to_tg_id: target.id, message_id: message.message_id });
  if (error) {
    if (error.code !== "23505") console.error("thanks insert failed", error);
    return; // 23505: the same message twice
  }
  // A quiet heart on the thank-you instead of a reply, so the chat is not spammed;
  // a short line only where reactions are switched off.
  const reacted = await tg("setMessageReaction", { chat_id: chatId, message_id: message.message_id, reaction: [{ type: "emoji", emoji: "❤" }] });
  if (!reacted.ok) {
    const name = escapeHtml([target.first_name, target.last_name].filter(Boolean).join(" ") || "колега");
    await send(chatId, `🙏 Подяку для ${name} зараховано. /thanks — топ місяця.`, message.message_id);
  }
}

async function thanksTop(db: Db, chatId: number): Promise<string> {
  const month = kyivDateKey().slice(0, 7);
  const since = new Date(Date.now() - 33 * 86_400_000).toISOString();
  const { data, error } = await db.from("telegram_thanks").select("to_tg_id,created_at").eq("chat_id", chatId).gte("created_at", since);
  if (error) throw error;
  const counts = new Map<number, number>();
  for (const row of (data ?? []) as Array<{ to_tg_id: number; created_at: string }>) {
    if (kyivDateKey(new Date(row.created_at)).slice(0, 7) !== month) continue;
    counts.set(Number(row.to_tg_id), (counts.get(Number(row.to_tg_id)) ?? 0) + 1);
  }
  const members = new Map((await chatMembers(db, chatId)).map((member) => [member.tgId, member]));
  const rows = [...counts.entries()]
    .map(([tgId, count]) => {
      const member = members.get(tgId);
      return { name: member ? (member.portal?.name || [member.firstName, member.lastName].filter(Boolean).join(" ") || "Учасник") : "Учасник", count };
    })
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "uk"))
    .slice(0, 10);
  return formatThanksTop(rows, MONTHS_NOMINATIVE[Number(month.slice(5, 7)) - 1] ?? "");
}

async function saveNote(db: Db, chatId: number, message: Update, args: string) {
  const replyTo = message.message_id;
  if (!(await isChatAdmin(db, chatId, message.from.id))) {
    await send(chatId, "Нотатки зберігають лише адміни чату або порталу. Подивитися: /notes", replyTo);
    return;
  }
  const parsed = parseNoteArgs(args);
  if (!parsed) {
    await send(chatId, "Так: <code>/note wifi Tiflis_Guest / 12345678</code> або відповіддю на повідомлення: <code>/note правила</code>. Назва — одне слово.", replyTo);
    return;
  }
  const quoted = message.reply_to_message ? String(message.reply_to_message.text || message.reply_to_message.caption || "").trim() : "";
  const body = (parsed.body || quoted).slice(0, 3500);
  if (!body) {
    await send(chatId, "Нотатка порожня: допиши текст після назви або відповідай командою на повідомлення з текстом.", replyTo);
    return;
  }
  const { error } = await db.from("telegram_notes").upsert({ chat_id: chatId, name: parsed.name, body, created_by: message.from.id, updated_at: new Date().toISOString() }, { onConflict: "chat_id,name" });
  if (error) throw error;
  await send(chatId, `🗒 Збережено: #${escapeHtml(parsed.name)}. Напиши #${escapeHtml(parsed.name)} — і я покажу.`, replyTo);
}

async function deleteNote(db: Db, chatId: number, message: Update, args: string) {
  const replyTo = message.message_id;
  if (!(await isChatAdmin(db, chatId, message.from.id))) {
    await send(chatId, "Видаляти нотатки можуть лише адміни.", replyTo);
    return;
  }
  const name = parseNoteName(args);
  if (!name) return void await send(chatId, "Так: <code>/delnote wifi</code>", replyTo);
  const { data, error } = await db.from("telegram_notes").delete().eq("chat_id", chatId).eq("name", name).select("name");
  if (error) throw error;
  await send(chatId, (data ?? []).length ? `🗑 Нотатку #${escapeHtml(name)} видалено.` : `Нотатки #${escapeHtml(name)} немає. /notes — усі.`, replyTo);
}

async function listNotes(db: Db, chatId: number): Promise<string> {
  const { data, error } = await db.from("telegram_notes").select("name").eq("chat_id", chatId).order("name", { ascending: true });
  if (error) throw error;
  return formatNotes(((data ?? []) as Array<{ name: string }>).map((row) => row.name));
}

async function showNote(db: Db, chatId: number, name: string, replyTo: number) {
  const { data } = await db.from("telegram_notes").select("body").eq("chat_id", chatId).eq("name", name).maybeSingle();
  if (!data?.body) return; // an ordinary hashtag, not a note: stay quiet
  // Plain text: notes are typed by people and may contain anything.
  await tg("sendMessage", { chat_id: chatId, text: data.body, disable_web_page_preview: true, reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } });
}

async function welcome(db: Db, chatId: number, user: { id: number; first_name?: string; last_name?: string; is_bot?: boolean }) {
  if (!user || user.is_bot) return;
  const users = await portalUsers(db);
  const portal = users.find((candidate) => portalTgId(candidate) === user.id);
  const roles = portal ? [normalizeRole(portal.role), normalizeRole(portal.role2)].filter((role, index, all): role is RoleKey => Boolean(role) && all.indexOf(role) === index) : [];
  const name = portal ? portal.display_name || portal.login : [user.first_name, user.last_name].filter(Boolean).join(" ") || "новенький";
  await send(chatId, formatWelcome(name, roles.length ? roles.map((role) => ROLE_LABELS[role]).join(" + ") : null));
}

async function horoscopeFor(db: Db, from: { id: number; first_name?: string; username?: string }): Promise<string> {
  const users = await portalUsers(db);
  const portal = users.find((user) => portalTgId(user) === from.id);
  const sign = zodiacSign(portal?.zodiac ?? null, portal?.birthday ?? null);
  const who = portal ? portal.display_name || portal.login : from.first_name || "Ти";
  return `<b>${escapeHtml(who)}</b>${NL}${horoscope(sign, kyivDateKey(), from.id)}`;
}

async function setRole(db: Db, chatId: number, message: Update, args: string) {
  const replyTo = message.message_id;
  if (!(await isChatAdmin(db, chatId, message.from.id))) {
    await send(chatId, "Ролі призначають лише адміни чату або порталу.", replyTo);
    return;
  }
  const target = message.reply_to_message?.from;
  if (!target || target.is_bot) {
    await send(chatId, "Відповідай цією командою на повідомлення людини: <code>/role кухар</code>. Ролі: " + Object.values(ROLE_LABELS).join(", ") + ". <code>/role -</code> — прибрати.", replyTo);
    return;
  }
  const role = parseRoleArg(args);
  if (!role) {
    await send(chatId, "Не знаю такої ролі. Є: " + Object.values(ROLE_LABELS).join(", ") + ". <code>/role -</code> — прибрати ручну роль.", replyTo);
    return;
  }
  await upsertMember(db, chatId, target);
  await db.from("telegram_chat_members").update({ manual_role: role === "clear" ? null : role }).eq("chat_id", chatId).eq("tg_id", target.id);
  const name = escapeHtml([target.first_name, target.last_name].filter(Boolean).join(" ") || "Учасник");
  await send(chatId, role === "clear" ? `✍️ Ручну роль для ${name} прибрано — беру роль з порталу.` : `✍️ ${name} тепер — <b>${ROLE_LABELS[role]}</b>.`, replyTo);
}

/* ─── Updates ─── */

async function ensureChat(db: Db, chat: { id: number; title?: string }) {
  const existing = await db.from("telegram_chats").select("chat_id,enabled").eq("chat_id", chat.id).maybeSingle();
  if (existing.data) return existing.data as { chat_id: number; enabled: boolean };
  await db.from("telegram_chats").insert({ chat_id: chat.id, title: chat.title ?? null, enabled: false });
  return { chat_id: chat.id, enabled: false };
}

async function onBotMembership(db: Db, update: Update) {
  const change = update.my_chat_member;
  const chat = change.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return;
  const status = change.new_chat_member?.status;
  if (!["member", "administrator"].includes(status)) return;
  const old = change.old_chat_member?.status;
  if (["member", "administrator"].includes(old)) return; // a promotion, not a join
  const enabled = await isPortalAdmin(db, change.from.id);
  await db.from("telegram_chats").upsert({ chat_id: chat.id, title: chat.title ?? null, enabled, added_by: change.from.id }, { onConflict: "chat_id" });
  await upsertMember(db, chat.id, change.from);
  if (enabled) await registerChatCommands(chat.id);
  await send(chat.id, enabled
    ? "🥟 Привіт, Тифліс! Я тут. Дайте мені права адміністратора, щоб я бачив усіх, і напишіть /help."
    : "🥟 Привіт! Я працюю лише в робочому чаті Тифлісу. Адмін порталу може ввімкнути мене тут командою /enable.");
}

async function onMessage(db: Db, message: Update) {
  const chat = message.chat;
  const text: string = message.text ?? "";
  if (chat.type !== "group" && chat.type !== "supergroup") return;

  const state = await ensureChat(db, chat);
  if (message.from) await upsertMember(db, chat.id, message.from);
  for (const user of message.new_chat_members ?? []) await upsertMember(db, chat.id, user);
  if (message.left_chat_member) {
    await db.from("telegram_chat_members").update({ left_at: new Date().toISOString() }).eq("chat_id", chat.id).eq("tg_id", message.left_chat_member.id);
  }

  await me();
  const parsed = parseCommand(text, botUsername);
  if (state.enabled) {
    for (const user of message.new_chat_members ?? []) await welcome(db, chat.id, user);
  }
  if (!parsed && state.enabled && message.from && !message.from.is_bot) {
    const note = parseHashtagNote(text);
    if (note) return await showNote(db, chat.id, note, message.message_id);
    if ((message.reply_to_message || message.external_reply) && isThanks(text)) return await recordThanks(db, chat.id, message);
    return;
  }
  if (!parsed || !message.from) return;
  const replyTo = message.message_id;

  if (!state.enabled) {
    if (parsed.command === "enable" && await isPortalAdmin(db, message.from.id)) {
      await db.from("telegram_chats").update({ enabled: true }).eq("chat_id", chat.id);
      await registerChatCommands(chat.id);
      await send(chat.id, "✅ Увімкнено. Тепер я працюю в цьому чаті. /help — що я вмію.", replyTo);
    } else if (COMMANDS.some((command) => command.command === parsed.command) || parsed.command === "enable") {
      await send(chat.id, "Я працюю лише в робочому чаті Тифлісу. Адмін порталу може ввімкнути мене тут командою /enable.", replyTo);
    }
    return;
  }

  const caller = message.from.first_name || "Хтось";
  const department = DEPARTMENT_COMMANDS[parsed.command];
  if (department) return await callDepartment(db, chat.id, department, caller, replyTo);
  switch (parsed.command) {
    case "start":
    case "help":
      return void await send(chat.id, HELP_TEXT, replyTo);
    case "today": {
      const rows = await today(db);
      return void await send(chat.id, formatToday(rows), replyTo);
    }
    case "best":
      return void await send(chat.id, await best(db, chat.id), replyTo);
    case "horoscope":
      return void await send(chat.id, await horoscopeFor(db, message.from), replyTo);
    case "birthdays":
      return void await send(chat.id, await birthdays(db), replyTo);
    case "stop":
      return void await send(chat.id, await stopList(db), replyTo);
    case "stopadd":
      return await changeStop(db, chat.id, "on", parsed.args, caller, replyTo);
    case "stopdel":
    case "unstop":
      return await changeStop(db, chat.id, "off", parsed.args, caller, replyTo);
    case "who":
      return void await send(chat.id, await who(db, chat.id, parsed.args), replyTo);
    case "thanks":
      return void await send(chat.id, await thanksTop(db, chat.id), replyTo);
    case "notes":
      return void await send(chat.id, await listNotes(db, chat.id), replyTo);
    case "note":
      return await saveNote(db, chat.id, message, parsed.args);
    case "delnote":
      return await deleteNote(db, chat.id, message, parsed.args);
    case "roles":
      return void await send(chat.id, formatRoles(await chatMembers(db, chat.id)), replyTo);
    case "role":
      return await setRole(db, chat.id, message, parsed.args);
    case "enable":
      return void await send(chat.id, "Я вже працюю тут. /help — що я вмію.", replyTo);
    default:
      return;
  }
}

/* ─── Hand-off to the older bot function ─── */

/*
 * Before this function, `quick-responder` was the bot's webhook: it links
 * accounts on /start in private chat and handles the approval buttons
 * (callback_query). Telegram allows one webhook per bot, so this function
 * receives everything and passes every update it does not own, unchanged.
 * Group messages stay here: the older function would only log them.
 */
const LEGACY_WEBHOOK_URL = SUPABASE_URL + "/functions/v1/quick-responder";

function ownsUpdate(update: Update): boolean {
  if (update.my_chat_member) return true;
  const type = update.message?.chat?.type;
  return type === "group" || type === "supergroup";
}

async function forwardToLegacy(raw: string) {
  try {
    const response = await fetch(LEGACY_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    if (!response.ok) console.error("legacy webhook answered", response.status);
  } catch (error) {
    console.error("legacy webhook unreachable", error);
  }
}

/** Hands the webhook back to the older function (rollback). */
async function restoreLegacy() {
  const hook = await tg("setWebhook", { url: LEGACY_WEBHOOK_URL, drop_pending_updates: false });
  const after = await tg("getWebhookInfo");
  return { ok: Boolean(hook.ok), hook, webhook: after.result };
}

/**
 * The command menu (the «/» button in the message field) for one chat. The
 * all-group-chats list covers every group; the chat's own list is set too, so
 * the menu shows even where a client prefers the more specific scope.
 */
async function registerChatCommands(chatId: number) {
  return await tg("setMyCommands", { commands: COMMANDS, scope: { type: "chat", chat_id: chatId } });
}

/* ─── Setup (called once from the database with the cron secret) ─── */

async function setup(url: string) {
  await me();
  const info = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo");
  const current = info.result?.url ?? "";
  // The portal's older function may hand the webhook over: everything that is
  // not a group update is forwarded back to it (see `forwardToLegacy`).
  if (current && current !== url && current !== LEGACY_WEBHOOK_URL) return { ok: false, conflict: current, bot: botUsername };
  const secret = await webhookSecret();
  const hook = await tg("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "my_chat_member", "callback_query"], drop_pending_updates: false });
  const commands = await tg("setMyCommands", { commands: COMMANDS, scope: { type: "all_group_chats" }, language_code: "" });
  await tg("setChatMenuButton", { menu_button: { type: "commands" } });
  const db: Db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: chats } = await db.from("telegram_chats").select("chat_id").eq("enabled", true);
  const perChat = await Promise.all(((chats ?? []) as Array<{ chat_id: number }>).map((chat) => registerChatCommands(Number(chat.chat_id))));
  const after = await tg("getWebhookInfo");
  return { ok: Boolean(hook.ok && commands.ok), bot: botUsername, hook, commands, perChat, webhook: after.result };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BOT_TOKEN) return json({ ok: false, error: "Server configuration error" }, 503);

  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader !== null) {
    if (!CRON_SECRET || !timingSafeEqual(cronHeader, CRON_SECRET)) return json({ ok: false, error: "Forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.action === "info") {
      await me();
      const info = await tg("getWebhookInfo");
      return json({ ok: true, bot: botUsername, webhook: info.result });
    }
    if (body.action === "setup" && typeof body.url === "string" && body.url.startsWith("https://")) return json(await setup(body.url));
    if (body.action === "restore") return json(await restoreLegacy());
    return json({ ok: false, error: "Unknown action" }, 400);
  }

  const telegramHeader = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!timingSafeEqual(telegramHeader, await webhookSecret())) return json({ ok: false }, 401);

  const db: Db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const raw = await req.text();
    const update: Update = JSON.parse(raw);
    if (!ownsUpdate(update)) await forwardToLegacy(raw);
    else if (update.my_chat_member) await onBotMembership(db, update);
    else if (update.message) await onMessage(db, update.message);
  } catch (error) {
    console.error("tiflis-telegram-bot failed", error);
  }
  // Always 200: Telegram would otherwise retry the same update.
  return json({ ok: true });
});
